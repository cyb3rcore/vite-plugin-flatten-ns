import { parseAstAsync } from 'vite';
import MagicString from 'magic-string';
import { extractNamedValueExports, findCompoundObjectProperties } from './exports.js';
function getId(resolved) {
    return typeof resolved === 'string' ? resolved : resolved.id;
}
function isNsExport(node) {
    if (!node || typeof node !== 'object')
        return false;
    const n = node;
    return (n.type === 'ExportAllDeclaration' &&
        n.exported != null &&
        typeof n.exported === 'object' &&
        n.exported.type === 'Identifier' &&
        n.source != null &&
        typeof n.source === 'object' &&
        n.source.type === 'Literal');
}
/**
 * Check if a node is `export { X } from './module'` (named specifier re-export
 * without an alias, where the specifier name equals the exported name).
 */
function isNamedReExport(node) {
    if (!node || typeof node !== 'object')
        return false;
    const n = node;
    if (n.type !== 'ExportNamedDeclaration')
        return false;
    if (!n.source || n.source.type !== 'Literal')
        return false;
    if (!Array.isArray(n.specifiers))
        return false;
    // Only handle specifiers without aliasing: export { X } — where local === exported
    return n.specifiers.every((s) => s?.type === 'ExportSpecifier' &&
        s.local?.type === 'Identifier' &&
        s.exported?.type === 'Identifier' &&
        s.local.name === s.exported.name);
}
/**
 * Given a module's AST and a namespace name, return the individual export names
 * from a compound object if the module exports one.
 *
 * For `export const BentoGrid = { Root: BentoGridRoot, Item: BentoGridItem }`:
 * returns `['BentoGridRoot', 'BentoGridItem']` — the VALUE identifier names
 * (not the property keys).
 */
function findCompoundValueNames(ast, namespaceName) {
    // findCompoundObjectProperties returns property VALUE names (fixed for non-shorthand)
    return findCompoundObjectProperties(ast, namespaceName);
}
/**
 * Flatten `export * as Namespace` AND `export { Namespace } from './module'`
 * re-exports into individual flat named exports.
 *
 * Handles two patterns:
 * 1. `export * as Card from './card'` — flattens all named exports
 * 2. `export { BentoGrid } from './bento-grid'` — detects compound object,
 *    resolves its property values, injects flat re-exports for each
 *
 * Detects flat name collisions across all namespaces and warns on duplicates.
 *
 * @returns Modified source code string, or `null` if nothing to flatten.
 */
export async function flattenBarrelSource(code, ast, resolve, load, importer, warn, parseModule) {
    // Find all export * as <name> declarations
    const nsExports = ast.body.filter(isNsExport);
    // Find all export { X } from './module' declarations
    const namedExports = ast.body.filter(isNamedReExport);
    if (nsExports.length === 0 && namedExports.length === 0)
        return null;
    // Track flat name → namespace name for collision detection
    const flatNamesMap = new Map();
    const s = new MagicString(code);
    let changed = false;
    // ── Helper: load + parse a module ─────────────────────────────────
    async function loadModule(source, importer) {
        const resolved = await resolve(source, importer);
        if (!resolved)
            return null;
        const resolvedId = getId(resolved);
        const loaded = await load(resolvedId);
        if (!loaded)
            return null;
        try {
            const moduleAst = parseModule
                ? await parseModule(loaded.code, resolvedId)
                : await parseAstAsync(loaded.code);
            return { ast: moduleAst, resolvedId };
        }
        catch {
            return null;
        }
    }
    // ── Helper: inject flat exports ───────────────────────────────────
    function injectFlats(node, source, names, nsName) {
        const specifiers = [];
        for (const name of names) {
            const flatName = name.startsWith(nsName)
                ? name
                : nsName + name[0].toUpperCase() + name.slice(1);
            const existing = flatNamesMap.get(flatName);
            if (existing) {
                warn?.(`Flat export name "${flatName}" collides: namespace "${existing}" and "${nsName}". Skipping.`);
                continue;
            }
            flatNamesMap.set(flatName, nsName);
            specifiers.push(`${name} as ${flatName}`);
        }
        if (specifiers.length === 0)
            return;
        const flatExport = `\nexport { ${specifiers.join(', ')} } from '${source}';`;
        s.appendLeft(node.end, flatExport);
        changed = true;
    }
    // ── Pass 1: export * as Namespace from './module' ──────────────
    for (const node of nsExports) {
        const nsName = node.exported.name;
        const source = node.source.value;
        const loaded = await loadModule(source, importer);
        if (!loaded)
            continue;
        const names = extractNamedValueExports(loaded.ast);
        const filtered = names.filter(name => name !== nsName);
        if (filtered.length === 0)
            continue;
        injectFlats(node, source, filtered, nsName);
    }
    // ── Pass 2: export { Name } from './module' (compound object detection) ─
    for (const node of namedExports) {
        const source = node.source.value;
        const loaded = await loadModule(source, importer);
        if (!loaded)
            continue;
        for (const spec of node.specifiers) {
            const nsName = spec.local.name;
            // Check if the target module exports a compound object with this name
            const compoundProps = findCompoundValueNames(loaded.ast, nsName);
            if (compoundProps.length === 0)
                continue;
            // The compound property values should be individually exported
            // (either naturally or via Pass 1 inline enrichment).
            const allExports = extractNamedValueExports(loaded.ast);
            const available = compoundProps.filter(p => allExports.includes(p));
            if (available.length === 0)
                continue;
            injectFlats(node, source, available, nsName);
        }
    }
    return changed ? s.toString() : null;
}
//# sourceMappingURL=barrel-transform.js.map