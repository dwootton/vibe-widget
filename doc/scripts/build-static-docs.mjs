import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compile, run } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import * as runtime from 'react/jsx-runtime';
import { DOC_PAGES, DOC_SECTIONS, DOC_SITE } from '../data/docsManifest.js';
import mdxStaticComponents from './mdxStaticComponents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const contentRoot = path.join(projectRoot, 'content');

const outputRoot = process.env.STATIC_DOCS_OUTDIR
  ? path.resolve(process.env.STATIC_DOCS_OUTDIR)
  : path.join(projectRoot, 'public', 'docs');

const baseUrl = process.env.STATIC_DOCS_BASE_URL || DOC_SITE.baseUrl;

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripHtml = (value) => value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const compileMdx = async (source) => {
  const compiled = await compile(source, {
    outputFormat: 'function-body',
    remarkPlugins: [remarkGfm],
  });

  const { default: Content } = await run(compiled, runtime);
  return Content;
};

const renderMdxToHtml = async (source) => {
  const Content = await compileMdx(source);
  const element = React.createElement(Content, { components: mdxStaticComponents });
  return renderToStaticMarkup(element);
};

const FRONTMATTER_REGEX = /export\s+const\s+frontmatter\s*=\s*({[\s\S]*?})\s*;?/;

const extractFrontmatter = (source) => {
  const match = source.match(FRONTMATTER_REGEX);
  if (!match) return {};
  try {
    // Frontmatter is authored as a JS object literal in MDX.
    return Function(`\"use strict\"; return (${match[1]});`)();
  } catch (error) {
    console.warn('Failed to parse MDX frontmatter export:', error);
    return {};
  }
};

