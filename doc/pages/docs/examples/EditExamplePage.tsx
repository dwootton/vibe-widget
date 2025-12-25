import React from 'react';
import DocMdxPage from '../../../components/DocMdxPage';
import Content, { frontmatter } from '../../../content/examples/edit.mdx';

const EditExamplePage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default EditExamplePage;
