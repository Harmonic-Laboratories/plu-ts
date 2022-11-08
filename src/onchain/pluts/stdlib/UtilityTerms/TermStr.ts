import { pappendStr, pencodeUtf8, peqStr } from "../Builtins";
import ObjectUtils from "../../../../utils/ObjectUtils";
import PString from "../../PTypes/PString";
import Term from "../../Term";
import TermBS from "./TermBS";
import { TermFn } from "../../PTypes/PFn/PLam";
import PBool from "../../PTypes/PBool";
import TermBool from "./TermBool";

type TermStr = Term<PString> 
& {
    readonly utf8Encoded: TermBS
    
    // pappendStr
    readonly concatTerm:    TermFn<[ PString ], PString>
    readonly concat:        ( other: Term<PString> ) => TermStr

    readonly eqTerm:    TermFn<[ PString ], PBool >
    readonly eq:        ( other: Term<PString> ) => TermBool
}

export default TermStr;

export function addPStringMethods( term: Term<PString> ): TermStr
{
    ObjectUtils.defineReadOnlyProperty(
        term,
        "utf8Encoded",
        pencodeUtf8.$( term )
    );

    ObjectUtils.defineReadOnlyProperty(
        term,
        "concatTerm",
        pappendStr.$( term )
    );
    ObjectUtils.defineReadOnlyProperty(
        term,
        "concat",
        ( other: Term<PString> ): TermStr => pappendStr.$( term ).$( other )
    );

    ObjectUtils.defineReadOnlyProperty(
        term,
        "eqTerm",
        peqStr.$( term )
    );
    ObjectUtils.defineReadOnlyProperty(
        term,
        "eq",
        ( other: Term<PString> ): TermBool => peqStr.$( term ).$( other )
    );

    return term as any;
}