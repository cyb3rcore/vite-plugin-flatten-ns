---
'vite-plugin-flatten-ns': minor
---

- 757a50f: auto-detect compound objects from `export { X }` barrel patterns — zero manual steps. The plugin now inspects every re-exported binding, checks if it references a compound object (`export const X = { key, ... }`), and injects flat re-exports for the individual parts. Also detects `export * as` patterns as before.
