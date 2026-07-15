import type { Program, Pattern } from 'estree';
/**
 * Extract identifier names from a destructuring pattern.
 * Handles Identifier, ObjectPattern, and ArrayPattern.
 */
export declare function extractNames(node: Pattern): string[];
/**
 * Return the names of all value (non-type) export declarations at module scope.
 * Handles:
 *  - export const/let/var
 *  - export function / export class
 *  - export { a, b } / export { a, b } from './x'
 * Skips:
 *  - export type { ... }
 *  - export * / export * as
 */
export declare function extractNamedValueExports(ast: Program): string[];
/**
 * Find property names inside an exported object expression.
 * Given `export const X = { Root, Header }`, returns ['Root', 'Header'].
 * Only returns non-computed, non-spread Identifier property keys.
 */
export declare function findCompoundObjectProperties(ast: Program, namespaceName: string): string[];
export declare function findLocalDeclarations(ast: Program, names: string[]): Map<string, {
    start: number;
    end: number;
    hasExport: boolean;
}>;
//# sourceMappingURL=exports.d.ts.map