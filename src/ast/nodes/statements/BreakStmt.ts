import { SourceRange } from "../../Source/SourceRange";
import { Identifier } from "../common/Identifier";
import { HasSourceRange } from "../HasSourceRange";


export class BreakStmt
    implements HasSourceRange
{
    constructor(
        readonly loopName: Identifier | undefined,
        readonly range: SourceRange,
    ) {}
}