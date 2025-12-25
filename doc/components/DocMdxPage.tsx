import React from 'react';
import DocContent from './DocContent';
import mdxComponents from './MdxComponents';

interface DocMeta {
  title?: string;
  description?: string;
  layout?: string;
}

const DocMdxPage = ({ Content, meta }: { Content: React.ComponentType<any>; meta?: DocMeta }) => {
  if (meta?.layout === 'full') {
    return <Content components={mdxComponents} />;
  }

  return (
    <DocContent title={meta?.title || 'Docs'}>
      <Content components={mdxComponents} />
    </DocContent>
  );
};

export default DocMdxPage;
