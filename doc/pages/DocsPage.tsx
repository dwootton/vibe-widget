import React, { Suspense } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
const InstallationPage = React.lazy(() => import('./docs/InstallationPage'));
const ConfigPage = React.lazy(() => import('./docs/ConfigPage'));
const CreatePage = React.lazy(() => import('./docs/CreatePage'));
const ThemingPage = React.lazy(() => import('./docs/ThemingPage'));
const EditPage = React.lazy(() => import('./docs/EditPage'));
const AuditPage = React.lazy(() => import('./docs/AuditPage'));
const ReactivityPage = React.lazy(() => import('./docs/ReactivityPage'));
const DataSourcesPage = React.lazy(() => import('./docs/DataSourcesPage'));
const ComposabilityPage = React.lazy(() => import('./docs/ComposabilityPage'));
const WidgetariumPage = React.lazy(() => import('./docs/WidgetariumPage'));
const CrossWidgetExamplePage = React.lazy(() => import('./docs/examples/CrossWidgetExamplePage'));
const TicTacToeExamplePage = React.lazy(() => import('./docs/examples/TicTacToeExamplePage'));
const PdfWebExamplePage = React.lazy(() => import('./docs/examples/PdfWebExamplePage'));
const EditExamplePage = React.lazy(() => import('./docs/examples/EditExamplePage'));
const ComingSoonPage = React.lazy(() => import('./docs/ComingSoonPage'));
import { DOC_SECTIONS } from '../data/docsManifest';

const Sidebar = () => {
    const location = useLocation();

    return (
        <div className="w-64 flex-shrink-0 border-r-2 border-slate/10 min-h-screen pt-32 px-6 bg-bone sticky top-0 h-screen overflow-y-auto hidden md:block">
            {DOC_SECTIONS.map((section, i) => (
                <div key={i} className="mb-8">
                    <h3 className="font-display font-bold text-lg mb-4">{section.title}</h3>
                    <div className="flex flex-col gap-2 font-mono text-sm">
                        {section.links.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`
                                    py-1 px-2 rounded transition-colors
                                    ${location.pathname === link.path ? 'bg-orange text-white' : 'text-slate/60 hover:text-orange'}
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
                <Suspense
                    fallback={(
                        <div className="text-slate/60 font-mono">Loading docs…</div>
                    )}
                >
                    <Routes>
                        <Route index element={<InstallationPage />} />
                        <Route path="config" element={<ConfigPage />} />
                        <Route path="create" element={<CreatePage />} />
                        <Route path="theming" element={<ThemingPage />} />
                        <Route path="edit" element={<EditPage />} />
                        <Route path="audit" element={<AuditPage />} />
                        <Route path="reactivity" element={<ReactivityPage />} />
                        <Route path="data-sources" element={<DataSourcesPage />} />
                        <Route path="composability" element={<ComposabilityPage />} />
                        <Route path="widgetarium" element={<WidgetariumPage />} />
                        <Route path="examples/cross-widget" element={<CrossWidgetExamplePage />} />
                        <Route path="examples/tictactoe" element={<TicTacToeExamplePage />} />
                        <Route path="examples/pdf-web" element={<PdfWebExamplePage />} />
                        <Route path="examples/edit" element={<EditExamplePage />} />
                        <Route path="*" element={<ComingSoonPage />} />
                    </Routes>
                </Suspense>
            </div>
        </div>
    );
};

export default DocsPage;
