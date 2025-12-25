import React from 'react';
import DocMdxPage from '../../../components/DocMdxPage';
import Content, { frontmatter } from '../../../content/examples/cross-widget.mdx';

const CrossWidgetExamplePage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default CrossWidgetExamplePage;
