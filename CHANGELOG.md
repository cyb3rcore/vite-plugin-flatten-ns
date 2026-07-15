# vite-plugin-flatten-ns

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
