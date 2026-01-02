import React from 'react';
import DocMdxPage from '../../../components/DocMdxPage';
import Content, { frontmatter } from '../../../content/examples/chi-papers.mdx';

const ChiPapersExamplePage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default ChiPapersExamplePage;
