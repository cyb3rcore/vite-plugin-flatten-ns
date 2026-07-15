import { describe, test, expect } from 'vitest'
import { extractNamedValueExports, findCompoundObjectProperties, findLocalDeclarations } from '../src/exports.js'
import { parseAstAsync } from 'vite'
import { transformSync } from 'esbuild'

async function parse(code: string) {
  // esbuild strips TypeScript-only syntax (type exports, annotations, etc.)
  // that Rollup's JS-only parseAstAsync cannot handle
  const result = transformSync(code, { loader: 'ts', tsconfigRaw: {} })
  return parseAstAsync(result.code)
}

describe('extractNamedValueExports', () => {
  test('extracts export const declarations', async () => {
    const ast = await parse('export const Root = "div"\nexport const Header = "header"')
    expect(extractNamedValueExports(ast)).toEqual(['Root', 'Header'])
  })

  test('extracts export function declarations', async () => {
    const ast = await parse('export function Root() {}\nexport function Trigger() {}')
    expect(extractNamedValueExports(ast)).toEqual(['Root', 'Trigger'])
  })

  test('extracts export { ... } re-exports', async () => {
    const ast = await parse('export { Root, Trigger } from "./dialog"')
    expect(extractNamedValueExports(ast)).toEqual(['Root', 'Trigger'])
  })

  test('extracts named specifiers with aliases', async () => {
    const ast = await parse('export { default as Root } from "./dialog"')
    expect(extractNamedValueExports(ast)).toEqual(['Root'])
  })

  test('skips type-only exports', async () => {
    const ast = await parse('export type { RootProps } from "./dialog"\nexport const Root = "div"')
    expect(extractNamedValueExports(ast)).toEqual(['Root'])
  })

  test('skips export * as namespace re-exports', async () => {
    const ast = await parse('export * as Dialog from "./dialog"\nexport const Root = "div"')
    expect(extractNamedValueExports(ast)).toEqual(['Root'])
  })

  test('returns empty array for module with no value exports', async () => {
    const ast = await parse('export type { Foo } from "./foo"')
    expect(extractNamedValueExports(ast)).toEqual([])
  })

  test('handles export class declarations', async () => {
    const ast = await parse('export class Dialog {}')
    expect(extractNamedValueExports(ast)).toEqual(['Dialog'])
  })
})

describe('findCompoundObjectProperties', () => {
  test('extracts property names from simple compound object', async () => {
    const ast = await parse('export const Card = { Root, Header, Body }')
    expect(findCompoundObjectProperties(ast, 'Card')).toEqual(['Root', 'Header', 'Body'])
  })

  test('extracts multiline compound object', async () => {
    const ast = await parse('export const Card = {\nRoot,\nHeader,\nBody,\n}')
    expect(findCompoundObjectProperties(ast, 'Card')).toEqual(['Root', 'Header', 'Body'])
  })

  test('returns empty array when namespace not found', async () => {
    const ast = await parse('export const Card = { Root }')
    expect(findCompoundObjectProperties(ast, 'Dialog')).toEqual([])
  })

  test('returns empty array for non-object exports', async () => {
    const ast = await parse('export const Card = "string"')
    expect(findCompoundObjectProperties(ast, 'Card')).toEqual([])
  })

  test('skips computed/dynamic property keys', async () => {
    const ast = await parse('export const X = { [key]: val, static: val2 }')
    expect(findCompoundObjectProperties(ast, 'X')).toEqual(['static'])
  })

  test('skips spread elements', async () => {
    const ast = await parse('export const X = { ...other, Root }')
    expect(findCompoundObjectProperties(ast, 'X')).toEqual(['Root'])
  })

  test('returns empty array when compound is a function call result', async () => {
    const ast = await parse('export const Dialog = Dialog.create()')
    expect(findCompoundObjectProperties(ast, 'Dialog')).toEqual([])
  })
})

describe('findLocalDeclarations', () => {
  test('finds const declarations at module scope', async () => {
    const ast = await parse('const Root = "div"\nconst Header = "header"')
    const result = findLocalDeclarations(ast, ['Root', 'Header'])
    expect(result.has('Root')).toBe(true)
    expect(result.has('Header')).toBe(true)
    expect(result.get('Root')!.hasExport).toBe(false)
  })

  test('finds exported const declarations', async () => {
    const ast = await parse('export const Root = "div"')
    const result = findLocalDeclarations(ast, ['Root'])
    expect(result.get('Root')!.hasExport).toBe(true)
  })

  test('finds function declarations', async () => {
    const ast = await parse('function Root() {}')
    const result = findLocalDeclarations(ast, ['Root'])
    expect(result.has('Root')).toBe(true)
    expect(result.get('Root')!.hasExport).toBe(false)
  })

  test('finds exported function declarations', async () => {
    const ast = await parse('export function Root() {}')
    const result = findLocalDeclarations(ast, ['Root'])
    expect(result.has('Root')).toBe(true)
    expect(result.get('Root')!.hasExport).toBe(true)
  })

  test('returns position info at start of declaration keyword', async () => {
    const ast = await parse('const Root = "div"')
    const result = findLocalDeclarations(ast, ['Root'])
    expect(result.get('Root')!.start).toBe(0)
  })

  test('skips names that do not exist as declarations', async () => {
    const ast = await parse('const Root = "div"')
    const result = findLocalDeclarations(ast, ['NonExistent'])
    expect(result.has('NonExistent')).toBe(false)
  })

  test('only finds module-scope declarations, not block-scoped', async () => {
    const ast = await parse('{ const Root = "div" }')
    const result = findLocalDeclarations(ast, ['Root'])
    expect(result.has('Root')).toBe(false)
  })
})
