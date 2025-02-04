import { CommonFlags } from "../../../../common";
import { SourceRange } from "../../../Source/SourceRange";
import { Identifier } from "../../common/Identifier";
import { ArrowKind } from "../../expr/functions/ArrowKind";
import { PebbleExpr } from "../../expr/PebbleExpr";
import { HasSourceRange } from "../../HasSourceRange";
import { BlockStmt } from "../BlockStmt";
import { NamedType } from "../../types/NamedType";
import { FuncType } from "../../types/NativeType";

export class FuncDecl
    implements HasSourceRange
{
    constructor(
        readonly name: Identifier,
        readonly flags: CommonFlags,
        readonly typeParams: NamedType[],
        readonly signature: FuncType,
        readonly body: BlockStmt | PebbleExpr,
        readonly arrowKind: ArrowKind,
        readonly range: SourceRange,
    ) {}
}