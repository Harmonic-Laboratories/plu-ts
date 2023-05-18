import { defineReadOnlyProperty } from "@harmoniclabs/obj-utils";
import type { IProvider } from "../IProvider";
import type { TxBuilder } from "../TxBuilder";
import { ITxBuildArgs, cloneITxBuildArgs } from "../../txBuild";
import { Address, AddressStr, AnyCertificate, Certificate, CertificateType, Hash28, ITxOutRef, IUTxO, IValuePolicyEntry, PlutusScriptType, PoolKeyHash, PoolParams, PubKeyHash, Script, ScriptType, StakeAddress, StakeAddressBech32, StakeCredentials, StakeValidatorHash, Tx, TxIn, TxMetadata, TxMetadatum, TxOutRefStr, TxWithdrawalsEntry, UTxO, Value, isIUTxO } from "@harmoniclabs/cardano-ledger-ts";
import { CanBeUInteger, forceBigUInt } from "../../utils/ints";
import { CanBeData } from "../../utils/CanBeData";
import { CanResolveToUTxO, cloneCanResolveToUTxO, forceTxOutRefStr, shouldResolveToUTxO } from "../CanResolveToUTxO/CanResolveToUTxO";
import { jsonToMetadata } from "./jsonToMetadata";
import { isGenesisInfos } from "../GenesisInfos";
import { decodeBech32 } from "@harmoniclabs/crypto";
import { fromHex } from "@harmoniclabs/uint8array-utils";
import { isData } from "@harmoniclabs/plutus-data";
import { canBeData, canBeUInteger, forceData } from "@harmoniclabs/plu-ts-offchain";

// /** sync */
// interface TxBuilderStep {
// 
// }
// 
// function cloneStep( step: TxBuilderStep ): TxBuilderStep
// {
//     return {
// 
//     };
// }

type SimpleScriptInfos = {
    inline: Script<PlutusScriptType>
    redeemer: CanBeData
} | {
    ref: UTxO;
    redeemer: CanBeData;
};

const enum TxBuilderTaskKind {
    ResolveUTxO = 0,
    ResolveTxIn = 1,
    ValidFromPOSIX = 2,
    ValidToPOSIX = 3,
    DelegateTo = 4,
    DeregisterStake = 5,
    Withdraw = 6
}

type TxBuilderPromiseTaskKind
    = TxBuilderTaskKind.ValidFromPOSIX
    | TxBuilderTaskKind.ValidToPOSIX
    | TxBuilderTaskKind.DelegateTo
    | TxBuilderTaskKind.DeregisterStake
    | TxBuilderTaskKind.Withdraw;

/** async */
interface TxBuilderPromiseTask {
    kind: TxBuilderTaskKind
    getPromise: () => Promise<void>
}

interface TxBuilderResolveUTxOTask {
    kind: TxBuilderTaskKind.ResolveUTxO,
    arg: ITxOutRef | TxOutRefStr | IUTxO,
    onResolved: ( utxo: UTxO ) => void 
}

interface TxBuilderResolveTxInTask {
    kind: TxBuilderTaskKind.ResolveTxIn,
    arg: ITxOutRef | TxOutRefStr | IUTxO,
    onResolved: ( utxo: TxIn ) => void 
}

type TxBuilderTask
    = TxBuilderPromiseTask
    | TxBuilderResolveUTxOTask
    | TxBuilderResolveTxInTask

function cloneTask( task: TxBuilderTask ): TxBuilderTask
{
    if( task.kind === TxBuilderTaskKind.ResolveUTxO || task.kind === TxBuilderTaskKind.ResolveTxIn )
    {
        const {
            kind,
            arg,
            onResolved
        } = task as TxBuilderResolveUTxOTask;
        return {
            kind: kind,
            arg: cloneCanResolveToUTxO( arg ) as (ITxOutRef | TxOutRefStr),
            onResolved: onResolved
        };
    }

    return {
        kind: task.kind,
        getPromise: task.getPromise
    };
}

const readonlyValueDescriptor = Object.freeze({
    writable: false,
    enumerable: true,
    configurable: false
});

export class TxBuilderRunner
{
    readonly build!:() => Promise<Tx>

    readonly reset!: () => TxBuilderRunner;
    
    // implied in the `txBuilder`
    // /** alias for `setNetworkId` */
    // readonly addNetworkId: ( id: CanBeUInteger | NetworkT ) => TxBuilderRunner
    // readonly setNetworkId: ( id: CanBeUInteger ) => TxBuilderRunner
    // readonly setNetwork: ( id: CanBeUInteger | NetworkT ) => TxBuilderRunner

