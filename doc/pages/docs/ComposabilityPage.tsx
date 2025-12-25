import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/composability.mdx';

const ComposabilityPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default ComposabilityPage;
