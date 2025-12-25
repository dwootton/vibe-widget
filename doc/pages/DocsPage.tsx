import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import InstallationPage from './docs/InstallationPage';
import ConfigPage from './docs/ConfigPage';
import CreatePage from './docs/CreatePage';
import ThemingPage from './docs/ThemingPage';
import EditPage from './docs/EditPage';
import AuditPage from './docs/AuditPage';
import ReactivityPage from './docs/ReactivityPage';
import CrossWidgetExamplePage from './docs/examples/CrossWidgetExamplePage';
import TicTacToeExamplePage from './docs/examples/TicTacToeExamplePage';
import PdfWebExamplePage from './docs/examples/PdfWebExamplePage';
import EditExamplePage from './docs/examples/EditExamplePage';
import ComingSoonPage from './docs/ComingSoonPage';

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

const DocsPage = () => {
    return (
        <div className="flex min-h-screen bg-bone">
            <Sidebar />
            <div className="flex-1 pt-32 px-4 sm:px-8 md:px-16 pb-20 min-w-0">
                <Routes>
                    <Route index element={<InstallationPage />} />
                    <Route path="config" element={<ConfigPage />} />
                    <Route path="create" element={<CreatePage />} />
                    <Route path="theming" element={<ThemingPage />} />
                    <Route path="edit" element={<EditPage />} />
                    <Route path="audit" element={<AuditPage />} />
                    <Route path="reactivity" element={<ReactivityPage />} />
                    <Route path="examples/cross-widget" element={<CrossWidgetExamplePage />} />
                    <Route path="examples/tictactoe" element={<TicTacToeExamplePage />} />
                    <Route path="examples/pdf-web" element={<PdfWebExamplePage />} />
                    <Route path="examples/edit" element={<EditExamplePage />} />
                    <Route path="*" element={<ComingSoonPage />} />
                </Routes>
            </div>
        </div>
    );
};

export default DocsPage;
