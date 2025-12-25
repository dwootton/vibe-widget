import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/theming.mdx';

const ThemingPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default ThemingPage;
