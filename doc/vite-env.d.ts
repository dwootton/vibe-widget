/// <reference types="vite/client" />

declare module '*.mdx' {
  import * as React from 'react';
  export const frontmatter: Record<string, any>;
  const MDXComponent: React.ComponentType<any>;
  export default MDXComponent;
}
