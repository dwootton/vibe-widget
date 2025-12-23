import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import NotebookGuide from '../components/NotebookGuide';
import PyodideNotebook from '../components/PyodideNotebook';
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
                        </DocContent>
                    } />
                    <Route path="/config" element={
                        <DocContent title="Configuration">
                            <p>Configure your LLM provider keys.</p>
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
