import type { Program, Pattern, AssignmentProperty } from 'estree'

/**
 * Extract identifier names from a destructuring pattern.
 * Handles Identifier, ObjectPattern, and ArrayPattern.
 */
export function extractNames(node: Pattern): string[] {
  if (node.type === 'Identifier') {
    return [node.name]
  }
  if (node.type === 'ObjectPattern') {
    return node.properties
      .filter((prop): prop is AssignmentProperty => prop.type === 'Property')
      .flatMap(prop => extractNames(prop.value))
  }
  if (node.type === 'ArrayPattern') {
    return node.elements.filter((el): el is Pattern => el !== null).flatMap(extractNames)
  }
  // RestElement and AssignmentPattern — ignore
  return []
}

/**
 * Return the names of all value (non-type) export declarations at module scope.
 * Handles:
 *  - export const/let/var
 *  - export function / export class
 *  - export { a, b } / export { a, b } from './x'
 * Skips:
 *  - export type { ... }
 *  - export * / export * as
 */
export function extractNamedValueExports(ast: Program): string[] {
  const names: string[] = []

  for (const node of ast.body) {
    if (node.type !== 'ExportNamedDeclaration') continue

    // Skip type-only exports at the declaration level
    if ((node as { exportKind?: 'type' | 'value' }).exportKind === 'type') continue

    const decl = node.declaration

    if (decl) {
      if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations) {
          names.push(...extractNames(d.id))
        }
      } else if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
        if (decl.id) names.push(decl.id.name)
      }
    } else if (node.specifiers) {
      // export { a, b } or export { a, b } from './x'
      for (const spec of node.specifiers) {
        if (spec.type === 'ExportSpecifier') {
          // Handle inline type qualifier on individual specifiers
          if ((spec as { exportKind?: 'type' | 'value' }).exportKind === 'type') continue
          if (spec.exported.type === 'Identifier') {
            names.push(spec.exported.name)
          }
        }
      }
    }
  }

  return [...new Set(names)]
}

/**
 * Find property names inside an exported object expression.
 * Given `export const X = { Root, Header }`, returns ['Root', 'Header'].
 * Only returns non-computed, non-spread Identifier property keys.
 */
export function findCompoundObjectProperties(ast: Program, namespaceName: string): string[] {
  for (const node of ast.body) {
    if (node.type !== 'ExportNamedDeclaration') continue

    const decl = node.declaration
    if (!decl || decl.type !== 'VariableDeclaration') continue
    if (decl.declarations.length !== 1) continue

    const d = decl.declarations[0]
    if (d.id.type !== 'Identifier' || d.id.name !== namespaceName) continue
    if (!d.init || d.init.type !== 'ObjectExpression') continue

    return d.init.properties.flatMap(prop => {
      if (prop.type === 'SpreadElement') return []
      if (prop.computed) return []
      if (prop.type === 'Property' && prop.key.type === 'Identifier') {
        // For shorthand { Root }, key === value name
        // For { Root: BentoGridRoot }, use the VALUE identifier (the actual variable name)
        if (prop.shorthand || prop.value.type === 'Identifier') {
          return [prop.value.type === 'Identifier' ? prop.value.name : prop.key.name]
        }
      }
      return []
    })
  }

  return []
}

/**
 * Find module-scope variable/function/class declarations matching the given names.
 * Returns position info and whether the declaration is exported.
 * Only checks `ast.body` (module scope) — skips block-scoped declarations.
 */
// Rollup/Vite AST nodes include start/end via RollupAstNode,
// but @types/estree doesn't define them. Cast through unknown.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type NodePos = { start: number; end: number }

export function findLocalDeclarations(
  ast: Program,
  names: string[]
): Map<string, { start: number; end: number; hasExport: boolean }> {
  const targetSet = new Set(names)
  const result = new Map<string, { start: number; end: number; hasExport: boolean }>()

  for (const node of ast.body) {
    if (node.type === 'ExportNamedDeclaration') {
      const decl = node.declaration
      if (!decl) continue

      if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations) {
          for (const name of extractNames(d.id)) {
            if (targetSet.has(name) && !result.has(name)) {
              result.set(name, { start: (decl as unknown as NodePos).start, end: (decl as unknown as NodePos).end, hasExport: true })
            }
          }
        }
      } else if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
        if (decl.id && targetSet.has(decl.id.name) && !result.has(decl.id.name)) {
          result.set(decl.id.name, { start: (decl as unknown as NodePos).start, end: (decl as unknown as NodePos).end, hasExport: true })
        }
      }
    } else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        for (const name of extractNames(d.id)) {
          if (targetSet.has(name) && !result.has(name)) {
            result.set(name, { start: (node as unknown as NodePos).start, end: (node as unknown as NodePos).end, hasExport: false })
          }
        }
      }
    } else if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      if (node.id && targetSet.has(node.id.name) && !result.has(node.id.name)) {
        result.set(node.id.name, { start: (node as unknown as NodePos).start, end: (node as unknown as NodePos).end, hasExport: false })
      }
    }
  }

  return result
}
