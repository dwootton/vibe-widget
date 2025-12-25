import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/edit.mdx';

const EditPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default EditPage;
