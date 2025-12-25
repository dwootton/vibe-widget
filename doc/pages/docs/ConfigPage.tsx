import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/config.mdx';

const ConfigPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default ConfigPage;
