import { SourceRange } from "../../../Source/SourceRange";
import { HasSourceRange } from "../../HasSourceRange";

export class FuncExpr implements HasSourceRange
{
    constructor(
        readonly decl: {},
        readonly range: SourceRange
    ) {}
}