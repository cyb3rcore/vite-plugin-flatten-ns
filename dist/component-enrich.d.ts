import type { Program } from 'estree';
/**
 * Enrich component source by prepending `export` to local declarations
 * that are referenced by compound object exports.
 *
 * Operates on a code string and its pre-parsed AST. The AST positions MUST
 * correspond to the `code` string (i.e., the code has NOT been TS-stripped
 * if the AST was produced by a TS-aware parser).
 *
 * For example, given:
 *   const Root = withProvider(ark.div, "root")
 *   export const Card = { Root }
 *
 * Returns:
 *   export const Root = withProvider(ark.div, "root")
 *   export const Card = { Root }
 *
 * Returns `null` if no changes were made.
 */
export declare function enrichComponentSource(code: string, ast: Program): string | null;
/**
 * Enrich component source from raw TypeScript/TSX code.
 *
 * Parses the code with Vite's `parseAstAsync`. In Vite 6, this used oxc directly
 * which handled TS by default. In Vite 8+, parseAstAsync delegates to Rolldown
 * which defaults to `lang: "js"` — pass the filename so the correct TS/TSX
 * language is selected via the options argument.
 *
 * Type annotations are preserved in the output.
 */
export declare function enrichComponentSourceWithTS(rawCode: string, fileName?: string): Promise<string | null>;
//# sourceMappingURL=component-enrich.d.ts.map