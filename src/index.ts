import type { Plugin } from 'vite'
import { parseAstAsync, createFilter } from 'vite'
import { enrichComponentSource } from './component-enrich.js'
import { flattenBarrelSource } from './barrel-transform.js'

export type FlattenNsOptions = {
  include?: string[]
  includeComponents?: string[]
  keepNamespaceExports?: boolean
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

      const ast = await parseAstAsync(code)
      const hasNamespaceExports = code.includes('export * as')

      // Pass 2: Barrel flattening — uses include filter, not hardcoded heuristic
      if (hasNamespaceExports && isBarrel(id)) {
        // Track resolved IDs to detect circular re-exports
        const seen = new Set<string>()

        const result = await flattenBarrelSource(
          code, ast,
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
          // Pass warn function for name collision warnings
          (msg: string) => this.warn(msg),
        )
        if (result) return { code: result, map: { mappings: '' } }
      }

      // Pass 1: Component enrichment — only for component files matching includeComponents
      if (isComponent(id)) {
        const result = enrichComponentSource(code, ast)
        if (result) return { code: result, map: { mappings: '' } }
      }
    },
  }
}
