import { Cloneable } from "../../utils/Cloneable";
import { ToJson } from "../../utils/ToJson";
import { IRTerm } from "../IRTerm";
import { IHash, IIRParent } from "../interfaces";
import { concatUint8Arr } from "../utils/concatUint8Arr";
import { IRParentTerm, isIRParentTerm } from "../utils/isIRParentTerm";
import { BaseIRMetadata } from "./BaseIRMetadata";
import { mapArrayLike } from "./utils/mapArrayLike";
import { isIRTerm } from "../utils";
import { makeArrayLikeProxy } from "./utils/makeArrayLikeProxy";
import { MutArrayLike } from "../utils/MutArrayLike";
import { equalIrHash, hashIrData, IRHash, isIRHash } from "../IRHash";
import { _modifyChildFromTo } from "../toUPLC/_internal/_modifyChildFromTo";

export interface IRCaseMeta extends BaseIRMetadata {}

export class IRCase
    implements Cloneable<IRCase>, IHash, IIRParent, ToJson
{
    static get tag(): Uint8Array { return new Uint8Array([ 0b0000_1011 ]); }

    constructor(
        constrTerm: IRTerm,
        continuations: ArrayLike<IRTerm>,
        meta: IRCaseMeta = {},
        _unsafeHash?: IRHash
    )
    {
        const self = this;

        this.meta = meta;

        this._constrTerm = constrTerm;
        this._constrTerm.parent = self;

        Object.defineProperty(
            this, "continuations", {
                value: makeArrayLikeProxy<IRTerm>(
                    continuations,
                    isIRTerm,
                    // initModifyElem
                    // function called once for each element in the array
                    // only at element definition
                    newElem => {
                        newElem.parent = self;
                        return newElem;
                    },
                    // modifyElem
                    (newElem, oldElem) => {
                        // keep the parent reference in the old child, useful for compilation
                        // oldElem.parent = undefined;
                        newElem.parent = self;
                        if(!equalIrHash( oldElem.hash, newElem.hash )) self.markHashAsInvalid();
                        return newElem;
                    }
                ),
                writable: false,
                enumerable: true,
                configurable: false
            }
        );

        this._hash = isIRHash( _unsafeHash ) ? _unsafeHash : undefined;
    }

    private _hash: IRHash | undefined;
    get hash(): IRHash
    {
        if(!isIRHash( this._hash ))
        {
            // basically a merkle tree
            this._hash = hashIrData(
                concatUint8Arr(
                    IRCase.tag,
                    this._constrTerm.hash,
                    ...mapArrayLike( this.continuations, f => f.hash )
                )
            );
        }
        return this._hash;
    }
    markHashAsInvalid(): void
    {
        this._hash = undefined;
        this.parent?.markHashAsInvalid();
    }
    isHashPresent(): boolean { return isIRHash( this._hash ); }
    
    private _constrTerm!: IRTerm;
    get constrTerm(): IRTerm { return this._constrTerm; }
    set constrTerm( newConstrTerm: IRTerm )
    {
        if( !isIRTerm( newConstrTerm ) ) return;

        if(!equalIrHash( this._constrTerm.hash, newConstrTerm.hash )) this.markHashAsInvalid();

        // keep the parent reference in the old child, useful for compilation
        // constrTerm.parent = undefined;
        this._constrTerm = newConstrTerm;
        this._constrTerm.parent = this;
    }

    readonly continuations!: MutArrayLike<IRTerm>;

    private _parent: IRParentTerm | undefined;
    get parent(): IRParentTerm | undefined { return this._parent; }
    set parent( newParent: IRParentTerm | undefined )
    {
        if(!( // assert
            // new parent value is different than current
            this._parent !== newParent && (
                // and the new parent value is valid
                newParent === undefined || 
                isIRParentTerm( newParent )
            )
        )) return;

        // keep reference
        const oldParent = this._parent;
        
        // change parent
        this._parent = newParent;

        // if has old parent
        if( oldParent !== undefined && isIRParentTerm( oldParent ) )
        {
            // change reference to a clone for safety
            this.hash;
            _modifyChildFromTo(
                oldParent,
                this,
                this.clone()
            );
        }
    }

    readonly meta: IRCaseMeta

    clone(): IRCase
    {
        return new IRCase(
            this.constrTerm,
            mapArrayLike( this.continuations, f => f.clone() ),
            { ...this.meta },
            this.isHashPresent() ? this.hash : undefined
        );
    }

    toJson(): any
    {
        return {
            constrTerm: this.constrTerm.toString(),
            continuations: mapArrayLike( this.continuations, f => f.toJson() )
        };
    }
}