import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
// import NotebookGuide from '../components/NotebookGuide';
import PyodideNotebook from '../components/PyodideNotebook';
import { Copy } from 'lucide-react';
import {
    CROSS_WIDGET_NOTEBOOK,
    TICTACTOE_NOTEBOOK,
    PDF_WEB_NOTEBOOK,
    REVISE_NOTEBOOK,
    WEATHER_DATA_FILES,
    TICTACTOE_DATA_FILES,
    PDF_WEB_DATA_FILES,
    REVISE_DATA_FILES,
} from '../data/pyodideNotebooks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const Sidebar = () => {
    const location = useLocation();

    const sections = [
        {
            title: "Getting Started", links: [
                { label: "Installation", href: "/docs" },
                { label: "Configuration", href: "/docs/config" },
            ]
        },
        {
            title: "Core Concepts", links: [
                { label: "Create", href: "/docs/create" },
                { label: "Revise", href: "/docs/revise" },
                { label: "Iterations", href: "/docs/iterations" },
                { label: "Reactivity", href: "/docs/reactivity" },          // how widgets update based on traitlets (imports, exports)
                { label: "Data Sources", href: "/docs/data-sources" },      // supported data types including csv, xml, nc, json, pdf, web scraping, etc.
                { label: "Composability", href: "/docs/composability" },    // talking about the widget.components (for revise and for composing widgets together)


            ]
        },
        {
            title: "Live Examples", links: [
                { label: "Cross-Widget Demo", href: "/docs/examples/cross-widget" },
                { label: "Tic-Tac-Toe AI", href: "/docs/examples/tictactoe" },
                { label: "PDF & Web Data", href: "/docs/examples/pdf-web" },
                { label: "Revise Example", href: "/docs/examples/revise" },
            ]
        },
        {
            title: "Ecosystem", links: [
                { label: "Widgetarium", href: "/docs/widgetarium" },
            ]
        }
    ];

    return (
        <div className="w-64 flex-shrink-0 border-r-2 border-slate/10 min-h-screen pt-32 px-6 bg-bone sticky top-0 h-screen overflow-y-auto hidden md:block">
            {sections.map((section, i) => (
                <div key={i} className="mb-8">
                    <h3 className="font-display font-bold text-lg mb-4">{section.title}</h3>
                    <div className="flex flex-col gap-2 font-mono text-sm">
                        {section.links.map(link => (
                            <Link
                                key={link.href}
                                to={link.href}
                                className={`
                                    py-1 px-2 rounded transition-colors
                                    ${location.pathname === link.href ? 'bg-orange text-white' : 'text-slate/60 hover:text-orange'}
                                `}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

const DocContent = ({ title, children }: any) => (
    <div className="max-w-3xl">
        <h1 className="text-5xl font-display font-bold mb-8">{title}</h1>
        <div className="prose prose-slate max-w-none font-sans">
            {children}
        </div>
    </div>
);

const CodeBlock = ({ code, language = "python" }: { code: string; language?: string }) => (
    <div className="bg-material-bg text-bone rounded-lg border-orange relative overflow-hidden my-2">
        <div className="relative">
            <SyntaxHighlighter
                language={language}
                style={materialDark}

                PreTag="pre"
                CodeTag="code"
                showLineNumbers={false}
            >
                {code.trim().replace(/^`+|`+$/g, '')}
            </SyntaxHighlighter>
        </div>
    </div>
);

const DocsPage = () => {
    return (
        <div className="flex min-h-screen bg-bone">
            <Sidebar />
            <div className="flex-1 pt-32 px-8 md:px-16 pb-20">
                <Routes>
                    <Route path="/" element={
                        <DocContent title="Installation">
                            <p className="text-xl text-slate/70 mb-8">Get up and running with Vibe Widget in seconds.</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6">
                                <div
                                    className="flex items-center gap-3 transition-all cursor-pointer group"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`pip install vibe-widget`);
                                    }}
                                >
                                    <span className="text-orange">$</span>
                                    <code className="font-mono text-orange">pip install vibe-widget</code>
                                    <Copy className="w-4 h-4 text-slate/40 group-hover:text-orange transition-colors" />
                                </div>
                            </pre>
                            <p className="mb-6">Vibe Widget requires Python 3.8+ and an OpenRouter API key.</p>
                            <CodeBlock
                                language="bash"
                                code={`export OPENROUTER_API_KEY='your-key'`}
                            />
                            <h2>Quick start</h2>
                            <CodeBlock
                                code={`import pandas as pd\nimport vibe_widget as vw\n\ndf = pd.read_csv("sales.csv")\n\nwidget = vw.create(\n    "scatter plot with brush selection, and a linked histogram",\n    df,\n    vw.exports(selected_indices=vw.export("indices of selected points"))\n)\n\nwidget`}
                            />
                        </DocContent>
                    } />
                    <Route path="/config" element={
                        <DocContent title="Configuration">
                            <p>Configure model settings and API keys.</p>
                            <h2>Set defaults</h2>
                            <CodeBlock
                                code={`import vibe_widget as vw\n\nvw.config(model="openai/gpt-5.2-codex")\nvw.config(mode="premium", model="openrouter")`}
                            />
                            <h2>API key setup</h2>
                            <CodeBlock
                                language="bash"
                                code={`export OPENROUTER_API_KEY='your-key'`}
                            />
                            <CodeBlock
                                code={`import os\nfrom dotenv import load_dotenv\nimport vibe_widget as vw\n\nload_dotenv()\napi_key = os.getenv("MY_SECRET_API_KEY")\n\nvw.config(api_key=api_key)`}
                            />
                            <p>We recommend avoiding hardcoded keys in notebooks to prevent accidental leaks.</p>
                            <h2>Models</h2>
                            <CodeBlock
                                code={`vw.models()\nvw.models(show="all")\nvw.models(verbose=False)`}
                            />
                            <h2>Privacy and telemetry</h2>
                            <p>Vibe Widget sends the following to the model provider:</p>
                            <ul>
                                <li>your prompt and theme prompt</li>
                                <li>data schema (column names, dtypes)</li>
                                <li>a small sample of rows (up to 3)</li>
                                <li>exports/imports descriptors</li>
                                <li>full widget code for revisions, audits, and runtime fixes</li>
                                <li>runtime error messages (when auto-fixing)</li>
                            </ul>
                            <p>No API keys are written to disk. Generated widgets and audit reports are stored locally in <code>.vibewidget/</code>.</p>
                        </DocContent>
                    } />
                    <Route path="/create" element={
                        <DocContent title="Create">
                            <p>Create widgets from natural language prompts and data sources.</p>
                            <CodeBlock
                                code={`import vibe_widget as vw\n\nwidget = vw.create(\n    "bar chart of revenue by region",\n    df\n)\n\nwidget`}
                            />
                            <h2>Imports and exports</h2>
                            <p>Use <code>vw.imports</code> to pass multiple inputs, and <code>vw.exports</code> to define reactive state your widget exposes.</p>
                            <CodeBlock
                                code={`vw.create(\n    "...",\n    vw.imports(df, selected_indices=other_widget.selected_indices)\n)`}
                            />
                            <CodeBlock
                                code={`scatter = vw.create(\n    "scatter with brush selection",\n    df,\n    vw.exports(selected_indices=vw.export("indices of selected points"))\n)\n\nscatter.selected_indices()   # live value\nscatter.selected_indices.value`}
                            />
                            <h2>Dataflow and I/O contract</h2>
                            <p><code>vw.create</code> converts data to a list of record dicts and cleans non-JSON values (NaN/NaT/inf to <code>None</code>). Imports and exports are synced traitlets. When importing another widget export, Vibe Widget reads the current value once, then keeps it in sync via trait updates. Exports start as <code>None</code> and are updated by generated JS code.</p>
                            <h2>Supported data sources</h2>
                            <ul>
                                <li><code>pandas.DataFrame</code></li>
                                <li>local file paths (CSV/TSV, JSON/GeoJSON, Parquet, NetCDF, XML, ISF, Excel, PDF, TXT)</li>
                                <li>URLs (via <code>crawl4ai</code>, best-effort)</li>
                            </ul>
                            <p>Some loaders require optional dependencies (for example, <code>xarray</code> for NetCDF or <code>camelot</code> for PDF).</p>
                            <h2>Theming</h2>
                            <p>Themes are natural-language design specs that guide code generation.</p>
                            <CodeBlock
                                code={`vw.create("...", df, theme="financial_times")\n\nvw.create("...", df, theme="like national geographic but greener")`}
                            />
                            <p>Built-in themes are listed via <code>vw.themes()</code>. Theme prompts are cached for the session and can be saved locally.</p>
                            <h2>Safety warning</h2>
                            <p>Widgets execute LLM-generated JavaScript in the notebook frontend. Treat generated code as untrusted. Use audits and your own verification when the output informs decisions.</p>
                        </DocContent>
                    } />
                    <Route path="/theming" element={
                        <DocContent title="Theming">
                            <p>Themes are natural-language design specs that guide code generation.</p>
                            <h2>List available themes</h2>
                            <CodeBlock
                                code={`import vibe_widget as vw\n\nvw.themes()`}
                            />
                            <h2>Create a custom theme</h2>
                            <CodeBlock
                                code={`theme = vw.theme("like national geographic but greener")\n\n# Inspect or reuse the generated description\nprint(theme.description)\n\nvw.create("...", df, theme=theme.description)`}
                            />
                            <h2>Use a theme in create</h2>
                            <CodeBlock
                                code={`vw.create("...", df, theme="financial_times")`}
                            />
                        </DocContent>
                    } />
                    <Route path="/revise" element={
                        <DocContent title="Revise">
                            <p>Revise a widget using the instance method. Each revision produces a new widget instance.</p>
                            <CodeBlock
                                code={`v1 = vw.create("basic scatter", df)\nv2 = v1.revise("add hover tooltips")`}
                            />
                            <p>Revisions reuse existing code and optionally the theme, then apply requested changes. A new version is persisted in the widget store.</p>
                            <h2>Advanced revision</h2>
                            <p>When generated JS exports named components, they are exposed as snake_case component references.</p>
                            <CodeBlock
                                code={`from vibe_widget.core import revise\n\nlegend = v1.color_legend   # ComponentReference\nv2 = revise("style the legend", source=legend, data=df)`}
                            />
                        </DocContent>
                    } />
                    <Route path="/iterations" element={
                        <DocContent title="Iterations">
                            <p>Vibe Widget keeps each iteration reproducible and cached.</p>
                            <h2>Performance and caching</h2>
                            <p>Generated code is cached on disk to avoid regenerating the same widget. Cache keys include normalized prompt text, data shape, imports/exports signatures, and theme description.</p>
                            <p>Cached widgets live in <code>.vibewidget/widgets</code> with an index in <code>.vibewidget/index/widgets.json</code>. The model choice is not part of the cache key.</p>
                            <h2>Sampling behavior</h2>
                            <ul>
                                <li>large file sources are sampled in the loader (default max 10k rows)</li>
                                <li><code>load_data</code> caps in-memory data to 5k rows</li>
                            </ul>
                            <h2>Auditing</h2>
                            <p>Run audits with <code>widget.audit</code> to get structured feedback and fix suggestions.</p>
                            <CodeBlock
                                code={`widget.audit(level="fast")\nwidget.audit(level="full", reuse=True)`}
                            />
                            <p>Audit outputs are stored in <code>.vibewidget/audits</code> as JSON and YAML.</p>
                        </DocContent>
                    } />
                    <Route path="/reactivity" element={
                        <DocContent title="Reactivity">
                            <p>Exports are reactive state handles that can be imported into other widgets.</p>
                            <CodeBlock
                                code={`scatter = vw.create(\n    "scatter plot with brush selection tool",\n    df,\n    vw.exports(selected_indices=vw.export("indices of selected points"))\n)\n\nhistogram = vw.create(\n    "histogram with highlighted bars for selected data",\n    vw.imports(df, selected_indices=scatter.selected_indices)\n)`}
                            />
                            <p>When you select points in the scatter plot, the histogram updates via trait syncing. Exports are exposed as callable handles like <code>scatter.selected_indices()</code>.</p>
                        </DocContent>
                    } />
                    <Route path="/examples/cross-widget" element={
                        <PyodideNotebook
                            cells={CROSS_WIDGET_NOTEBOOK}
                            title="Cross-Widget Interactions"
                            dataFiles={WEATHER_DATA_FILES}
                            notebookKey="cross-widget"
                        />
                    } />
                    <Route path="/examples/tictactoe" element={
                        <PyodideNotebook
                            cells={TICTACTOE_NOTEBOOK}
                            title="Tic-Tac-Toe AI"
                            dataFiles={TICTACTOE_DATA_FILES}
                            notebookKey="tictactoe"
                        />
                    } />
                    <Route path="/examples/pdf-web" element={
                        <PyodideNotebook
                            cells={PDF_WEB_NOTEBOOK}
                            title="PDF & Web Data Extraction"
                            dataFiles={PDF_WEB_DATA_FILES}
                            notebookKey="pdf-web"
                        />
                    } />
                    <Route path="/examples/revise" element={
                        <PyodideNotebook
                            cells={REVISE_NOTEBOOK}
                            title="Widget Revision"
                            dataFiles={REVISE_DATA_FILES}
                            notebookKey="revise"
                        />
                    } />
                    <Route path="*" element={
                        <DocContent title="Coming Soon">
                            <p>This documentation section is under construction.</p>
                        </DocContent>
                    } />
                </Routes>
            </div>
        </div>
    );
};

export default DocsPage;