    /**
     * @deprecated use `addRequiredSigner` instead
     */
    readonly addSigner!: ( signer: Address | StakeAddress | AddressStr | StakeAddressBech32 ) => TxBuilderRunner
    readonly addRequiredSigner!: ( signer: Address | StakeAddress | AddressStr | StakeAddressBech32 ) => TxBuilderRunner
    /**
     * @deprecated use `addRequiredSignerKey` instead
     */
    readonly addSignerKey!: ( signerKey: Hash28 ) => TxBuilderRunner
    readonly addRequiredSignerKey!: ( signerKey: Hash28 ) => TxBuilderRunner
    
    readonly attachCertificateValidator!: ( validator: Script<PlutusScriptType> ) => TxBuilderRunner
    readonly attachMintingValidator!: ( validator: Script<PlutusScriptType> ) => TxBuilderRunner
    readonly attachSpendingValidator!: ( validator: Script<PlutusScriptType> ) => TxBuilderRunner
    readonly attachWithdrawalValidator!: ( validator: Script<PlutusScriptType> ) => TxBuilderRunner
    readonly attachValidator!: ( validator: Script<PlutusScriptType> ) => TxBuilderRunner
    
    readonly attachMetadata!: ( label: CanBeUInteger, metadata: TxMetadatum ) => TxBuilderRunner
    readonly attachMetadataJson!: ( label: CanBeUInteger, metadataJson: any ) => TxBuilderRunner
    /** like `attachMetadataJson` but if a strings starts with `0x` is treated as an hexadecimal byte string */
    readonly attachMetadataJsonWithConversion!: ( label: CanBeUInteger, metadataJson: any ) => TxBuilderRunner
    
    readonly setChangeAddress!: ( changeAddr: Address | AddressStr ) => TxBuilderRunner
    
    /**
     * @deprecated `collectFrom` is unclear; use `addInputs` instead.
     */
    readonly collectFrom!: ( utxos: CanResolveToUTxO[], redeemer?: CanBeData ) => TxBuilderRunner
    readonly addInputs!: ( utxos: CanResolveToUTxO[], redeemer?: CanBeData, script_or_ref?: UTxO | Script<PlutusScriptType> ) => TxBuilderRunner
    
    readonly payTo: (
        address: Address | AddressStr,
        amount: CanBeUInteger | Value,
        datum?: CanBeData,
        refScript?: Script<ScriptType.PlutusV2> 
    ) => TxBuilderRunner

    // readonly compose: ( other: Tx ) => TxBuilderRunner
    
    readonly delegateTo!:(
        delegator: CanBeStakeCreds,
        poolId: CanBePoolKeyHash,
        redeemer?: CanBeData,
        script_or_ref?: Script<PlutusScriptType> | CanResolveToUTxO
    ) => TxBuilderRunner
    readonly deregisterStake!:(
        delegator: CanBeStakeCreds,
        redeemer?: CanBeData,
        script_or_ref?: Script<PlutusScriptType> | CanResolveToUTxO
    ) => TxBuilderRunner
    readonly mintAssets: (
        assets: IValuePolicyEntry,
        redeemer?: CanBeData,
        script_or_ref?: Script | CanResolveToUTxO
    ) => TxBuilderRunner
    // readonly spendUtxo: (
    //     utxo: CanResolveToUTxO,
    //     script_or_refScript?: Script | CanResolveToUTxO,
    //     redeemer?: CanBeData
    // ) => TxBuilderRunner
    readonly withdraw!: (
        stakeAddress: CanBeStakeCreds,
        amount: CanBeUInteger,
        redeemer?: CanBeData,
        script_or_ref?: Script | CanResolveToUTxO
    ) => TxBuilderRunner

    // readonly registerPool: (
    //     params: PoolParams,
    //     redeemer?: CanBeData,
    //     script_or_ref?: Script | CanResolveToUTxO
    // ) => TxBuilderRunner
    
    // /**
    //  * @deprecated `registerStake` is unclear; use `registerStakeAddress` instead
    //  */
    // readonly registerStake: ( stakeAddr: StakeAddress | StakeAddressBech32 ) => TxBuilderRunner
    // readonly registerStakeAddress: ( stakeAddr: StakeAddress | StakeAddressBech32 ) => TxBuilderRunner

    // readonly retirePool: ( poolId: Hash28, epoch: CanBeUInteger ) => TxBuilderRunner
    // readonly updatePool: ( poolParams: PoolParams ) => TxBuilderRunner

    /**
     * @deprecated `readFrom` is an ugly name; use `referenceUtxos` instead
     */
    readonly readFrom!:( utxos: CanResolveToUTxO[] ) => TxBuilderRunner
    readonly referenceUtxos!:( utxos: CanResolveToUTxO[] ) => TxBuilderRunner

    readonly validFrom!:  ( POSIX: CanBeUInteger ) => TxBuilderRunner
    readonly validFromSlot!: ( slot: CanBeUInteger ) => TxBuilderRunner
    readonly invalidBeforeSlot!: ( slot: CanBeUInteger ) => TxBuilderRunner
    readonly validTo!:  ( POSIX: CanBeUInteger ) => TxBuilderRunner
    readonly validToSlot!: ( slot: CanBeUInteger ) => TxBuilderRunner
    readonly invalidAfterSlot!: ( slot: CanBeUInteger ) => TxBuilderRunner

