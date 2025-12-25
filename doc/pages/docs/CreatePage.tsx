import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/create.mdx';

const CreatePage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default CreatePage;
