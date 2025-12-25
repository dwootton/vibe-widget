import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/widgetarium.mdx';

const WidgetariumPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default WidgetariumPage;
