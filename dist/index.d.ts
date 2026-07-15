import type { Plugin } from 'vite';
export type FlattenNsOptions = {
    include?: string[];
    includeComponents?: string[];
    keepNamespaceExports?: boolean;
};
export declare function flattenNamespaceExports(options?: FlattenNsOptions): Plugin;
//# sourceMappingURL=index.d.ts.map