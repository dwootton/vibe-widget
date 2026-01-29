export const DOC_SITE = {
  name: 'Vibe Widget',
  description: 'Interactive widgets for notebooks, generated from natural language and data.',
  baseUrl: 'https://vibewidget.dev',
  repoUrl: 'https://github.com/dwootton/vibe-widgets',
  installCommand: 'pip install vibe-widget',
  securitySummary: 'Widgets execute LLM-generated JavaScript in the notebook frontend. Treat outputs as untrusted and verify results with audits and your own checks.',
  changelogUrl: 'https://github.com/dwootton/vibe-widgets/blob/main/CHANGELOG.md',
  docsExportPath: '/docs-export.json',
  docsTextPath: '/docs.txt',
};

export const DOC_PAGES = [
  {
    id: 'installation',
    path: '/docs',
    label: 'Installation',
    section: 'Getting Started',
    source: 'installation.mdx',
  },
  {
    id: 'config',
    path: '/docs/config',
    label: 'Configuration',
    section: 'Getting Started',
    source: 'config.mdx',
  },
  {
    id: 'create',
    path: '/docs/create',
    label: 'Create',
    section: 'Core Concepts',
    source: 'create.mdx',
  },
  {
    id: 'edit',
    path: '/docs/edit',
    label: 'Edit',
    section: 'Core Concepts',
    source: 'edit.mdx',
  },
  {
    id: 'audit',
    path: '/docs/audit',
    label: 'Audit',
    section: 'Core Concepts',
    source: 'audit.mdx',
  },
  {
    id: 'reactivity',
    path: '/docs/reactivity',
    label: 'Reactivity',
    section: 'Core Concepts',
    source: 'reactivity.mdx',
  },
  {
    id: 'composability',
    path: '/docs/composability',
    label: 'Load & Save',
    section: 'Core Concepts',
    source: 'composability.mdx',
  },
  {
    id: 'theming',
    path: '/docs/theming',
    label: 'Theming',
    section: 'Core Concepts',
    source: 'theming.mdx',
  },
  {
    id: 'widgetarium',
    path: '/docs/widgetarium',
    label: 'Widgetarium',
    section: 'Ecosystem',
    source: 'widgetarium.mdx',
  },
];

export const DOC_SECTIONS = [
  {
    title: 'Getting Started',
    links: DOC_PAGES.filter((page) => page.section === 'Getting Started').map((page) => ({
      label: page.label,
      path: page.path,
    })),
  },
  {
    title: 'Core Concepts',
    links: DOC_PAGES.filter((page) => page.section === 'Core Concepts').map((page) => ({
      label: page.label,
      path: page.path,
    })),
  },
  {
    title: 'Explore',
    links: [
      { label: 'Example Gallery', path: '/gallery' },
      ...DOC_PAGES.filter((page) => page.section === 'Ecosystem').map((page) => ({
        label: page.label,
        path: page.path,
      })),
    ],
  },
];

export const DOC_PAGES_BY_PATH = Object.fromEntries(
  DOC_PAGES.map((page) => [page.path, page])
);
