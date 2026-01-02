import React from 'react';
import DocMdxPage from '../../../components/DocMdxPage';
import Content, { frontmatter } from '../../../content/examples/mnist.mdx';

const MnistExamplePage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default MnistExamplePage;
