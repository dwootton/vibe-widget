import React from 'react';
import CodeBlock from './CodeBlock';
import MediaPlaceholder from './MediaPlaceholder';
import InstallCommand from './InstallCommand';
import ExampleNotebook from './ExampleNotebook';
import WidgetPreview from './WidgetPreview';
import { StudyLoopDiagram, TraceLineage } from './StudyDiagrams';

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

/** Yellow call-out for things a reader must see before going further. */
const Warning = ({ title, children }: { title?: string; children?: React.ReactNode }) => (
  <aside
    role="note"
    className="not-prose my-6 rounded-md border border-amber-300 border-l-4 border-l-amber-500 bg-amber-50 px-5 py-4 text-amber-950"
  >
    {title && <p className="m-0 mb-1 font-semibold">{title}</p>}
    <div className="text-[0.95rem] leading-relaxed [&_a]:font-semibold [&_a]:underline [&_p]:m-0">{children}</div>
  </aside>
);

/** Neutral call-out for a point worth stating on its own. */
const Note = ({ title, children }: { title?: string; children?: React.ReactNode }) => (
  <aside
    role="note"
    className="not-prose my-6 rounded-md border-2 border-slate bg-white px-5 py-4 text-slate shadow-hard-sm"
  >
    {title && <p className="m-0 mb-1 font-semibold">{title}</p>}
    <div className="text-[0.95rem] leading-relaxed [&_code]:font-mono [&_code]:text-[0.85em] [&_p]:m-0">{children}</div>
  </aside>
);

const mdxComponents = {
  pre: MdxPre,
  Warning,
  Note,
  MediaPlaceholder,
  InstallCommand,
  ExampleNotebook,
  WidgetPreview,
  StudyLoopDiagram,
  TraceLineage,
};

export default mdxComponents;