    readonly tasks!: TxBuilderTask[];
    // readonly steps!: TxBuilderStep[];
    readonly buildArgs!: ITxBuildArgs;
    
    /**
     * @experimental
     */
    constructor(
        txBuilder: TxBuilder,
        provider: IProvider
    )
    {
        const self = this;
        let tasks: TxBuilderTask[] = [];
        // let steps: TxBuilderStep[] = [];
        let buildArgs: ITxBuildArgs = {} as any;
        const scripts: Script[] = [];
        const scriptHashesStr: string[] = [];
        const refUtxos: UTxO[] = [];

        defineReadOnlyProperty(
            this, "reset",
            () => {
                tasks.length = 0;
                // steps.length = 0;
                buildArgs = {} as any;
                scripts.length = 0;
                scriptHashesStr.length = 0;
                refUtxos.length = 0;
                return self;
            }
        );

        function _addRefUtxo( u: CanResolveToUTxO ): void
        {
            if( isIUTxO( u ) )
            {
                refUtxos.push( new UTxO( u ) );
                return;
            }
            tasks.push({
                kind: TxBuilderTaskKind.ResolveUTxO,
                arg: u,
                onResolved: ( utxo ) => refUtxos.push( utxo )
            });
        }

        function _addAviableScript( scrpt: Script ): void
        {
            const hStr = scrpt.hash.toString();

            if( !scriptHashesStr.includes( hStr ) )
            {
                scripts.push( scrpt );
                scriptHashesStr.push( hStr );
            }
        }

        Object.defineProperties(
            this, {
                tasks: {
                    get: () => tasks.map( cloneTask ),
                    set: () => {},
                    enumerable: true,
                    configurable: false
                },
                // steps: {
                //     get: () => steps.map( cloneStep ),
                //     set: () => {},
                //     enumerable: true,
                //     configurable: false
                // },
                buildArgs: {
                    get: () => cloneITxBuildArgs( buildArgs ),
                    set: () => {},
                    enumerable: true,
                    configurable: false
                }
            }
        );

        function _addRequiredSignerKey( key: string | Hash28 | Uint8Array ): TxBuilderRunner
        {
            key = new PubKeyHash( key );
            
            if( buildArgs.requiredSigners === undefined )
            {
                buildArgs.requiredSigners = [ key ];
                return self;
            }

            if( !buildArgs.requiredSigners.some( sig => sig.toString() === key.toString() ) )
            {
                buildArgs.requiredSigners.push( key );
            }
            
            return self;
        }
        function _addRequiredSigner( signer: Address | StakeAddress | AddressStr | StakeAddressBech32 ): TxBuilderRunner
        {
            if( typeof signer === "string" )
            {
                if( signer.startsWith("addr") )
                {
                    signer = Address.fromString( signer );
                }
                else if( signer.startsWith("stake") )
                {
                    signer = StakeAddress.fromString( signer );
                }
            }

            if( signer instanceof Address )
            {
                void _addRequiredSignerKey( signer.paymentCreds.hash );
                if(
                    signer.stakeCreds !== undefined &&
                    !Array.isArray( signer.stakeCreds.hash )
                )
                {
                    void _addRequiredSignerKey( signer.stakeCreds.hash );
                }
                return self;
            }

            if( signer instanceof StakeAddress )
            {
                return _addRequiredSignerKey( signer.credentials )
            }

            throw new Error("invalid required signer");
        }

        function _attachMetadata( label: CanBeUInteger, metadatum: TxMetadatum ): TxBuilderRunner
        {            
            const meta = buildArgs.metadata?.metadata;
            
            const labelStr = forceBigUInt(label).toString();
            const labels = Object.keys( meta ?? {} );

            if( labels.length === 0 )
            {
                buildArgs.metadata = new TxMetadata({
                    [labelStr]: metadatum
                });
                return self;
            }

            buildArgs.metadata = new TxMetadata({
                ...meta,
                // if `labelStr` is already present is overridden
                // otherwise is just added
                [labelStr]: metadatum
            });
            return self;
        }
        function _attachMetadataJson( label: CanBeUInteger, json: any ): TxBuilderRunner
        {
            return _attachMetadata( label, jsonToMetadata( json ) )
        }
        function _attachMetadataJsonWithConversion( label: CanBeUInteger, json: any ): TxBuilderRunner
        {
            return _attachMetadata( label, jsonToMetadata( json, true ) )
        }

        function _setChangeAddress( addr: Address | AddressStr ): TxBuilderRunner
        {
            buildArgs.changeAddress = addr;
            return self;
        }

        function _validFromSlot( slot: CanBeUInteger ): TxBuilderRunner
        {
            tasks = tasks.filter( ({ kind }) => kind !== TxBuilderTaskKind.ValidFromPOSIX );
            buildArgs.invalidBefore = forceBigUInt( slot );
            return self;
        }
        function _validFromPOSIX( POSIX: CanBeUInteger ): TxBuilderRunner
        {
            tasks.push({
                kind: TxBuilderTaskKind.ValidFromPOSIX,
                getPromise: async () => {
                    if( !isGenesisInfos( txBuilder.genesisInfos ) )
                    {
                        txBuilder.setGenesisInfos(
                            await provider.getGenesisInfos()
                        )
                    }
                    buildArgs.invalidBefore = forceBigUInt( txBuilder.posixToSlot( POSIX ) );
                }
            })
            return self;
        }

        function _validToSlot( slot: CanBeUInteger ): TxBuilderRunner
        {
            tasks = tasks.filter( ({ kind }) => kind !== TxBuilderTaskKind.ValidToPOSIX );
            buildArgs.invalidAfter = forceBigUInt( slot );
            return self;
        }
        function _validToPOSIX( POSIX: CanBeUInteger ): TxBuilderRunner
        {
            tasks.push({
                kind: TxBuilderTaskKind.ValidToPOSIX,
                getPromise: async () => {
                    if( !isGenesisInfos( txBuilder.genesisInfos ) )
                    {
                        txBuilder.setGenesisInfos(
                            await provider.getGenesisInfos()
                        )
                    }
                    buildArgs.invalidAfter = forceBigUInt( txBuilder.posixToSlot( POSIX ) );
                }
            })
            return self;
        }

        function _referenceUTxOs( utxos: CanResolveToUTxO[] ): TxBuilderRunner
        {
            if( utxos.length <= 0 ) return self;

            for( const u of utxos )
            {
                _addRefUtxo( u );
            }

            return self;
        }

        function _addCertificate(
            cert: AnyCertificate, 
            script: SimpleScriptInfos | undefined
        ): void
        {
            if(!(buildArgs.certificates))
            {
                buildArgs.certificates = [{
                    cert,
                    script
                }];
                return;
            }
            else
            {
                buildArgs.certificates.push({
                    cert,
                    script
                });
            }
        }

        function _addWithdraw(
            withdrawal: TxWithdrawalsEntry,
            script?: {
                inline: Script
                redeemer: CanBeData
            } | {
                ref: UTxO
                redeemer: CanBeData
            }
        ): void
        {
            if(!(buildArgs.withdrawals))
            {
                buildArgs.withdrawals = [{
                    withdrawal,
                    script
                }];
                return;
            }
            else
            {
                buildArgs.withdrawals.push({
                    withdrawal,
                    script
                });
            }
        }

        function _tryGetRefScript( scriptHashStr: string ): UTxO | undefined
        {
            const theRef = refUtxos.find( ref => ref.resolved.refScript?.hash?.toString() === scriptHashStr );
            
            if( theRef === undefined ) return undefined;
            return theRef;
        }

        function _tryGetScript( scriptHashStr: string ): Script<PlutusScriptType> | undefined
        {
            const theScript = scripts.find( scr => scr.hash.toString() === scriptHashStr );
            
            if( theScript === undefined ) return undefined;
            return theScript as Script<PlutusScriptType>;
        }

        function _tryGetRefStakeScript( stakeCreds: StakeCredentials ): UTxO | undefined
        {
            const scriptHash = stakeCreds.hash;

            if( Array.isArray( scriptHash ) ) return undefined
            
            return _tryGetRefScript( scriptHash.toString() );
        }

        function _tryGetStakeScript( stakeCreds: StakeCredentials ): Script<PlutusScriptType> | undefined
        {
            const scriptHash = stakeCreds.hash;

            if( Array.isArray( scriptHash ) ) return undefined;
            
            return _tryGetScript( scriptHash.toString() );
        }

        function _ensureStakeScript(
            stakeCreds: StakeCredentials,
            script_or_ref: CanResolveToUTxO | Script<PlutusScriptType> | undefined,
            redeemer: CanBeData | undefined,
            script: SimpleScriptInfos | undefined
        ): SimpleScriptInfos 
        {
            if( stakeCreds.type === "script" )
            {
                if( redeemer === undefined )
                {
                    throw new Error("in \"delegateTo\"; stake credenials are \"script\" but \"redeemer\" is missing");
                }

                if( shouldResolveToUTxO( script_or_ref ) )
                {
                    throw new Error("unresolved TxOutRef used as ref UTxO");
                }

                if( !( script ) )
                {
                    script_or_ref = _tryGetRefStakeScript( stakeCreds );

                    if( script_or_ref === undefined )
                    {
                        script_or_ref = _tryGetStakeScript( stakeCreds );
                    }
                    
                    if( script_or_ref === undefined )
                    {
                        throw new Error("missing script with hash: " + stakeCreds.hash );
                    }

                    if( isIUTxO( script_or_ref ) )
                    {
                        script = {
                            ref: new UTxO( script_or_ref ),
                            redeemer
                        }
                    }
                    else
                    {
                        script = {
                            inline: script_or_ref,
                            redeemer
                        }
                    }
                }
            }

            return script!;
        }
        
        function _delegateTo(
            delegator: CanBeStakeCreds,
            poolId: CanBePoolKeyHash,
            redeemer?: CanBeData,
            script_or_ref?: Script<PlutusScriptType> | CanResolveToUTxO
        ): TxBuilderRunner
        {
            const stakeCreds: StakeCredentials = forceStakeCreds( delegator );
            const poolKeyHash: PoolKeyHash = forcePoolKeyHash( poolId );

            let script: undefined | SimpleScriptInfos = undefined;

            if(
                delegator instanceof Script &&
                ( script_or_ref === undefined || script_or_ref instanceof Script )
            )
            {
                script_or_ref = delegator
            }

            if( stakeCreds.type === "script" )
            {
                if( redeemer === undefined )
                {
                    throw new Error("in \"delegateTo\"; stake credenials are \"script\" but \"redeemer\" is missing");
                }

                if( shouldResolveToUTxO( script_or_ref ) )
                {
                    tasks.push({
                        kind: TxBuilderTaskKind.ResolveUTxO,
                        arg: script_or_ref,
                        onResolved: (utxo) => {
                            script_or_ref = utxo;
                            script = {
                                ref: utxo,
                                redeemer
                            };
                        }
                    });
                }
            }
            
            tasks.push({
                kind: TxBuilderTaskKind.DelegateTo,
                getPromise: async () => {

                    script = _ensureStakeScript(
                        stakeCreds,
                        script_or_ref,
                        redeemer,
                        script
                    );

                    _addCertificate(
                        new Certificate(
                            2 as CertificateType.StakeDelegation,
                            stakeCreds,
                            poolKeyHash
                        ),
                        script
                    );
                }
            });

            return self;
        }

        function _deregisterStake(
            delegator: CanBeStakeCreds,
            redeemer?: CanBeData,
            script_or_ref?: Script<PlutusScriptType> | CanResolveToUTxO
        ): TxBuilderRunner
        {
            const stakeCreds: StakeCredentials = forceStakeCreds( delegator );

            let script: undefined | {
                inline: Script<PlutusScriptType>
                redeemer: CanBeData
            } | {
                ref: UTxO;
                redeemer: CanBeData;
            } = undefined;

            if(
                delegator instanceof Script &&
                ( script_or_ref === undefined || script_or_ref instanceof Script )
            )
            {
                script_or_ref = delegator
            }

            if( stakeCreds.type === "script" )
            {
                if( redeemer === undefined )
                {
                    throw new Error("in \"deregisterStake\"; stake credenials are \"script\" but \"redeemer\" is missing");
                }

                if( shouldResolveToUTxO( script_or_ref ) )
                {
                    tasks.push({
                        kind: TxBuilderTaskKind.ResolveUTxO,
                        arg: script_or_ref,
                        onResolved: (utxo) => {
                            script_or_ref = utxo;
                            script = {
                                ref: utxo,
                                redeemer
                            };
                        }
                    });
                }
            }
            
            tasks.push({
                kind: TxBuilderTaskKind.DeregisterStake,
                getPromise: async () => {

                    script = _ensureStakeScript(
                        stakeCreds,
                        script_or_ref,
                        redeemer,
                        script
                    );

                    _addCertificate(
                        new Certificate(
                            1 as CertificateType.StakeDeRegistration,
                            stakeCreds
                        ),
                        script
                    );
                }
            });

            return self;
        }

        function _withdraw(
            stakeAddress: CanBeStakeCreds,
            amount: CanBeUInteger,
            redeemer?: CanBeData,
            script_or_ref?: Script<PlutusScriptType> | CanResolveToUTxO
        ): TxBuilderRunner
        {
            const stakeCreds: StakeCredentials = forceStakeCreds( stakeAddress );

            let script: undefined | {
                inline: Script<PlutusScriptType>
                redeemer: CanBeData
            } | {
                ref: UTxO;
                redeemer: CanBeData;
            } = undefined;

            if(
                stakeAddress instanceof Script &&
                ( script_or_ref === undefined || script_or_ref instanceof Script )
            )
            {
                script_or_ref = stakeAddress
            }

            if( stakeCreds.type === "script" )
            {
                if( redeemer === undefined )
                {
                    throw new Error("in \"withdraw\"; stake credenials are \"script\" but \"redeemer\" is missing");
                }

                if( shouldResolveToUTxO( script_or_ref ) )
                {
                    tasks.push({
                        kind: TxBuilderTaskKind.ResolveUTxO,
                        arg: script_or_ref,
                        onResolved: (utxo) => {
                            script_or_ref = utxo;
                            script = {
                                ref: utxo,
                                redeemer
                            };
                        }
                    });
                }
            }
            
            tasks.push({
                kind: TxBuilderTaskKind.Withdraw,
                getPromise: async () => {

                    script = _ensureStakeScript(
                        stakeCreds,
                        script_or_ref,
                        redeemer,
                        script
                    );

                    if( Array.isArray( stakeCreds.hash ) )
                    {
                        throw new Error("unexpected pointer stake credentials");
                    }

                    _addWithdraw(
                        {
                            rewardAccount: stakeCreds.hash,
                            amount
                        },
                        script
                    );
                }
            });

            return self;
        }

        function _pushInput(
            utxo: UTxO,
            redeemer?: CanBeData,
            script_or_ref?: IUTxO | Script<PlutusScriptType>,
            datum?: CanBeData
        ): void
        {
            const paymentCreds = utxo.resolved.address.paymentCreds;
            if( paymentCreds.type === "script" )
            {
                if( !canBeData( redeemer ) ) throw new Error("script input " + utxo.utxoRef.toString() + " is missing a redeemer");
                else redeemer = forceData( redeemer );

                if( !isIUTxO( script_or_ref ) || !( script_or_ref instanceof Script ) )
                throw new Error("script input " + utxo.utxoRef.toString() + " is missing the script source");

                if( !Array.isArray( buildArgs.inputs ) )
                {
                    buildArgs.inputs = [] as any;
                }

                const isInlineDatum = isData( utxo.resolved.datum );
                if( !isInlineDatum && !canBeData( datum ) )
                throw new Error("missing datum for script input " + + utxo.utxoRef.toString());
                
                if( isIUTxO( script_or_ref )  )
                {
                    const ref = script_or_ref instanceof UTxO ? script_or_ref : new UTxO( script_or_ref ); 

                    buildArgs.inputs.push({
                        utxo,
                        referenceScriptV2: {
                            refUtxo: ref,
                            redeemer,
                            datum: isInlineDatum ? "inline" : datum as CanBeData
                        }
                    })
                }
                return;
            }
            
            // not script
            if( !Array.isArray( buildArgs.inputs ) )
            {
                buildArgs.inputs = [{ utxo }]
            }
            else
            {
                buildArgs.inputs.push({ utxo });
            }
        }

        function _addInput(
            utxo: IUTxO,
            redeemer: CanBeData | undefined,
            script_or_ref: IUTxO | Script<PlutusScriptType> | undefined,
            datum: CanBeData | undefined
        ): void
        {
            utxo = utxo instanceof UTxO ? utxo : new UTxO( utxo );
            const paymentCreds = (utxo as UTxO).resolved.address.paymentCreds;
            if( paymentCreds.type === "script" )
            {
                const hashStr = paymentCreds.hash.toString();
                
                if( !isIUTxO( script_or_ref ) ) script_or_ref = _tryGetRefScript( hashStr ) ?? script_or_ref;
                if( !script_or_ref ) script_or_ref = _tryGetScript( hashStr );
                if( !script_or_ref ) throw new Error("missing script for utxo: " + (utxo as UTxO).utxoRef.toString() );

                if( isIUTxO( script_or_ref ) ) script_or_ref = new UTxO( script_or_ref );
            }

            _pushInput( utxo as UTxO, redeemer, script_or_ref, datum );
        }

        function __addInptus(
            utxos: CanResolveToUTxO[],
            redeemer?: CanBeData,
            script_or_ref?: IUTxO | Script<PlutusScriptType>,
            datum?: CanBeData
            ): TxBuilderRunner
        {
            for( const _utxo of utxos )
            {
                tasks.push({
                    kind: TxBuilderTaskKind.ResolveTxIn,
                    arg: _utxo,
                    onResolved: ( txIn ) => {
                        _addInput( txIn, redeemer, script_or_ref, datum );
                    }
                });
            }    
            return self;
        }
        function _addInputs(
            utxos: CanResolveToUTxO[],
            datum?: CanBeData | "inline",
            redeemer?: CanBeData,
            script_or_ref?: CanResolveToUTxO | Script<PlutusScriptType>,
        ): TxBuilderRunner
        {
            datum = datum === "inline" ? undefined : datum;
            if( shouldResolveToUTxO( script_or_ref ) )
            {
                tasks.push({
                    kind: TxBuilderTaskKind.ResolveUTxO,
                    arg: script_or_ref,
                    onResolved: ( ref ) => {
                        __addInptus( utxos, redeemer, ref, datum );
                    }
                });
                
                return self;
            }
            return __addInptus( utxos, redeemer, script_or_ref, datum );
        }

        function _payTo(
            address: Address | AddressStr,
            amount: CanBeUInteger | Value,
            datum?: CanBeData,
            refScript?: Script<ScriptType.PlutusV2> 
        ): TxBuilderRunner
        {
            if( !Array.isArray( buildArgs.outputs ) )
            {
                buildArgs.outputs = [];
            }

            buildArgs.outputs.push({
                address: typeof address === "string" ? Address.fromString( address ) : address,
                value: canBeUInteger( amount ) ? Value.lovelaces( amount ) : amount,
                datum: datum !== undefined && canBeData( datum ) ? forceData( datum ) : undefined,
                refScript
            });

            return self;
        }

        async function _build(): Promise<Tx>
        {
            const otherTasks: TxBuilderPromiseTask[] = new Array( tasks.length );
            let oLen = 0;
            const utxoTasks: TxBuilderResolveUTxOTask[] = new Array( tasks.length );
            let uLen = 0;
            const insTasks: TxBuilderResolveTxInTask[] = new Array( tasks.length );
            let iLen = 0;

            // collect tasks first time
            for(const task of tasks)
            {
                switch( task.kind )
                {
                    case TxBuilderTaskKind.ResolveUTxO:
                        utxoTasks[ uLen++ ] = task as TxBuilderResolveUTxOTask;
                        break;
                    case TxBuilderTaskKind.ResolveTxIn:
                        insTasks[ iLen++ ] = task as TxBuilderResolveTxInTask;
                        break;
                    default:
                        otherTasks[ oLen++ ] = task;
                        break;
                }
            }
            tasks.length = 0;
            utxoTasks.length = uLen;
            insTasks.length = iLen;
            otherTasks.length = oLen;

            async function resolveUtxos( _tasks: TxBuilderResolveUTxOTask[] | TxBuilderResolveTxInTask[] ): Promise<void>
            {
                const utxosToFind = new Array( _tasks.length ) as CanResolveToUTxO[];
                let uLen = 0;
                const resolvedUtxos = new Array( _tasks.length ) as UTxO[];
                let iLen = 0;
    
                for( const { arg } of _tasks )
                {
                    if( arg instanceof UTxO ) resolvedUtxos[ iLen++ ] = arg;
                    else if( isIUTxO( arg ) ) resolvedUtxos[ iLen++ ] = new UTxO( arg );
                    else utxosToFind[ uLen++ ] = arg;
                }
                utxosToFind.length = uLen;
                resolvedUtxos.length = iLen;
    
                if( uLen > 0 )
                {
                    resolvedUtxos.push( ...(await provider.resolveUtxos( utxosToFind )) );
                }
    
                for( const u of resolvedUtxos )
                {
                    const resolvedIdx = _tasks.findIndex( t => forceTxOutRefStr( t.arg ) === u.utxoRef.toString() );
                    if( resolvedIdx < 0 )
                    {
                        continue; // ??? // extra utxo?
                    }
                    let task: TxBuilderResolveUTxOTask | TxBuilderResolveTxInTask
                    if( resolvedIdx === 0 )
                    {
                        task = _tasks.shift()!;
                    }
                    else
                    {
                        task = _tasks[ resolvedIdx ];
                        // remove in-place
                        void _tasks.splice( resolvedIdx, 1 );
                    }
    
                    task.onResolved( u );
                }

                // should already be 0 but just to be sure;
                _tasks.length = 0;
            }

            await resolveUtxos( utxoTasks );

            let hasUTxOTasks = utxoTasks.length > 0;
            do {
                // collect any other thasks
                for(const task of tasks)
                {
                    switch( task.kind )
                    {
                        case TxBuilderTaskKind.ResolveUTxO:
                            utxoTasks.push( task as TxBuilderResolveUTxOTask );
                            break;
                        case TxBuilderTaskKind.ResolveTxIn:
                            insTasks.push( task as TxBuilderResolveTxInTask );
                            break;
                        default:
                            otherTasks.push( task );
                            break;
                    }
                }
                // clear all tasks
                tasks.length = 0;

                hasUTxOTasks = utxoTasks.length > 0;
                hasUTxOTasks && await resolveUtxos( utxoTasks );
            } while ( hasUTxOTasks )

            insTasks.length > 0 && await resolveUtxos( insTasks );

            while( otherTasks.length > 0 )
            {
                const { kind, getPromise } = otherTasks.pop()!
                if(
                    ( kind === TxBuilderTaskKind.ValidFromPOSIX || kind === TxBuilderTaskKind.ValidToPOSIX ) &&
                    !isGenesisInfos( txBuilder.genesisInfos )
                )
                {
                    txBuilder.setGenesisInfos(
                        await provider.getGenesisInfos()
                    );
                }

                await getPromise();
            };

            if( !buildArgs.changeAddress )
            {
                if(
                    !Array.isArray( buildArgs.inputs ) ||
                    buildArgs.inputs.length === 0
                )
                {
                    throw new Error("can't deduce change Address; missing inputs")    
                }

                buildArgs.changeAddress = buildArgs.inputs
                ?.find( _in => _in.utxo.resolved.address.paymentCreds.type === "pubKey" )
                ?.utxo.resolved.address!;

                if( !buildArgs.changeAddress )
                {
                    throw new Error("can't deduce change Address; only script inputs");
                }
            }

            const tx = await txBuilder.build( buildArgs );
            
            self.reset();

            return tx;
        };

        Object.defineProperties(
            this, {
                addSigner: {
                    value: _addRequiredSigner,
                    ...readonlyValueDescriptor
                },
                addRequiredSigner: {
                    value: _addRequiredSigner,
                    ...readonlyValueDescriptor
                },
                addSignerKey: {
                    value: _addRequiredSignerKey,
                    ...readonlyValueDescriptor
                },
                addRequiredSignerKey: {
                    value: _addRequiredSignerKey,
                    ...readonlyValueDescriptor
                },
                attachMetadata: {
                    value: _attachMetadata,
                    ...readonlyValueDescriptor
                },
                attachMetadataJson: {
                    value: _attachMetadataJson,
                    ...readonlyValueDescriptor
                },
                attachMetadataJsonWithConversion: {
                    value: _attachMetadataJsonWithConversion,
                    ...readonlyValueDescriptor
                },
                setChangeAddress: {
                    value: _setChangeAddress,
                    ...readonlyValueDescriptor
                },
                validFrom: {
                    value: _validFromPOSIX,
                    ...readonlyValueDescriptor
                },
                validFromSlot: {
                    value: _validFromSlot,
                    ...readonlyValueDescriptor
                },
                invalidBeforeSlot: {
                    value: _validFromSlot,
                    ...readonlyValueDescriptor
                },
                validTo: {
                    value: _validToPOSIX,
                    ...readonlyValueDescriptor
                },
                validToSlot: {
                    value: _validToSlot,
                    ...readonlyValueDescriptor
                },
                invalidAfterSlot: {
                    value: _validToSlot,
                    ...readonlyValueDescriptor
                },
                delegateTo: {
                    value: _delegateTo,
                    ...readonlyValueDescriptor
                },
                deregisterStake: {
                    value: _deregisterStake,
                    ...readonlyValueDescriptor
                },
                withdraw: {
                    value: _withdraw,
                    ...readonlyValueDescriptor
                },
                attachCertificateValidator: {
                    value: _addAviableScript,
                    ...readonlyValueDescriptor
                },
                attachMintingValidator: {
                    value: _addAviableScript,
                    ...readonlyValueDescriptor
                },
                attachSpendingValidator: {
                    value: _addAviableScript,
                    ...readonlyValueDescriptor
                },
                attachWithdrawalValidator: {
                    value: _addAviableScript,
                    ...readonlyValueDescriptor
                },
                attachValidator: {
                    value: _addAviableScript,
                    ...readonlyValueDescriptor
                },
                readFrom: {
                    value: _referenceUTxOs,
                    ...readonlyValueDescriptor
                },
                referenceUtxos: {
                    value: _referenceUTxOs,
                    ...readonlyValueDescriptor
                },
                collectFrom: {
                    value: _addInputs,
                    ...readonlyValueDescriptor
                },
                addInputs: {
                    value: _addInputs,
                    ...readonlyValueDescriptor
                },
                payTo: {
                    value: _payTo,
                    ...readonlyValueDescriptor
                },
                build: {
                    value: _build,
                    ...readonlyValueDescriptor
                }
            }
        );
    }
}

