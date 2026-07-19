import MagicString from 'magic-string';
import { parseAstAsync } from 'vite';
import { findCompoundObjectProperties, findLocalDeclarations } from './exports.js';
/**
 * Core enrichment logic: prepend `export` to local declarations referenced by
 * compound object exports. Returns `null` if no changes are needed.
 *
 * @param code - The source code (positions must match `ast` positions)
 * @param ast - Parsed AST whose node positions correspond to `code`
 */
function enrichSourceImpl(code, ast) {
    // 1. Walk ast.body looking for ExportNamedDeclaration → VariableDeclaration with ObjectExpression init
    const compoundNames = [];
    for (const node of ast.body) {
        if (node.type !== 'ExportNamedDeclaration')
            continue;
        const decl = node.declaration;
        if (!decl || decl.type !== 'VariableDeclaration')
            continue;
        if (decl.declarations.length !== 1)
            continue;
        const d = decl.declarations[0];
        if (d.id.type !== 'Identifier')
            continue;
        if (!d.init || d.init.type !== 'ObjectExpression')
            continue;
        compoundNames.push(d.id.name);
    }
    if (compoundNames.length === 0)
        return null;
    // 2 & 3. Collect all property names across all compounds
    const allPropNames = [];
    for (const name of compoundNames) {
        const props = findCompoundObjectProperties(ast, name);
        allPropNames.push(...props);
    }
    if (allPropNames.length === 0)
        return null;
    // 4 & 5. Look up local declarations
    const declarations = findLocalDeclarations(ast, allPropNames);
    // Collect non-exported declaration positions
    const toExport = [];
    for (const [, info] of declarations) {
        if (!info.hasExport) {
            toExport.push({ start: info.start });
        }
    }
    if (toExport.length === 0)
        return null;
    // 6. Process in reverse start order to avoid offset invalidation
    toExport.sort((a, b) => b.start - a.start);
    const s = new MagicString(code);
    for (const { start } of toExport) {
        s.appendLeft(start, 'export ');
    }
    return s.toString();
}
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
export function enrichComponentSource(code, ast) {
    return enrichSourceImpl(code, ast);
}
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
export async function enrichComponentSourceWithTS(rawCode, fileName) {
    const lang = fileName
        ? fileName.endsWith('.tsx') ? 'tsx' : fileName.endsWith('.ts') ? 'ts' : undefined
        : undefined;
    const ast = await parseAstAsync(rawCode, lang ? { lang } : undefined);
    return enrichSourceImpl(rawCode, ast);
}
//# sourceMappingURL=component-enrich.js.map