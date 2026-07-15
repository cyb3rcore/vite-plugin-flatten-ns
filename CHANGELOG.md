# vite-plugin-flatten-ns

## 0.2.0

### Minor Changes

- b82a339: - 757a50f: auto-detect compound objects from `export { X }` barrel patterns — zero manual steps. The plugin now inspects every re-exported binding, checks if it references a compound object (`export const X = { key, ... }`), and injects flat re-exports for the individual parts. Also detects `export * as` patterns as before.

## 0.1.1

### Patch Changes

- d070f0e: handle non-shorthand compound object props (`{ Root: BentoGridRoot }`), add inline enrichment for Pass 2 module loading, use esbuild `jsx: 'automatic'` to avoid React-not-defined errors

## 0.1.1

### Fixes

- a33cab4: handle non-shorthand compound object props (`{ Root: BentoGridRoot }`), add inline enrichment for Pass 2 module loading, use esbuild `jsx: 'automatic'` to avoid React-not-defined errors
- f69456c: use dynamic import for esbuild (ESM compat), move `parseAstAsync` after filter checks, add semicolons to injected exports

## 0.1.0

### Minor Changes

- c65d042: Initial release: flatten namespace re-exports into individual client references for RSC compatibility
