import type { Program } from 'estree'
import MagicString from 'magic-string'
import { findCompoundObjectProperties, findLocalDeclarations } from './exports.js'

/**
 * Enrich component source by prepending `export` to local declarations
 * that are referenced by compound object exports.
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
export function enrichComponentSource(code: string, ast: Program): string | null {
  // 1. Walk ast.body looking for ExportNamedDeclaration → VariableDeclaration with ObjectExpression init
  const compoundNames: string[] = []
  for (const node of ast.body) {
    if (node.type !== 'ExportNamedDeclaration') continue
    const decl = node.declaration
    if (!decl || decl.type !== 'VariableDeclaration') continue
    if (decl.declarations.length !== 1) continue
    const d = decl.declarations[0]
    if (d.id.type !== 'Identifier') continue
    if (!d.init || d.init.type !== 'ObjectExpression') continue
    compoundNames.push(d.id.name)
  }

  if (compoundNames.length === 0) return null

  // 2 & 3. Collect all property names across all compounds
  const allPropNames: string[] = []
  for (const name of compoundNames) {
    const props = findCompoundObjectProperties(ast, name)
    allPropNames.push(...props)
  }

  if (allPropNames.length === 0) return null

  // 4 & 5. Look up local declarations
  const declarations = findLocalDeclarations(ast, allPropNames)

  // Collect non-exported declaration positions
  const toExport: { start: number; end: number }[] = []
  for (const [, info] of declarations) {
    if (!info.hasExport) {
      toExport.push({ start: info.start, end: info.end })
    }
  }

  if (toExport.length === 0) return null

  // 6. Process in reverse start order to avoid offset invalidation
  toExport.sort((a, b) => b.start - a.start)

  const s = new MagicString(code)
  for (const { start } of toExport) {
    s.appendLeft(start, 'export ')
  }

  return s.toString()
}
