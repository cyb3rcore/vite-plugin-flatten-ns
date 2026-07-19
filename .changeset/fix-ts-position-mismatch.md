---
'vite-plugin-flatten-ns': patch
---

**fix:** use oxc-native `parseAstAsync` in `enrichComponentSource` for correct TS positions

The previous esbuild-based TS stripping shifted AST positions inside `forwardRef<Props>()` generic syntax, causing `MagicString.appendLeft` to insert `export` at the wrong byte. Switched to Vite's `parseAstAsync` which handles TypeScript natively via oxc, returning AST positions that match the original source.
