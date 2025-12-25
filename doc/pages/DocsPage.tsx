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
                { label: "Edit", href: "/docs/edit" },
                { label: "Audit", href: "/docs/audit" },
                { label: "Reactivity", href: "/docs/reactivity" },          // how widgets update based on traitlets (inputs, outputs)
                { label: "Data Sources", href: "/docs/data-sources" },      // supported data types including csv, xml, nc, json, pdf, web scraping, etc.
                { label: "Composability", href: "/docs/composability" },    // talking about widget.component for composing


            ]
        },
        {
            title: "Live Examples", links: [
                { label: "Cross-Widget Demo", href: "/docs/examples/cross-widget" },
                { label: "Tic-Tac-Toe AI", href: "/docs/examples/tictactoe" },
                { label: "PDF & Web Data", href: "/docs/examples/pdf-web" },
                { label: "Edit Example", href: "/docs/examples/edit" },
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
    <div className="max-w-3xl w-full min-w-0">
        <h1 className="text-5xl font-display font-bold mb-8">{title}</h1>
        <div className="prose prose-slate max-w-none font-sans break-words">
            {children}
        </div>
    </div>
);

const CodeBlock = ({ code, language = "python" }: { code: string; language?: string }) => (
    <div className="bg-material-bg text-bone rounded-lg border-orange relative overflow-hidden my-2 max-w-full overflow-x-auto">
        <div className="relative">
            <SyntaxHighlighter
                language={language}
                style={materialDark}
                customStyle={{ background: 'transparent', margin: 0 }}
                PreTag="pre"
                CodeTag="code"
                wrapLongLines
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
            <div className="flex-1 pt-32 px-4 sm:px-8 md:px-16 pb-20 min-w-0">
                <Routes>
                    <Route index element={
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
                                code={`import pandas as pd\nimport vibe_widget as vw\n\ndf = pd.read_csv("sales.csv")\n\nwidget = vw.create(\n    "scatter plot with brush selection, and a linked histogram",\n    df,\n    outputs=vw.outputs(selected_indices="indices of selected points")\n)\n\nwidget`}
                            />
                        </DocContent>
                    } />
                    <Route path="config" element={
                        <DocContent title="Configuration">
                            <p>Configure model settings and API keys.</p>
                            <h2>Set defaults</h2>
                            <CodeBlock
                                code={`import vibe_widget as vw\n\nvw.config(model="openai/gpt-5.2-codex")\nvw.config(mode="premium", model="openrouter")\nvw.config(execution="approve")`}
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
                                <li>outputs/inputs descriptors</li>
                                <li>full widget code for edits, audits, and runtime fixes</li>
                                <li>runtime error messages (when auto-fixing)</li>
                            </ul>
                            <p>No API keys are written to disk. Generated widgets and audit reports are stored locally in <code>.vibewidget/</code>.</p>
                        </DocContent>
                    } />
                    <Route path="create" element={
                        <DocContent title="Create">
                            <p>Create widgets from natural language prompts and data sources.</p>
                            <CodeBlock
                                code={`import vibe_widget as vw\n\nwidget = vw.create(\n    "bar chart of revenue by region",\n    df\n)\n\nwidget`}
                            />
                            <h2>Inputs and outputs</h2>
                            <p>Use <code>vw.inputs</code> to pass multiple inputs, and <code>vw.outputs</code> to define reactive state your widget exposes.</p>
                            <CodeBlock
                                code={`vw.create(\n    "...",\n    vw.inputs(df, selected_indices=other_widget.outputs.selected_indices)\n)`}
                            />
                            <CodeBlock
                                code={`scatter = vw.create(\n    "scatter with brush selection",\n    df,\n    outputs=vw.outputs(selected_indices="indices of selected points")\n)\n\nscatter.outputs.selected_indices.value`}
                            />
                            <h2>Dataflow and I/O contract</h2>
                            <p><code>vw.create</code> converts data to a list of record dicts and cleans non-JSON values (NaN/NaT/inf to <code>None</code>). Inputs and outputs are synced traitlets. When providing another widget output, Vibe Widget reads the current value once, then keeps it in sync via trait updates. Outputs start as <code>None</code> and are updated by generated JS code.</p>
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
                    <Route path="theming" element={
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
                    <Route path="edit" element={
                        <DocContent title="Edit">
                            <p>While developing interactive widgets, we often do not know what to fully specify until after the first version exists. Vibe Widget makes iteration a first-class workflow by letting you edit generated widgets through code or the UI.</p>
                            <p>Edits reuse existing code and optionally the theme, then apply requested changes. Each edit produces a new widget instance and persists a new version in the widget store.</p>
                            <h2>Python edits</h2>
                            <p>Use Python edits when you want structural changes, broader logic refactors, or to preserve edits as code in notebooks and scripts. Python edits are ideal for larger, explicit changes you want to keep versioned and reproducible.</p>
                            <CodeBlock
                                code={`v1 = vw.create("basic scatter", df)\n\n# Large or structural changes\nv2 = v1.edit("add hover tooltips and a right-side legend")`}
                            />
                            <p>Component-level edits are ideal when the widget exposes named subcomponents and you want precise changes without rewriting the full widget.</p>
                            <CodeBlock
                                code={`# Example: targeted edits via components\nv3 = v1.component.colo_legend.edit("style the legend with a muted palette", inputs=df)`}
                            />
                            <h2>UI edits</h2>
                            <p>Use UI edits for fast, interactive iteration inside the widget runtime. These are best for targeted adjustments, quick fixes, and diagnostics without switching to code.</p>
                            <h3>Source code editing</h3>
                            <p>Make precise changes in the generated JS/HTML/CSS when you need direct control over logic or styling.</p>
                            <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm">
                                <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">Image Placeholder</div>
                                <div className="mt-2 text-sm text-slate/60 font-mono">Source code editor UI with highlighted widget files.</div>
                            </div>
                            <h3>Visual editing (Edit Element)</h3>
                            <p>Select a specific element by its bounding box and issue an edit scoped to that element, using full context from the widget.</p>
                            <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm mt-4">
                                <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">Image Placeholder</div>
                                <div className="mt-2 text-sm text-slate/60 font-mono">Edit Element UI showing bounding boxes and selected element context.</div>
                            </div>
                            <h3>Auditing</h3>
                            <p>Detect issues, get recommendations, and optionally turn a concern into a fix request.</p>
                            <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm mt-4">
                                <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">Image Placeholder</div>
                                <div className="mt-2 text-sm text-slate/60 font-mono">Audit panel UI with issue list and recommendations.</div>
                            </div>
                            <h2>Code Auditing</h2>
                            <p>Audits review the current widget code and description to surface concerns, design risks, and fixes. This is designed to help you catch issues early and guide the next edit.</p>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="text-left border-b border-slate/10">
                                        <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">Level</th>
                                        <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">Scope</th>
                                        <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">When to Use</th>
                                        <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-slate/40">Output</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate/10">
                                        <td className="py-2 pr-4">fast</td>
                                        <td className="py-2 pr-4">Quick scan for top issues</td>
                                        <td className="py-2 pr-4">Early iterations, frequent checks</td>
                                        <td className="py-2">Short concern list + fixes</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 pr-4">full</td>
                                        <td className="py-2 pr-4">Deeper review, alternatives</td>
                                        <td className="py-2 pr-4">Pre-share, production polish</td>
                                        <td className="py-2">Detailed concerns + options</td>
                                    </tr>
                                </tbody>
                            </table>
                            <h3>How to use auditing</h3>
                            <p>You can run audits from Python to get a structured report without needing to re-run the widget UI.</p>
                            <CodeBlock
                                code={`# Run a fast audit and return a report\nreport = widget.audit(level="fast", display=False)\n\n# Deep audit for detailed alternatives\nfull_report = widget.audit(level="full", reuse=True, display=False)`}
                            />
                            <p>In the UI, audit recommendations can be surfaced as a checklist. You can then turn a specific concern into an edit request or keep it as a TODO for later.</p>
                            <h3>Examples</h3>
                            <CodeBlock
                                code={`# Use audit output to guide the next change\nwidget.edit("fix accessibility issues mentioned in the audit report")`}
                            />
                        </DocContent>
                    } />
                    <Route path="audit" element={
                        <DocContent title="Audit">
                            <p>Audits review widget code and behavior through a set of lenses to surface risks, usability issues, and design gaps before you ship.</p>
                            <h2>Audit framework</h2>
                            <p>Each audit runs across domains and lenses so you get feedback that is both technical and experiential.</p>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="text-left border-b border-slate/10">
                                        <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">Domain</th>
                                        <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">What It Covers</th>
                                        <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-slate/40">Key Questions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-slate/10">
                                        <td className="py-2 pr-4">DATA</td>
                                        <td className="py-2 pr-4">Input, filtering, transformations, formatting. Subdomains: <code>data.input</code>, <code>data.filtering</code>, <code>data.transformations</code>, <code>data.formatting</code>.</td>
                                        <td className="py-2">What goes in? What gets dropped? How is it changed?</td>
                                    </tr>
                                    <tr className="border-b border-slate/10">
                                        <td className="py-2 pr-4">COMPUTATION</td>
                                        <td className="py-2 pr-4">Algorithms, parameters, assumptions. Subdomains: <code>computation.algorithm</code>, <code>computation.parameters</code>, <code>computation.assumptions</code>.</td>
                                        <td className="py-2">What runs? With what settings? What does it assume?</td>
                                    </tr>
                                    <tr className="border-b border-slate/10">
                                        <td className="py-2 pr-4">PRESENTATION</td>
                                        <td className="py-2 pr-4">Visual encoding, scales, projection. Subdomains: <code>presentation.encoding</code>, <code>presentation.scales</code>, <code>presentation.projection</code>.</td>
                                        <td className="py-2">How are results shown? What is hidden or over-emphasized?</td>
                                    </tr>
                                    <tr className="border-b border-slate/10">
                                        <td className="py-2 pr-4">INTERACTION</td>
                                        <td className="py-2 pr-4">Triggers, state, propagation. Subdomains: <code>interaction.triggers</code>, <code>interaction.state</code>, <code>interaction.propagation</code>.</td>
                                        <td className="py-2">What changes on input? What persists? What updates downstream?</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 pr-4">SYSTEM</td>
                                        <td className="py-2 pr-4">Accessibility, performance, reliability. Subdomains: <code>system.accessibility</code>, <code>system.performance</code>, <code>system.reliability</code>.</td>
                                        <td className="py-2">Is it usable for everyone? Is it fast and stable?</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p>Each domain is reviewed at a second level to pinpoint the issue scope, such as <code>data.transformations</code> or <code>computation.parameters.bin_size</code>, so fixes stay targeted and explainable.</p>
                            <h2>Audit lenses</h2>
                            <p>Lenses are the perspectives applied during auditing. You can think of them as different expert reviews running together, such as accessibility, data integrity, or interaction design.</p>
                            <h2>Fast vs full audits</h2>
                            <p><strong>Fast</strong> audits provide quick issue scans for early iteration. <strong>Full</strong> audits dig deeper with alternatives and higher coverage for pre-share polish.</p>
                            <CodeBlock
                                code={`# Fast audit for quick checks\nreport = widget.audit(level="fast", display=False)\n\n# Full audit for deeper review\nfull_report = widget.audit(level="full", reuse=True, display=False)`}
                            />
                            <p>Audit outputs are stored in <code>.vibewidget/audits</code> as JSON and YAML.</p>
                            <h2>Launch an audit</h2>
                            <h3>Before widget render (Python)</h3>
                            <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm">
                                <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">GIF Placeholder</div>
                                <div className="mt-2 text-sm text-slate/60 font-mono">Run audit from Python before rendering the widget output.</div>
                            </div>
                            <h3>During UI editing</h3>
                            <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm mt-4">
                                <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">GIF Placeholder</div>
                                <div className="mt-2 text-sm text-slate/60 font-mono">Launch audit while editing the widget in the UI.</div>
                            </div>
                            <h2>Example audit results</h2>
                            <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm">
                                <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">Sample Output</div>
                                <ul className="mt-3 text-sm text-slate/70 font-mono list-disc pl-5 space-y-1">
                                    <li>Data: Axis label missing units for “Revenue”.</li>
                                    <li>Accessibility: Hover tooltips are not keyboard reachable.</li>
                                    <li>Design: Secondary controls compete with chart for visual emphasis.</li>
                                </ul>
                            </div>
                        </DocContent>
                    } />
                    <Route path="reactivity" element={
                        <DocContent title="Reactivity">
                            <p>Outputs are reactive state handles that can be passed into other widgets.</p>
                            <CodeBlock
                                code={`scatter = vw.create(\n    "scatter plot with brush selection tool",\n    df,\n    outputs=vw.outputs(selected_indices="indices of selected points")\n)\n\nhistogram = vw.create(\n    "histogram with highlighted bars for selected data",\n    vw.inputs(df, selected_indices=scatter.outputs.selected_indices)\n)`}
                            />
                            <p>When you select points in the scatter plot, the histogram updates via trait syncing. Outputs are exposed under <code>widget.outputs.&lt;name&gt;</code>.</p>
                        </DocContent>
                    } />
                    <Route path="examples/cross-widget" element={
                        <PyodideNotebook
                            cells={CROSS_WIDGET_NOTEBOOK}
                            title="Cross-Widget Interactions"
                            dataFiles={WEATHER_DATA_FILES}
                            notebookKey="cross-widget"
                        />
                    } />
                    <Route path="examples/tictactoe" element={
                        <PyodideNotebook
                            cells={TICTACTOE_NOTEBOOK}
                            title="Tic-Tac-Toe AI"
                            dataFiles={TICTACTOE_DATA_FILES}
                            notebookKey="tictactoe"
                        />
                    } />
                    <Route path="examples/pdf-web" element={
                        <PyodideNotebook
                            cells={PDF_WEB_NOTEBOOK}
                            title="PDF & Web Data Extraction"
                            dataFiles={PDF_WEB_DATA_FILES}
                            notebookKey="pdf-web"
                        />
                    } />
                    <Route path="examples/edit" element={
                        <PyodideNotebook
                            cells={REVISE_NOTEBOOK}
                            title="Widget Editing"
                            dataFiles={REVISE_DATA_FILES}
                            notebookKey="edit"
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