// ------------------------------------ utils ------------------------------------- //

export type CanBeStakeCreds = StakeAddress | StakeAddressBech32 | StakeCredentials | Script<PlutusScriptType>

function forceStakeCreds( creds: CanBeStakeCreds ): StakeCredentials
{
    if( typeof creds === "string" )
    {
        if( !creds.startsWith("stake") )
        {
            throw new Error("invalid bech32 stake address");
        }
        creds = StakeAddress.fromString( creds );
    }

    if( creds instanceof StakeAddress )
    {
        return creds.toStakeCredentials()
    }

    if( creds instanceof Script )
    {
        return new StakeCredentials(
            "script",
            new StakeValidatorHash( creds.hash )
        );
    }

    if( creds.type === "pointer" )
    {
        throw new Error("pointer stake credentials not supported");
    }

    return creds;
}

export type CanBePoolKeyHash = Hash28 | `pool1${string}` | `pool_test1${string}` | string /* hex */ | Uint8Array;

function forcePoolKeyHash( canBe: CanBePoolKeyHash ): PoolKeyHash
{
    if( typeof canBe === "string" )
    {
        if( canBe.startsWith("pool") )
        {
            const [ _hrp, decoded ] = decodeBech32( canBe );

            return new PoolKeyHash( new Uint8Array( decoded ) );
        }
        return new PoolKeyHash( fromHex( canBe ) );
    }
    return new PoolKeyHash( canBe );
}