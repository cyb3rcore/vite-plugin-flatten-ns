import type { Program } from 'estree';
/**
 * Enrich component source by prepending `export` to local declarations
 * that are referenced by compound object exports.
 *
 * For example, given:
 *   const Root = withProvider(ark.div, "root")
 *   export const Card = { Root }
 *
 * Returns:
 *   export const Root = withProvider(ark.div, "root")
 *   export const Card = { Root }
 *
 * Returns `null` if no changes were made.
 */
export declare function enrichComponentSource(code: string, ast: Program): string | null;
//# sourceMappingURL=component-enrich.d.ts.map