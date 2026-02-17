import React from 'react';
import CodeBlock from './CodeBlock';
import MediaPlaceholder from './MediaPlaceholder';
import InstallCommand from './InstallCommand';
import ExampleNotebook from "./ExampleNotebook";
import VibeWidget from "./VibeWidget";

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

/** WidgetPreview: renders a widget by URL. Used in MDX as <WidgetPreview src="..." dataUrl="..." /> */
function WidgetPreview({
  src,
  dataUrl,
  dataType = "csv",
  height = 400,
}: {
  src: string;
  dataUrl?: string;
  dataType?: "csv" | "json";
  height?: number;
}) {
  const dataFiles = dataUrl
    ? [{ url: dataUrl, varName: "data", type: dataType as "csv" | "json" }]
    : undefined;
  return (
    <div
      className="bg-white border-2 border-slate rounded-lg overflow-hidden my-4 shadow-hard-sm"
      style={{ height }}
    >
      <VibeWidget moduleUrl={src} dataFiles={dataFiles} />
    </div>
  );
}

const mdxComponents = {
  pre: MdxPre,
  MediaPlaceholder,
  InstallCommand,
  ExampleNotebook,
  WidgetPreview,
};

export default mdxComponents;
