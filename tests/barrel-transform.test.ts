import { describe, test, expect } from 'vitest'
import { flattenBarrelSource } from '../src/barrel-transform.js'
import { parseAstAsync } from 'vite'

// Mock Vite resolve/load
function mockResolver(files: Record<string, string>) {
  return {
    resolve: async (source: string, importer: string) => {
      const dir = importer.split('/').slice(0, -1).join('/')
      const resolved = dir + '/' + source.replace('./', '')
      const withTs = resolved + '.ts'
      if (files[withTs]) return { id: withTs }
      if (files[resolved]) return { id: resolved }
      return null
    },
    load: async (id: string) => {
      if (files[id]) return { code: files[id] }
      return null
    },
  }
}

async function t(barrel: string, path: string, files: Record<string, string>, expected: string | null) {
  const ast = await parseAstAsync(barrel)
  const m = mockResolver(files)
  const result = await flattenBarrelSource(barrel, ast, m.resolve, m.load, path)
  expect(result).toBe(expected)
}

describe('flattenBarrelSource', () => {
  test('flattens a single export * as', async () => {
    await t(
      `export * as Dialog from './dialog'`,
      '/src/ui/index.ts',
      { '/src/ui/dialog.ts': 'export const Root = "root"\nexport const Trigger = "trigger"' },
      `export * as Dialog from './dialog'\nexport { Root as DialogRoot, Trigger as DialogTrigger } from './dialog'`
    )
  })

  test('flattens multiple namespace exports in order', async () => {
    const barrel = `export * as Dialog from './dialog'\nexport * as Card from './card'`
    const files = {
      '/src/ui/dialog.ts': 'export const Root = "root"',
      '/src/ui/card.ts': 'export const Header = "header"',
    }
    const expected = `export * as Dialog from './dialog'\nexport { Root as DialogRoot } from './dialog'\nexport * as Card from './card'\nexport { Header as CardHeader } from './card'`
    await t(barrel, '/src/ui/index.ts', files, expected)
  })

  test('handles re-export maps (export { a, b } from)', async () => {
    await t(
      `export * as Dialog from './dialog'`,
      '/src/ui/index.ts',
      { '/src/ui/dialog.ts': 'export { Root, Trigger } from "./internal"' },
      `export * as Dialog from './dialog'\nexport { Root as DialogRoot, Trigger as DialogTrigger } from './dialog'`
    )
  })

  test('returns null when no export * as found', async () => {
    await t(`export { Button } from './button'`, '/src/ui/index.ts', {}, null)
  })

  test('returns null when target module has no named exports', async () => {
    await t(
      `export * as Config from './config'`,
      '/src/ui/index.ts',
      { '/src/ui/config.ts': '' },
      null
    )
  })

  test('returns null when target has only type exports', async () => {
    await t(
      `export * as Dialog from './dialog'`,
      '/src/ui/index.ts',
      { '/src/ui/dialog.ts': 'export type { Root } from "./types"' },
      null
    )
  })

  test('excludes namespace name from flat exports', async () => {
    await t(
      `export * as Card from './card'`,
      '/src/ui/index.ts',
      { '/src/ui/card.ts': 'export const Root = "root"\nexport const Card = { Root }' },
      `export * as Card from './card'\nexport { Root as CardRoot } from './card'`
    )
  })

  test('warns on name collision between flat exports', async () => {
    // Namespace "Foo" with export "BarBaz" → flat name "FooBarBaz"
    // Namespace "FooBar" with export "Baz" → flat name "FooBarBaz" (collision!)
    const barrel = `export * as Foo from './foo'\nexport * as FooBar from './foobar'`
    const files = {
      '/src/ui/foo.ts': 'export const BarBaz = 1',
      '/src/ui/foobar.ts': 'export const Baz = 2',
    }
    const warnings: string[] = []
    const ast = await parseAstAsync(barrel)
    const m = mockResolver(files)
    const result = await flattenBarrelSource(barrel, ast, m.resolve, m.load, '/src/ui/index.ts', (msg) => warnings.push(msg))
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.some(w => w.includes('Baz'))).toBe(true)
  })
})
