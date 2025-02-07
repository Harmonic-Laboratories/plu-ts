import { FuncDecl } from "../../ast/nodes/statements/declarations/FuncDecl";
import { ExportStarStmt } from "../../ast/nodes/statements/ExportStarStmt";
import { ImportStarStmt } from "../../ast/nodes/statements/ImportStarStmt";
import { ImportStmt } from "../../ast/nodes/statements/ImportStmt";
import { PebbleStmt } from "../../ast/nodes/statements/PebbleStmt";
import { Source, SourceKind } from "../../ast/Source/Source";
import { SourceRange } from "../../ast/Source/SourceRange";
import { extension } from "../../common";
import { DiagnosticEmitter } from "../../diagnostics/DiagnosticEmitter";
import { DiagnosticMessage } from "../../diagnostics/DiagnosticMessage";
import { DiagnosticCode } from "../../diagnostics/diagnosticMessages.generated";
import { CompilerOptions } from "../../IR/toUPLC/CompilerOptions";
import { Parser } from "../../parser/Parser";
import { CompilerIoApi, createMemoryCompilerIoApi } from "../io/CompilerIoApi";
import { IPebbleCompiler } from "../IPebbleCompiler";
import { getInternalPath, Path, resolveProjAbsolutePath } from "../path/path";
import { ResolveStackNode } from "./ResolveStackNode";
import { Scope } from "./scope/Scope";

/**
 * compiles Pebble AST to Typed IR.
 * 
 * AST -> TIR
 * 
 * The AST is simply the result of tokenization and parsing.
 * 
 * Therefore the AST is only syntactically correct, but not necessarily semantically correct.
 * 
 * During the compilation from AST to TIR,
 * missign types are inferred and the resulting TIR is checked for semantic correctness.
 * 
 * In short, here is where type checking happens.
 */
