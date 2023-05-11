import { ByteString } from "@harmoniclabs/bytestring";
import { Cloneable } from "@harmoniclabs/cbor/dist/utils/Cloneable";
import { blake2b_128 } from "@harmoniclabs/crypto";
import { Pair } from "@harmoniclabs/pair";
import { Data, isData, dataToCbor } from "@harmoniclabs/plutus-data";
import { fromUtf8, toHex } from "@harmoniclabs/uint8array-utils";
import { isConstValueInt } from "@harmoniclabs/uplc";
import { TermType, isWellFormedType, typeExtends, lam, tyVar, delayed, termTypeToString, unit, bool, bs, int, str, data, list, pair, GenericTermType, PrimType } from "../../pluts";
import { cloneTermType } from "../../pluts/type_system/cloneTermType";
import { termTyToConstTy } from "../../pluts/type_system/termTyToConstTy";
import { BasePlutsError } from "../../utils/BasePlutsError";
import { ToJson } from "../../utils/ToJson";
import UPLCFlatUtils from "../../utils/UPLCFlatUtils";
import { CanBeUInteger, canBeUInteger, forceBigUInt } from "../../utils/ints";
import { IRTerm } from "../IRTerm";
import { IHash, IIRParent } from "../interfaces";
import { concatUint8Arr } from "../utils/concatUint8Arr";
import { isIRTerm } from "../utils/isIRTerm";
import { positiveBigIntAsBytes } from "../utils/positiveIntAsBytes";
import { defineReadOnlyProperty } from "@harmoniclabs/obj-utils";

export type IRConstValue
    = CanBeUInteger
    | ByteString | Uint8Array
    | string
    | boolean
    | IRConstValue[]
    | Pair<IRConstValue, IRConstValue>
    | Data
    | undefined;


export class IRConst
    implements Cloneable<IRConst>, IHash, IIRParent, ToJson
{
    readonly hash: Uint8Array;
    markHashAsInvalid: () => void;

    readonly type!: TermType
    readonly value!: IRConstValue

    parent: IRTerm | undefined;

    constructor( t: TermType, v: IRConstValue )
    {
        if(
            !isWellFormedType( t ) ||
            typeExtends( t, lam( tyVar(), tyVar() ) ) &&
            typeExtends( t, delayed( tyVar() ) )
        )
        {
            throw new BasePlutsError(
                "invalid type for IR constant"
            );
        }

        defineReadOnlyProperty(
            this, "type", cloneTermType( t )
        );

        if(!(
            isIRConstValueAssignableToType( v, t )
        ))
        {
            console.log( v )
            throw new BasePlutsError(
                "invalid IR constant value for type " + termTypeToString( t )
            );
        }

        defineReadOnlyProperty(
            this, "value", v
        );

        let _parent: IRTerm | undefined = undefined;
        Object.defineProperty(
            this, "parent",
            {
                get: () => _parent,
                set: ( newParent: IRTerm | undefined ) => {

                    if( newParent === undefined || isIRTerm( newParent ) )
                    {
                        _parent = newParent;
                    }

                },
                enumerable: true,
                configurable: false
            }
        );

        let hash: Uint8Array | undefined = undefined;
        Object.defineProperty(
            this, "hash", {
                get: () => {
                    if(!( hash instanceof Uint8Array ))
                    {
                        hash = blake2b_128(
                            concatUint8Arr(
                                IRConst.tag,
                                new Uint8Array( termTyToConstTy( this.type ) ),
                                serializeIRConstValue( this.value, this.type )
                            )
                        )
                    }
                    return hash.slice();
                },
                set: () => {},
                enumerable: true,
                configurable: false
            }
        );

        Object.defineProperty(
            this, "markHashAsInvalid",
            {
                value: () => { throw new Error("IRConst `markHashAsInvalid` was called; but a constant doesn't have childs") },
                writable: false,
                enumerable:  true,
                configurable: false
            }
        );
    }

    static get tag(): Uint8Array { return new Uint8Array([ 0b0000_0011 ]); }

    clone(): IRConst
    {
        return new IRConst( this.type, this.value );
    }

    toJson(): any
    {
        return {
            type: "IRConst",
            constType: termTypeToString( this.type ),
            value: constValueToJson( this.value )
        }
    }

    static get unit(): IRConst
    {
        return new IRConst( unit, undefined );
    }

    static bool( b: boolean ): IRConst
    {
        return new IRConst( bool, b );
    }

    static byteString( b: ByteString | Uint8Array ): IRConst
    {
        return new IRConst( bs, b );
    }

    static int( n: number | bigint ): IRConst
    {
        return new IRConst( int, n );
    }

    static str( string: string ): IRConst
    {
        return new IRConst( str, string );
    }

    static data( d: Data ): IRConst
    {
        return new IRConst( data, d );
    }

    static listOf( t: TermType ): ( vals: IRConstValue[] ) => IRConst
    {
        return ( vals: IRConstValue[] ) => new IRConst( list( t ), vals );
    }

    static pairOf( a: TermType, b: TermType ): ( fst: IRConstValue, snd: IRConstValue ) => IRConst
    {
        return ( fst: IRConstValue, snd: IRConstValue ) => new IRConst( pair( a, b ), new Pair( fst, snd ) )
    }
}


