import React from 'react';

export const MediaPlaceholder = ({ label, caption }) => (
  React.createElement('div', { className: 'placeholder' },
    React.createElement('div', { className: 'placeholder-label' }, label),
    React.createElement('div', { className: 'placeholder-caption' }, caption)
  )
);

export const InstallCommand = ({ command }) => (
  React.createElement('pre', null,
    React.createElement('code', null, command)
  )
);

export const ExampleNotebook = ({ title }) => (
  React.createElement('div', { className: 'placeholder' },
    React.createElement('div', { className: 'placeholder-label' }, 'Interactive Notebook'),
    React.createElement('div', { className: 'placeholder-caption' }, title || 'Open the live docs to run this notebook.')
  )
);

export const WidgetPreview = ({ src }) => (
  React.createElement('div', { className: 'placeholder' },
    React.createElement('div', { className: 'placeholder-label' }, 'Widget Preview'),
    React.createElement('div', { className: 'placeholder-caption' }, 'Open the live docs to see this interactive widget.')
  )
);

const list = (tag, items) => React.createElement(
  tag, null, ...items.map((text, i) => React.createElement('li', { key: i }, text))
);

// Text versions of doc/components/StudyDiagrams.tsx for the static export.
export const StudyLoopDiagram = () => list('ol', [
  'Domain collaborator: uses vibe_widget as usual in their own notebook, joins a study with the researcher\'s code, and creates, edits and approves widgets.',
  'Local trace log (on their machine): intents, code and errors are written to .vibewidget/traces/<session>.jsonl, readable, pausable and deletable at any time.',
  'Vis researcher (planned): only the streams the collaborator consented to are uploaded to the researcher\'s own Supabase project, then read with study.fetch() for lineage and replay views.',
]);

export const TraceLineage = () => list('ol', [
  'intent.create: "scatter of dose vs response"',
  'v1 (generated): 212 lines',
  'intent.grab_edit: <circle> "color by cohort"',
  'v2 (grab_edit): parent v1',
  'error.runtime: TypeError: cohort undefined',
  'v3 (autofix): parent v2',
  'intent.approve: review mode',
]);

const mdxStaticComponents = {
  MediaPlaceholder,
  InstallCommand,
  ExampleNotebook,
  WidgetPreview,
  StudyLoopDiagram,
  TraceLineage,
};

export default mdxStaticComponents;