export class AstCompiler extends DiagnosticEmitter
    implements IPebbleCompiler
{
    /** 
     * The standard library scope.
     * 
     * (ScriptContext, built-in functions, etc.)
    **/
    readonly stdScope: Scope;

    constructor(
        readonly cfg: CompilerOptions,
        readonly io: CompilerIoApi = createMemoryCompilerIoApi({ useConsoleAsOutput: true }),
        readonly rootPath: string = "/",
        diagnostics?: DiagnosticMessage[]
    )
    {
        super( diagnostics );
    }

    // readonly depGraph = new DependencyGraph();
    // readonly exportedSymbols = new Map<string, Source>();

    async compileFile(
        path: string,
        srcText: string | undefined = undefined,
        isEntry: boolean = true
    )
    {
        const internalPath = getInternalPath( path );
        srcText = srcText ?? await this.io.readFile( internalPath, this.rootPath );
        if( !srcText )
        {
            this.error(
                DiagnosticCode.File_0_not_found,
                undefined, path
            );
            return;
        }
        const src = new Source(
            SourceKind.User,
            internalPath,
            srcText
        );

        return this.compileSource( src );
    }

    async compileSource( src: Source )
    {
        await this._checkCircularDependencies( src );

        await this.compileEntryFileStmts( src.statements );

        return this.diagnostics;
    }

    async compileEntryFileStmts( src: PebbleStmt[] )
    {
        const mainFunc = src.find( stmt => {
            stmt instanceof FuncDecl
        })
    }

    async checkCircularDependencies( src: Source | Path ): Promise<DiagnosticMessage[]>
    {
        if(!( src instanceof Source ))
        {
            src = src.toString();
            src = getInternalPath( src );
            src = (await this.sourceFromInternalPath( src ))!;
            if( !src ) return this.diagnostics;
        }
        await this._checkCircularDependencies( src );
        return this.diagnostics;
    }

    /** MUST NOT be used as a "seen" log */
    private readonly _sourceCache = new Map<string, Source>();
    async sourceFromInternalPath(
        internalPath: string
    ): Promise<Source | undefined>
    {
        const cached = this._sourceCache.get( internalPath );
        if( cached ) return cached;

        const srcText = await this.io.readFile( internalPath + extension, this.rootPath );
        if( !srcText )
        {
            console.log( internalPath );
            return this.error(
                DiagnosticCode.File_0_not_found,
                undefined, internalPath
            );
        }

        const src = new Source(
            SourceKind.User,
            internalPath,
            srcText
        );
        this._sourceCache.set( internalPath, src );
        return src;
    }
    sourceFromInternalPathSync(
        internalPath: string
    ): Source | undefined
    {
        return this._sourceCache.get( internalPath );
    }

    /**
     * 
     * @returns `true` if there were no errors. `false` otherwise.
     */
    private async _checkCircularDependencies(
        source: Source | ResolveStackNode
    ): Promise<boolean>
    {
        const src = source instanceof ResolveStackNode ? source.dependent : source;
        const resolveStack = source instanceof ResolveStackNode ? source : new ResolveStackNode( undefined, src );

        const isCycle = resolveStack.parent?.includesInternalPath( src.internalPath ) ?? false;

        if( isCycle )
        {
            const offendingPath = src.internalPath;
            let prevPath = offendingPath;
            let req: ResolveStackNode = resolveStack;
            const pathsInCycle: string[] = [];
            const seen = new Set<string>();

            // we go through the loop so we can signal the error
            // at every offending import
            while( req = req.parent! ) {
                const importStmt = req.dependent.statements.find( stmt => {
                    if( !isImportStmtLike( stmt ) ) return false;

                    const asRootPath = resolveProjAbsolutePath(
                        stmt.fromPath.string,
                        req.dependent.internalPath
                    );
                    if( !asRootPath ) return false;

                    return asRootPath === prevPath
                }) as ImportStmtLike | undefined;

                prevPath = getInternalPath( req.dependent.internalPath ); 
                if( !importStmt )
                {
                    this.error(
                        DiagnosticCode.Import_path_0_is_part_of_a_circular_dependency,
                        new SourceRange( req.dependent, 0, 0 ),
                        offendingPath
                    );
                    continue;
                }
                
                const thePath = importStmt.fromPath.string;
                const last = seen.has( thePath ) 
                
                if( !last )
                {
                    pathsInCycle.push( thePath );
                    seen.add( thePath );
                }

                pathsInCycle.push( thePath );
                this.error(
                    DiagnosticCode.Import_path_0_is_part_of_a_circular_dependency,
                    importStmt.range, thePath
                );
                if( last ) break;
            };

            // this.io.stderr.write(
            //     "Circular dependency detected:\n" +
            //     pathsInCycle.map( path => "  " + path ).join("\n") +
            //     "\n"
            // );
            return false;
        }

        const diagnostics = Parser.parseSource( src, [] );

        if( diagnostics.length > 0 )
        {
            for( const msg of diagnostics )
                this.emitDiagnosticMessage( msg );
            return false;
        }

        const stmts = src.statements;

        const imports = stmts.filter( isImportStmtLike );

        // const srcPath = src.internalPath;
        // const importPaths = this.importPathsFromStmts( imports, srcPath );
        // this.depGraph.addDependencies( srcPath, importPaths );

        return await this.checkCircularDependenciesDependencies(
            imports,
            resolveStack
        );
    }

    private importPathsFromStmts(
        stmts: ImportStmtLike[],
        requestingPath: string
    )
    {
        return stmts
        .map( imp => {
            const internalPath = resolveProjAbsolutePath(
                imp.fromPath.string,
                requestingPath
            );
            if( !internalPath )
            {
                this.error(
                    DiagnosticCode.File_0_not_found,
                    imp.fromPath.range, imp.fromPath.string
                );
                return "";
            }
            return getInternalPath( internalPath );
        })
        .filter( path => path !== "" );
    }

    async checkCircularDependenciesDependencies(
        imports: ImportStmtLike[],
        dependent: ResolveStackNode
    ): Promise<boolean>
    {
        const srcPath = dependent.dependent.internalPath;
        const paths = this.importPathsFromStmts( imports, srcPath );
        const sources = await Promise.all(
            paths.map( this.sourceFromInternalPath.bind( this ) )
        );
        
        for( const src of sources )
        {
             if( !src ) continue; // error already reported parsing import

            const resolveStack = new ResolveStackNode( dependent, src );
            if( !await this._checkCircularDependencies( resolveStack ) ) return false;
        }

        return true;
    }
}

type ImportStmtLike = ImportStarStmt | ImportStmt | ExportStarStmt;

function isImportStmtLike( stmt: any ): stmt is ImportStmtLike
{
    return (
        stmt instanceof ImportStmt
        || stmt instanceof ImportStarStmt
        || stmt instanceof ExportStarStmt
    );
}