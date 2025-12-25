import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/reactivity.mdx';

const ReactivityPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default ReactivityPage;