function inferConstValueT( value: IRConstValue ): GenericTermType
{
    if( typeof value === "undefined" || value === null ) return unit;
    if( isConstValueInt( value ) || canBeUInteger( value ) ) return int;

    if(
        value instanceof Uint8Array ||
        value instanceof ByteString
    ) return bs;

    if( typeof value === "string" ) return str;
    if( typeof value === "boolean" ) return bool;

    if( isIRConstValueList( value ) )
    {
        if( value.length === 0 ) return list( tyVar() );

        return list( inferConstValueT( value[0] ) )
    }

    if( value instanceof Pair )
    {
        return pair( inferConstValueT( value.fst ), inferConstValueT( value.snd ) );
    }

    if( isData( value ) ) return data

    throw new BasePlutsError(
        "invalid IRConstValue passed to inferConstValueT"
    );
}

function isIRConstValueList( value: any ): value is IRConstValue[]
{
    if(!Array.isArray( value )) return false;

    if( value.length === 0 ) return true;

    const elemsT = inferConstValueT( value[0] );

    return value.every( elem => isIRConstValueAssignableToType( elem, elemsT ) )
}

function isIRConstValueAssignableToType( value: IRConstValue, t: GenericTermType ): boolean
{
    if( t[0] === PrimType.Alias ) return isIRConstValueAssignableToType( value, t[1] ); 
    if(
        t[0] === PrimType.AsData ||
        t[0] === PrimType.Struct ||
        t[0] === PrimType.Data
    ) return isData( value );

    if( t[0] === PrimType.List )
    {
        return (
            Array.isArray( value ) &&
            value.every( v => isIRConstValueAssignableToType( v, t[1] ) )
        );
    }

    if( t[0] === PrimType.Pair )
    {
        return (
            value instanceof Pair &&
            isIRConstValueAssignableToType( value.fst, t[1] ) &&
            isIRConstValueAssignableToType( value.snd, t[2] )
        )
    }
    
    return typeExtends(
        inferConstValueT( value ),
        t
    )
}

export function isIRConstValue( value: any ): boolean
{
    return (
        typeof value === "undefined" ||
        canBeUInteger( value ) ||
        value instanceof Uint8Array ||
        value instanceof ByteString ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        isIRConstValueList( value ) ||
        (
            value instanceof Pair &&
            isIRConstValue( value.fst ) &&
            isIRConstValue( value.snd )
        ) || 
        isData( value )
    );
}

function constValueToJson( value: any ): any
{
    if( canBeUInteger( value ) ) return forceBigUInt( value ).toString();
    if( value instanceof Uint8Array ) return toHex( value );
    if( value instanceof ByteString ) return value.toString();
    if( isIRConstValueList( value ) ) return value.map( constValueToJson );
    if( value instanceof Pair ) return { fst: constValueToJson( value.fst ), snd: constValueToJson( value.snd ) };
    if( isData( value ) ) return value.toJson();

    return value;
}

function serializeIRConstValue( value: any, t: TermType ): Uint8Array
{
    if( t[0] === PrimType.Alias ) return serializeIRConstValue( value, t[1] );
    if( value === undefined || t[0] === PrimType.Unit ) return new Uint8Array(0);
    if( t[0] === PrimType.Int )
    {
        return positiveBigIntAsBytes(
            // forceBigUInt(
                UPLCFlatUtils.zigzagBigint(
                    BigInt( value )
                )
            // )
        )
    }

    if( t[0] === PrimType.BS )
    {
        if( value instanceof Uint8Array ) return value.slice();
        if( value instanceof ByteString ) return value.toBuffer();
    }

    if( t[0] === PrimType.Str ) return fromUtf8( value );

    if( t[0] === PrimType.Bool ) return new Uint8Array([value ? 1 : 0]);

    if( t[0] === PrimType.List )
    return concatUint8Arr(
        ...(value as any[]).map( stuff =>
            serializeIRConstValue( stuff, t[1] )
        )
    );

    if( t[0] === PrimType.Pair )
    {
        return concatUint8Arr(
            serializeIRConstValue( value.fst, t[1] ),
            serializeIRConstValue( value.snd, t[2] ),
        )
    }

    if( typeExtends( t, data ) ) // include structs or `asData`
    {
        return dataToCbor( value ).toBuffer();
    }

    console.log( "unexpected value calling 'serializeIRConstValue'", value );
    console.log( termTypeToString( t ) )
    console.log( value );
    console.log( value instanceof ByteString );
    console.log( value instanceof Uint8Array );
    throw "hello";
    throw new BasePlutsError(
        "unexpected value calling 'serializeIRConstValue'"
    );
}