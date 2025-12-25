import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/data-sources.mdx';

const DataSourcesPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default DataSourcesPage;
