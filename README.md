# vite-plugin-flatten-ns

A Vite plugin that flattens namespace re-exports (`export * as Name from './module'`) into individual flat named exports so React Server Components can register each sub-component as a separate client reference.

## Install

```bash
npm install -D vite-plugin-flatten-ns
```

## Usage

```ts
import { defineConfig } from 'vite'
import { flattenNamespaceExports } from 'vite-plugin-flatten-ns'

export default defineConfig({
  plugins: [flattenNamespaceExports()],
})
```

## How it works

Barrel files using `export * as Dialog from './dialog'` get flattened to `export { Root as DialogRoot, Trigger as DialogTrigger, Content as DialogContent } from './dialog'` automatically. The RSC transform then registers each flat export as an individual client reference, so server components can safely import `{ DialogRoot }` instead of accessing `Dialog.Root`.

See [design doc](./docs/superpowers/specs/2026-07-15-vite-plugin-flatten-ns-design.md).
