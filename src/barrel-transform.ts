import type { ExportAllDeclaration, Program } from 'estree'
import { parseAstAsync } from 'vite'
import MagicString from 'magic-string'
import { extractNamedValueExports } from './exports.js'

type ResolveResult = string | { id: string } | null
type LoadResult = { code: string } | null

function getId(resolved: Exclude<ResolveResult, null>): string {
  return typeof resolved === 'string' ? resolved : resolved.id
}

function isNsExport(node: unknown): node is ExportAllDeclaration & {
  exported: { type: 'Identifier'; name: string }
  source: { type: 'Literal'; value: string }
  start: number
  end: number
} {
  if (!node || typeof node !== 'object') return false
  const n = node as Record<string, unknown>
  return (
    n.type === 'ExportAllDeclaration' &&
    n.exported != null &&
    typeof n.exported === 'object' &&
    (n.exported as Record<string, unknown>).type === 'Identifier' &&
    n.source != null &&
    typeof n.source === 'object' &&
    (n.source as Record<string, unknown>).type === 'Literal'
  )
}

/**
 * Flatten `export * as Namespace` re-exports into individual flat named exports.
 *
 * For each `export * as Foo from './bar'`, finds all value exports from `./bar`
 * and generates `export { Baz as FooBaz } from './bar'` lines injected after
 * each namespace export.
 *
 * Detects flat name collisions across all namespaces and warns on duplicates.
 *
 * @returns Modified source code string, or `null` if no `export * as` declarations are found.
 */
export async function flattenBarrelSource(
  code: string,
  ast: Program,
  resolve: (source: string, importer: string) => Promise<ResolveResult>,
  load: (id: string) => Promise<LoadResult>,
  importer: string,
  warn?: (msg: string) => void,
  parseModule?: (code: string, moduleId: string) => Promise<Program>,
): Promise<string | null> {
  // Find all export * as <name> declarations
  const nsExports = ast.body.filter(isNsExport)

  if (nsExports.length === 0) return null

  // Track flat name → namespace name for collision detection
  const flatNamesMap = new Map<string, string>()
  const s = new MagicString(code)
  let changed = false

  for (const node of nsExports) {
    const nsName = node.exported.name
    const source = node.source.value as string

    // Resolve the module specifier
    const resolved = await resolve(source, importer)
    if (!resolved) continue

    const resolvedId = getId(resolved)

    // Load the target module
    const loaded = await load(resolvedId)
    if (!loaded) continue

    // Parse the loaded module's AST (using custom parser if provided, e.g. for TS stripping)
    let moduleAst: Program
    try {
      moduleAst = parseModule
        ? await parseModule(loaded.code, resolvedId)
        : await parseAstAsync(loaded.code)
    } catch {
      // If parsing fails, skip this namespace
      continue
    }

    // Extract named value exports from the target module
    const names = extractNamedValueExports(moduleAst)

    // Filter out the namespace name itself (avoids self-referencing)
    const filtered = names.filter(name => name !== nsName)

    if (filtered.length === 0) continue

    // Build specifiers for the flat export, checking for collisions
    const specifiers: string[] = []
    for (const name of filtered) {
      // If the export name already starts with the namespace name, use as-is
      // (e.g., BentoGridRoot from BentoGrid namespace — likely from Pass 1 enrichment).
      // Otherwise, prepend the namespace (e.g., Root → BentoGridRoot).
      const flatName = name.startsWith(nsName)
        ? name
        : nsName + name[0].toUpperCase() + name.slice(1)

      const existing = flatNamesMap.get(flatName)
      if (existing) {
        warn?.(
          `Flat export name "${flatName}" collides: namespace "${existing}" and "${nsName}" ` +
          `both produce "${flatName}" (from original name "${name}"). Skipping duplicate.`
        )
        continue
      }
      flatNamesMap.set(flatName, nsName)
      specifiers.push(`${name} as ${flatName}`)
    }

    if (specifiers.length === 0) continue

    // Inject the flat export after the * as declaration
    const flatExport = `\nexport { ${specifiers.join(', ')} } from '${source}';`
    s.appendLeft(node.end, flatExport)
    changed = true
  }

  return changed ? s.toString() : null
}
