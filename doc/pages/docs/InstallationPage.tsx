import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/installation.mdx';

const InstallationPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default InstallationPage;
