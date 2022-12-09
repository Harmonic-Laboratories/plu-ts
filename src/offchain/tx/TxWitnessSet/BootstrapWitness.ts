import Cbor from "../../../cbor/Cbor";
import CborObj from "../../../cbor/CborObj";
import CborArray from "../../../cbor/CborObj/CborArray";
import CborBytes from "../../../cbor/CborObj/CborBytes";
import CborString from "../../../cbor/CborString";
import { ToCbor } from "../../../cbor/interfaces/CBORSerializable";
import JsRuntime from "../../../utils/JsRuntime";
import ObjectUtils from "../../../utils/ObjectUtils";
import Hash32 from "../../hashes/Hash32/Hash32";
import Signature from "../../hashes/Signature/Signature";
import VKey from "./VKeyWitness/VKey";

export default class BootstrapWitness
    implements ToCbor
{
    readonly pubKey!: VKey;
    readonly signature!: Signature;
    readonly chainCode!: Hash32;
    readonly attributes!: Buffer;

    constructor( pubKey: Hash32, signature: Signature, chainCode: Hash32, attributes: Buffer )
    {
        JsRuntime.assert(
            pubKey instanceof Hash32,
            "invalid 'pubKey' constructing 'BootstrapWitness'"
        );
        ObjectUtils.defineReadOnlyProperty(
            this,
            "pubKey",
            pubKey instanceof VKey ? pubKey : new VKey( pubKey )
        );

        JsRuntime.assert(
            signature instanceof Signature,
            "invalid 'signature' constructing 'BootstrapWitness'"
        );
        ObjectUtils.defineReadOnlyProperty(
            this,
            "signature",
            signature
        );

        JsRuntime.assert(
            chainCode instanceof Hash32,
            "invalid 'chainCode' constructing 'BootstrapWitness'"
        );
        ObjectUtils.defineReadOnlyProperty(
            this,
            "chainCode",
            chainCode
        );

        JsRuntime.assert(
            Buffer.isBuffer( attributes ),
            "invalid 'attributes' constructing 'BootstrapWitness'"
        );
        ObjectUtils.defineReadOnlyProperty(
            this,
            "attributes",
            Buffer.from( attributes )
        );
    }

    toCbor(): CborString
    {
        return Cbor.encode( this.toCborObj() );
    }
    toCborObj(): CborObj
    {
        return new CborArray([
            this.pubKey.toCborObj(),
            this.signature.toCborObj(),
            this.chainCode.toCborObj(),
            new CborBytes( this.attributes )
        ])
    }
}