import type { Program } from 'estree';
type ResolveResult = string | {
    id: string;
} | null;
type LoadResult = {
    code: string;
} | null;
/**
 * Flatten `export * as Namespace` AND `export { Namespace } from './module'`
 * re-exports into individual flat named exports.
 *
 * Handles two patterns:
 * 1. `export * as Card from './card'` — flattens all named exports
 * 2. `export { BentoGrid } from './bento-grid'` — detects compound object,
 *    resolves its property values, injects flat re-exports for each
 *
 * Detects flat name collisions across all namespaces and warns on duplicates.
 *
 * @returns Modified source code string, or `null` if nothing to flatten.
 */
export declare function flattenBarrelSource(code: string, ast: Program, resolve: (source: string, importer: string) => Promise<ResolveResult>, load: (id: string) => Promise<LoadResult>, importer: string, warn?: (msg: string) => void, parseModule?: (code: string, moduleId: string) => Promise<Program>): Promise<string | null>;
export {};
//# sourceMappingURL=barrel-transform.d.ts.map