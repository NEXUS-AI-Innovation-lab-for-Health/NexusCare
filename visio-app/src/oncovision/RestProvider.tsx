// Re-exports from the oncovision source (aliased via vite.config.ts).
// This ensures all local components and ImageViewer share the same RestContext.
export { RestProvider, useRest } from 'oncovision';
export type { RestContextType } from 'oncovision';
