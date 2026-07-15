import type { Program } from 'estree';
type ResolveResult = string | {
    id: string;
} | null;
type LoadResult = {
    code: string;
} | null;
/**
 * Flatten `export * as Namespace` re-exports into individual flat named exports.
 *
 * For each `export * as Foo from './bar'`, finds all value exports from `./bar`
 * and generates `export { Baz as FooBaz } from './bar'` lines injected after
 * each namespace export.
 *
 * Detects flat name collisions across all namespaces and warns on duplicates.
 *
 * @returns Modified source code string, or `null` if no `export * as` declarations are found.
 */
export declare function flattenBarrelSource(code: string, ast: Program, resolve: (source: string, importer: string) => Promise<ResolveResult>, load: (id: string) => Promise<LoadResult>, importer: string, warn?: (msg: string) => void, parseModule?: (code: string, moduleId: string) => Promise<Program>): Promise<string | null>;
export {};
//# sourceMappingURL=barrel-transform.d.ts.map