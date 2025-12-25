import React from 'react';
import CodeBlock from './CodeBlock';
import MediaPlaceholder from './MediaPlaceholder';
import InstallCommand from './InstallCommand';
import ExampleNotebook from './ExampleNotebook';

const MdxPre = ({ children }: { children?: React.ReactNode }) => {
  if (!children || !React.isValidElement(children)) {
    return <pre>{children}</pre>;
  }

  const child = children as React.ReactElement<{ className?: string; children?: string }>;
  const className = child.props.className || '';
  const language = className.replace('language-', '') || 'text';
  const code = child.props.children ? String(child.props.children).trimEnd() : '';

  return <CodeBlock code={code} language={language} />;
};

const mdxComponents = {
  pre: MdxPre,
  MediaPlaceholder,
  InstallCommand,
  ExampleNotebook,
};

export default mdxComponents;
