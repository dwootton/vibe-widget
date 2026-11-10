import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/study.mdx';

const StudyPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default StudyPage;
