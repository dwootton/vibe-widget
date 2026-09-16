import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/r-shim.mdx';

const RShimPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default RShimPage;
