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

const mdxStaticComponents = {
  MediaPlaceholder,
  InstallCommand,
  ExampleNotebook,
  WidgetPreview,
};

export default mdxStaticComponents;
