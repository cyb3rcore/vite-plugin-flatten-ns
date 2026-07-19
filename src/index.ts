import type { Plugin } from 'vite'
import { parseAstAsync, createFilter } from 'vite'
import { readFileSync } from 'node:fs'
import { enrichComponentSourceWithTS } from './component-enrich.js'
import { flattenBarrelSource } from './barrel-transform.js'

export type FlattenNsOptions = {
  include?: string[]
  includeComponents?: string[]
  keepNamespaceExports?: boolean
}

/** Cache for Pass-1-enriched source code, keyed by resolved file path. */
const enrichedCache = new Map<string, string>()

/** Strip Vite query/version parameters from a file id. */
function cleanId(id: string): string {
  return id.split('?')[0]
}

/**
 * Strip TypeScript syntax so Rollup's JS-only parser doesn't choke.
 * Uses esbuild which is guaranteed present (Vite dependency).
 * Uses `jsx: 'automatic'` so JSX compiles to `jsx()` from react/jsx-runtime
 * rather than `React.createElement` (which would cause React-not-defined errors).
 */
let _esbuild: any | undefined
async function getEsbuild() {
  if (!_esbuild) {
    _esbuild = await import('esbuild')
  }
  return _esbuild
}

async function stripTS(code: string, id: string): Promise<string> {
  if (!id.endsWith('.ts') && !id.endsWith('.tsx')) return code
  try {
    const esbuild = await getEsbuild()
    const result = esbuild.transformSync(code, {
      loader: id.endsWith('.tsx') ? 'tsx' : 'ts',
      jsx: 'automatic',
      jsxImportSource: 'react',
    })
    return result.code
  } catch {
    return code
  }
}

/** Parse code to AST, stripping TS first if needed. Returns both JS code and AST. */
async function parseAsJS(code: string, id: string): Promise<{ jsCode: string; ast: import('estree').Program }> {
  const jsCode = await stripTS(code, id)
  const ast = await parseAstAsync(jsCode)
  return { jsCode, ast }
}

export function flattenNamespaceExports(options: FlattenNsOptions = {}): Plugin {
  const {
    include = ['**/components/ui/index.ts', '**/ui/index.ts'],
    includeComponents,
    keepNamespaceExports = true,
  } = options

  const isBarrel = createFilter(include)
  const isComponent = createFilter(
    includeComponents ?? include.map(p => p.replace('/index.ts', '/**/*.tsx').replace('/index.tsx', '/**/*.tsx'))
  )

  return {
    name: 'flatten-ns',
    enforce: 'pre',

    async transform(code: string, id: string) {
      if (id.includes('node_modules')) return

      const hasNamespaceExports = code.includes('export * as')
      const hasNamedReExports = code.includes('} from')

      // Pass 2: Barrel flattening (handles export * as AND export { X } patterns)
      if (isBarrel(id) && (hasNamespaceExports || hasNamedReExports)) {
        const { jsCode, ast } = await parseAsJS(code, id)
        const seen = new Set<string>()

        const result = await flattenBarrelSource(
          jsCode, ast,
          async (source, importer) => {
            const r = await this.resolve(source, importer)
            const resolved = r?.id ?? null
            if (resolved && seen.has(resolved)) {
              this.warn(`circular re-export detected: ${source} from ${importer}`)
              return null
            }
            if (resolved) seen.add(resolved)
            return resolved
          },
          // Load module code — check enriched cache first, fall back to fs read
          // this.load() is not available in the transform hook, so we read files directly.
          async (resolvedId) => {
            const clean = cleanId(resolvedId)
            const cached = enrichedCache.get(clean)
            if (cached) return { code: cached }
            try {
              const raw = readFileSync(clean, 'utf-8')
              // If this module is a component file that hasn't been enriched yet,
              // enrich it inline now so Pass 2 sees the named exports.
              if (isComponent(clean)) {
                const enriched = await enrichComponentSourceWithTS(raw, clean)
                if (enriched) {
                  enrichedCache.set(clean, enriched)
                  return { code: enriched }
                }
              }
              return { code: raw }
            } catch {
              return null
            }
          },
          id,
          (msg: string) => this.warn(msg),
          // Parse loaded modules as JS (strips TS first — uses moduleId for correct ts/tsx loader)
          async (moduleCode, moduleId) => (await parseAsJS(moduleCode, moduleId)).ast,
        )
        if (result) return { code: result, map: { mappings: '' } }
      }

      // Pass 1: Component enrichment — use TS-native parser so generic syntax positions are correct
      if (isComponent(id)) {
        const result = await enrichComponentSourceWithTS(code, id)
        if (result) {
          enrichedCache.set(cleanId(id), result)
          return { code: result, map: { mappings: '' } }
        }
      }
    },
  }
}
