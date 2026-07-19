# vite-plugin-flatten-ns

## 0.1.2

- **fix:** use oxc-native `parseAstAsync` in `enrichComponentSource` for correct TS positions

  The previous esbuild-based TS stripping shifted AST positions inside `forwardRef<Props>()` generic syntax, causing `MagicString.appendLeft` to insert `export` at the wrong byte. Switched to Vite's `parseAstAsync` which handles TypeScript natively via oxc.

## 0.1.1

- **fix:** handle non-shorthand compound object props (`{ Root: BentoGridRoot }`) (`d070f0e`)

  Added inline enrichment for Pass 2 module loading, uses esbuild `jsx: 'automatic'` to avoid React-not-defined errors.

- **fix:** use dynamic import for esbuild (ESM compat), move `parseAstAsync` after filter checks (`f69456c`)

  Added semicolons to injected exports for consistent formatting.

## 0.1.0

- **feat:** initial release — flatten namespace re-exports into individual client references for RSC compatibility (`c65d042`)
