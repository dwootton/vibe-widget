import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import NotebookGuide from '../components/NotebookGuide';

const Sidebar = () => {
    const location = useLocation();

    const sections = [
        { title: "Getting Started", links: [
            { label: "Installation", href: "/docs" },
            { label: "Configuration", href: "/docs/config" },
        ]},
        { title: "Core Concepts", links: [
            { label: "Create", href: "/docs/create" },
            { label: "Edit", href: "/docs/edit" },
            { label: "Inputs + Outputs", href: "/docs/inputs-outputs" },
            { label: "Themes", href: "/docs/themes" },
            { label: "Audit", href: "/docs/audit" },
        ]},
        { title: "Ecosystem", links: [
            { label: "Widgetarium", href: "/docs/widgetarium" },
        ]}
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

const DocsPage = () => {
    return (
        <div className="flex min-h-screen bg-bone">
            <Sidebar />
            <div className="flex-1 pt-32 px-8 md:px-16 pb-20">
                <Routes>
                    <Route path="/" element={
                        <DocContent title="Installation">
                            <p className="text-xl text-slate/70 mb-8">Get up and running with Vibe Widget in seconds.</p>
                            <div className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-8">
                                <code className="font-mono text-orange">pip install vibe-widget</code>
                            </div>
                            <p className="mb-4">Vibe Widget requires Python 3.8+.</p>
                            <NotebookGuide />
                        </DocContent>
                    } />
                    <Route path="/config" element={
                        <DocContent title="Configuration">
                            <p className="mb-4">Set a default model, mode, and execution behavior for all widgets.</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6 overflow-x-auto"><code>{`import vibe_widget as vw

vw.config(model="openai/gpt-5.1-codex")
vw.config(mode="premium")
vw.config(execution="approve")  # review before run
`}</code></pre>
                            <p className="mb-2">Execution modes:</p>
                            <ul>
                                <li><code>execution="auto"</code> renders immediately (audits are opt-in).</li>
                                <li><code>execution="approve"</code> opens the review UI and requires approval before running.</li>
                            </ul>
                            <p>Use <code>vw.models()</code> to list pinned model names.</p>
                        </DocContent>
                    } />
                    <Route path="/create" element={
                        <DocContent title="Create">
                            <p className="mb-6">Create a new widget from scratch using a natural language prompt.</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6 overflow-x-auto"><code>{`widget = vw.create(
  "bar chart of sales by region, sorted high to low, with tooltips",
  df,
  outputs=vw.outputs(selected_indices="indices of selected points"),
  theme="paper",
  display=True,
  cache=True
)`}</code></pre>
                            <h2>Key Parameters</h2>
                            <ul>
                                <li><code>outputs</code>: named outputs exposed by the widget.</li>
                                <li><code>inputs</code>: input bindings and data for reactive widgets.</li>
                                <li><code>theme</code>: a theme name, prompt string, or <code>vw.theme(...)</code> object.</li>
                                <li><code>display</code>: auto-render in notebooks.</li>
                                <li><code>cache</code>: reuse cached code and themes when possible.</li>
                            </ul>
                        </DocContent>
                    } />
                    <Route path="/edit" element={
                        <DocContent title="Edit">
                            <p className="mb-6">Iterate on an existing widget instance while preserving context.</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6 overflow-x-auto"><code>{`v2 = widget.edit("make the bars horizontal and add value labels")`}</code></pre>
                            <p className="mb-6">You can also edit from a component:</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6 overflow-x-auto"><code>{`v3 = vw.edit("restyle the slider", widget.component.slider)`}</code></pre>
                        </DocContent>
                    } />
                    <Route path="/inputs-outputs" element={
                        <DocContent title="Inputs + Outputs">
                            <p className="mb-6">Outputs define shareable state. Inputs define what a widget consumes.</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6 overflow-x-auto"><code>{`scatter = vw.create(
  "scatter with brush selection",
  df,
  vw.outputs(selected_indices="indices of selected points")
)

hist = vw.create(
  "histogram highlighting selection",
  vw.inputs(df, selected_indices=scatter.outputs.selected_indices)
)`}</code></pre>
                            <ul>
                                <li><code>vw.outputs(...)</code> requires named parameters.</li>
                                <li><code>vw.inputs(...)</code> accepts positional and named parameters.</li>
                                <li>Access live values via <code>widget.outputs.&lt;name&gt;()</code>.</li>
                            </ul>
                        </DocContent>
                    } />
                    <Route path="/themes" element={
                        <DocContent title="Themes">
                            <p className="mb-6">Themes control the visual language of generated widgets.</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6 overflow-x-auto"><code>{`widget = vw.create(
  "heatmap of global emissions",
  df,
  theme="dusty cyan with warm gridlines"
)`}</code></pre>
                            <p className="mb-4">Use built-in themes or build one from a prompt:</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6 overflow-x-auto"><code>{`t = vw.theme("paper")
widget = vw.create("...", df, theme=t)`}</code></pre>
                            <p>Call <code>vw.themes()</code> to list available theme names.</p>
                        </DocContent>
                    } />
                    <Route path="/audit" element={
                        <DocContent title="Audit">
                            <p className="mb-6">Audit inspects generated code and reports risks or issues.</p>
                            <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6 overflow-x-auto"><code>{`report = widget.audit(level="fast", reuse=True, display=True)
# use level="full" for deeper analysis`}</code></pre>
                        </DocContent>
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
