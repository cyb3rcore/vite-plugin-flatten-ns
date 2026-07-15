import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { flattenNamespaceExports } from '../src/index.js'
import { build } from 'vite'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('flattenNamespaceExports', () => {
  test('returns Vite plugin with correct properties', () => {
    const p = flattenNamespaceExports()
    expect(p.name).toBe('flatten-ns')
    expect(p.enforce).toBe('pre')
  })

  test('transform is a function', () => {
    const p = flattenNamespaceExports()
    expect(typeof p.transform).toBe('function')
  })

  test('accepts options without throwing', () => {
    expect(() => flattenNamespaceExports({ include: ['**/ui/index.ts'] })).not.toThrow()
    expect(() => flattenNamespaceExports({ keepNamespaceExports: false })).not.toThrow()
  })
})

describe('integration', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'flatten-ns-'))
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ type: 'module' }))
    mkdirSync(join(tmpDir, 'ui'), { recursive: true })
    writeFileSync(join(tmpDir, 'ui', 'index.ts'), `export * as Dialog from './dialog'`)
    writeFileSync(join(tmpDir, 'ui', 'dialog.ts'), `export const Root = "root"\nexport const Trigger = "trigger"`)
  })

  afterAll(() => rmSync(tmpDir, { recursive: true, force: true }))

  test('barrel output contains flattened exports after build', async () => {
    await build({
      root: tmpDir,
      logLevel: 'warn',
      plugins: [flattenNamespaceExports()],
      build: {
        write: true,
        outDir: 'out',
        lib: { entry: join(tmpDir, 'ui', 'index.ts'), formats: ['es'], fileName: 'index' },
        rollupOptions: { external: ['react'] },
      },
    })

    const outputPath = join(tmpDir, 'out', 'index.js')
    expect(existsSync(outputPath)).toBe(true)

    const output = readFileSync(outputPath, 'utf-8')
    expect(output).toContain('DialogRoot')
    expect(output).toContain('DialogTrigger')
  })
})
