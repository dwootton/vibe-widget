import React from 'react';

export const MediaPlaceholder = ({ label, caption }) => (
  <div className="placeholder">
    <div className="placeholder-label">{label}</div>
    <div className="placeholder-caption">{caption}</div>
  </div>
);

export const InstallCommand = ({ command }) => (
  <pre><code>{command}</code></pre>
);

export const ExampleNotebook = ({ title }) => (
  <div className="placeholder">
    <div className="placeholder-label">Interactive Notebook</div>
    <div className="placeholder-caption">
      {title || 'Open the live docs to run this notebook.'}
    </div>
  </div>
);

const mdxStaticComponents = {
  MediaPlaceholder,
  InstallCommand,
  ExampleNotebook,
};

export default mdxStaticComponents;
