import { describe, test, expect } from 'vitest'
import { parseAstAsync } from 'vite'
import { enrichComponentSource } from '../src/component-enrich.js'

async function t(input: string, expected: string) {
  const ast = await parseAstAsync(input)
  expect(enrichComponentSource(input, ast)).toBe(expected)
}

async function noChange(input: string) {
  const ast = await parseAstAsync(input)
  expect(enrichComponentSource(input, ast)).toBeNull()
}

describe('enrichComponentSource', () => {
  test('adds export to local const referenced by compound', async () => {
    await t(
      'const Root = withProvider(ark.div, "root")\nconst Header = withContext(ark.div, "header")\n\nexport const Card = { Root, Header }',
      'export const Root = withProvider(ark.div, "root")\nexport const Header = withContext(ark.div, "header")\n\nexport const Card = { Root, Header }'
    )
  })

  test('adds export to local function referenced by compound', async () => {
    await t(
      'function Root() { return null }\nfunction Header() { return null }\n\nexport const Card = { Root, Header }',
      'export function Root() { return null }\nexport function Header() { return null }\n\nexport const Card = { Root, Header }'
    )
  })

  test('does not modify already-exported declarations', async () => {
    await t(
      'export const Root = withProvider(ark.div, "root")\nconst Header = withContext(ark.div, "header")\n\nexport const Card = { Root, Header }',
      'export const Root = withProvider(ark.div, "root")\nexport const Header = withContext(ark.div, "header")\n\nexport const Card = { Root, Header }'
    )
  })

  test('returns null when no compound object found', async () => {
    await noChange('export const Button = styled("button")')
  })

  test('returns null when compound has no local variable references', async () => {
    await noChange('export const Config = { api: "https://x.com" }')
  })

  test('returns null when compound value is not an object literal', async () => {
    await noChange('export const Dialog = Dialog.create()')
  })

  test('handles multiple compound objects in one file', async () => {
    await t(
      'const Root = withProvider("div", "root")\nconst Header = withContext("div", "header")\nconst Trigger = withProvider("button", "trigger")\n\nexport const Card = { Root, Header }\nexport const Dialog = { Trigger }',
      'export const Root = withProvider("div", "root")\nexport const Header = withContext("div", "header")\nexport const Trigger = withProvider("button", "trigger")\n\nexport const Card = { Root, Header }\nexport const Dialog = { Trigger }'
    )
  })
})
