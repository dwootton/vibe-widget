import React from 'react';
import DocMdxPage from '../../components/DocMdxPage';
import Content, { frontmatter } from '../../content/audit.mdx';

const AuditPage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default AuditPage;