const renderPageHtml = ({ title, description, bodyHtml, path: pagePath }) => {
  const canonical = `${baseUrl}${pagePath}`;
  const metaDescription = description || DOC_SITE.description;

  const navLinks = DOC_SECTIONS.map((section) => {
    const links = section.links
      .map((link) => `<a href="${link.path}">${escapeHtml(link.label)}</a>`)
      .join('');
    return `<div class="nav-section"><div class="nav-title">${escapeHtml(section.title)}</div>${links}</div>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(DOC_SITE.name)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <link rel="stylesheet" href="/docs-static.css" />
</head>
<body>
  <header class="site-header">
    <div class="site-title">${escapeHtml(DOC_SITE.name)}</div>
    <div class="site-subtitle">${escapeHtml(DOC_SITE.description)}</div>
  </header>
  <div class="layout">
    <aside class="sidebar">${navLinks}</aside>
    <main class="content">
      <h1>${escapeHtml(title)}</h1>
      ${bodyHtml}
    </main>
  </div>
  <footer class="site-footer">
    <div>Docs export: <a href="${DOC_SITE.docsTextPath}">${DOC_SITE.docsTextPath}</a> | <a href="${DOC_SITE.docsExportPath}">${DOC_SITE.docsExportPath}</a></div>
    <div>Changelog: <a href="${DOC_SITE.changelogUrl}">${DOC_SITE.changelogUrl}</a></div>
  </footer>
</body>
</html>`;
};

const pageOutputPath = (pagePath) => {
  if (pagePath === '/docs') {
    return path.join(outputRoot, 'index.html');
  }
  const relative = pagePath.replace(/^\/docs\/?/, '');
  return path.join(outputRoot, relative, 'index.html');
};

const buildDocsTxt = (pages) => {
  const lines = [];
  for (const page of pages) {
    lines.push(`# ${page.title}`);
    lines.push(`URL: ${baseUrl}${page.path}`);
    if (page.description) {
      lines.push(page.description);
    }
    lines.push(page.contentText);
    lines.push('\n');
  }
  return lines.join('\n').trim() + '\n';
};

const buildDocsExport = (pages) => ({
  generated_at: new Date().toISOString(),
  site: {
    name: DOC_SITE.name,
    description: DOC_SITE.description,
    base_url: baseUrl,
  },
  pages: pages.map((page) => ({
    id: page.id,
    path: page.path,
    title: page.title,
    description: page.description || '',
    content_html: page.contentHtml,
    content_text: page.contentText,
  })),
});

const buildLlmsTxt = () => {
  const lines = [
    `${DOC_SITE.name}`,
    DOC_SITE.description,
    '',
    'Install:',
    `- ${DOC_SITE.installCommand}`,
    '',
    'Key docs:',
    '- /docs (Installation)',
    '- /docs/create',
    '- /docs/edit',
    '- /docs/audit',
    '- /docs/reactivity',
    '',
    'Security model:',
    `- ${DOC_SITE.securitySummary}`,
    '',
    'Examples:',
    '- /docs/examples/cross-widget',
    '- /docs/examples/tictactoe',
    '- /docs/examples/pdf-web',
    '- /docs/examples/edit',
    '',
    'Docs export:',
    `- ${DOC_SITE.docsTextPath}`,
    `- ${DOC_SITE.docsExportPath}`,
    '',
    'Changelog:',
    `- ${DOC_SITE.changelogUrl}`,
  ];

  return lines.join('\n') + '\n';
};

const buildLlmsFullTxt = (pages) => {
  const lines = [
    `${DOC_SITE.name} - Full Docs Index`,
    DOC_SITE.description,
    '',
    'Install:',
    `- ${DOC_SITE.installCommand}`,
    '',
    'Security model:',
    `- ${DOC_SITE.securitySummary}`,
    '',
    'Pages:',
  ];

  for (const page of pages) {
    const summary = page.description ? ` - ${page.description}` : '';
    lines.push(`- ${page.path}: ${page.title}${summary}`);
  }

  lines.push('', 'Docs export:', `- ${DOC_SITE.docsTextPath}`, `- ${DOC_SITE.docsExportPath}`, '', 'Changelog:', `- ${DOC_SITE.changelogUrl}`);

  return lines.join('\n') + '\n';
};

const buildRobotsTxt = () => `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`;

const buildSitemapXml = (pages) => {
  const urls = [
    `${baseUrl}/`,
    `${baseUrl}/docs`,
    `${baseUrl}/gallery`,
    ...pages.map((page) => `${baseUrl}${page.path}`),
  ];
  const uniqueUrls = Array.from(new Set(urls));
  const entries = uniqueUrls
    .map((url) => `<url><loc>${url}</loc></url>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>\n`;
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const writeFile = async (filePath, content) => {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
};

const main = async () => {
  await ensureDir(outputRoot);

  const builtPages = [];

  for (const page of DOC_PAGES) {
    const sourcePath = path.join(contentRoot, page.source);
    const raw = await fs.readFile(sourcePath, 'utf8');
    const frontmatter = extractFrontmatter(raw);
    const title = frontmatter.title || page.label;
    const description = frontmatter.description || '';

    const contentHtml = await renderMdxToHtml(raw);
    const contentText = stripHtml(contentHtml);

    const html = renderPageHtml({
      title,
      description,
      bodyHtml: contentHtml,
      path: page.path,
    });

    const outputPath = pageOutputPath(page.path);
    await writeFile(outputPath, html);

    builtPages.push({
      id: page.id,
      path: page.path,
      title,
      description,
      contentHtml,
      contentText,
    });
  }

  const docsTxt = buildDocsTxt(builtPages);
  const docsExport = buildDocsExport(builtPages);

  await writeFile(path.join(projectRoot, 'public', 'docs.txt'), docsTxt);
  await writeFile(path.join(projectRoot, 'public', 'docs-export.json'), JSON.stringify(docsExport, null, 2));
  await writeFile(path.join(projectRoot, 'public', 'llms.txt'), buildLlmsTxt());
  await writeFile(path.join(projectRoot, 'public', 'llms-full.txt'), buildLlmsFullTxt(builtPages));
  await writeFile(path.join(projectRoot, 'public', 'robots.txt'), buildRobotsTxt());
  await writeFile(path.join(projectRoot, 'public', 'sitemap.xml'), buildSitemapXml(builtPages));

  console.log(`Static docs written to ${outputRoot}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
