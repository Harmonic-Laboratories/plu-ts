import { IRApp } from "./IRNodes/IRApp";
import { IRConst } from "./IRNodes/IRConst";
import { IRFunc } from "./IRNodes/IRFunc";
import { IRHoisted } from "./IRNodes/IRHoisted";
import { IRLetted } from "./IRNodes/IRLetted";
import { IRNative } from "./IRNodes/IRNative";
import { IRError } from "./IRNodes/IRError";
import { IRDelayed } from "./IRNodes/IRDelayed";
import { IRForced } from "./IRNodes/IRForced";
import { IRVar } from "./IRNodes/IRVar";
import { IRConstr } from "./IRNodes/IRConstr";
import { IRCase } from "./IRNodes/IRCase";
import { IRRecursive } from "./IRNodes/IRRecursive";
import { IRSelfCall } from "./IRNodes/IRSelfCall";

export type IRTerm
    = IRVar
    | IRFunc
    | IRApp
    | IRConst
    | IRNative
    | IRLetted
    | IRHoisted
    | IRError
    | IRForced
    | IRDelayed
    | IRConstr
    | IRCase
    | IRRecursive
    | IRSelfCall;