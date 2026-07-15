import type { Plugin } from 'vite'
import { parseAstAsync, createFilter } from 'vite'
import { enrichComponentSource } from './component-enrich.js'
import { flattenBarrelSource } from './barrel-transform.js'

export type FlattenNsOptions = {
  include?: string[]
  includeComponents?: string[]
  keepNamespaceExports?: boolean
}

/**
 * Strip TypeScript syntax so Rollup's JS-only parser doesn't choke.
 * Uses esbuild which is guaranteed present (Vite dependency).
 */
let _esbuild: any | undefined
async function getEsbuild() {
  if (!_esbuild) {
    // Dynamic import — require() is not available in ESM context
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

      // Pass 2: Barrel flattening
      if (hasNamespaceExports && isBarrel(id)) {
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
          async (resolvedId) => {
            try {
              const loaded = await this.load({ id: resolvedId })
              if (!loaded || !loaded.code) return null
              return { code: loaded.code }
            } catch { return null }
          },
          id,
          (msg: string) => this.warn(msg),
          // Parse loaded modules as JS (strips TS first)
          async (moduleCode) => (await parseAsJS(moduleCode, id)).ast,
        )
        if (result) return { code: result, map: { mappings: '' } }
      }

      // Pass 1: Component enrichment
      if (isComponent(id)) {
        const { jsCode, ast } = await parseAsJS(code, id)
        const result = enrichComponentSource(jsCode, ast)
        if (result) return { code: result, map: { mappings: '' } }
      }
    },
  }
}
