import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { EXAMPLES, Category } from '../data/examples';
import {
    CROSS_WIDGET_NOTEBOOK,
    TICTACTOE_NOTEBOOK,
    PDF_WEB_NOTEBOOK,
    REVISE_NOTEBOOK,
    WEATHER_DATA_FILES,
    TICTACTOE_DATA_FILES,
    PDF_WEB_DATA_FILES,
    REVISE_DATA_FILES
} from '../data/pyodideNotebooks';
import PyodideNotebook from '../components/PyodideNotebook';
import DynamicWidget from '../components/DynamicWidget';
import { createWidgetModel } from '../utils/exampleDataLoader';
import { SquareArrowOutUpRight, X, Zap, Box, BarChart3, LayoutGrid } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const CATEGORIES: { label: Category; icon: any }[] = [
    { label: 'Featured', icon: Zap },
    { label: 'Data Visualization', icon: BarChart3 },
    { label: 'Reactive', icon: LayoutGrid },
    { label: '3D Simulation', icon: Box },
];

const NOTEBOOK_MAP: Record<string, any> = {
    'tic-tac-toe': { cells: TICTACTOE_NOTEBOOK, dataFiles: TICTACTOE_DATA_FILES },
    'weather-scatter': { cells: CROSS_WIDGET_NOTEBOOK, dataFiles: WEATHER_DATA_FILES },
    'weather-bars': { cells: CROSS_WIDGET_NOTEBOOK, dataFiles: WEATHER_DATA_FILES },
    'solar-system': { cells: PDF_WEB_NOTEBOOK, dataFiles: PDF_WEB_DATA_FILES },
    'hn-clone': { cells: PDF_WEB_NOTEBOOK, dataFiles: PDF_WEB_DATA_FILES },
    'covid-trends': { cells: REVISE_NOTEBOOK, dataFiles: REVISE_DATA_FILES },
};

const GalleryPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
    const [focusedId, setFocusedId] = useState<string | null>(searchParams.get('focus'));

    // Shared models for cross-widget reactivity (keyed by dataUrl for widgets that share data)
    const modelsRef = useRef<Map<string, any>>(new Map());

    useEffect(() => {
        const focus = searchParams.get('focus');
        setFocusedId(focus);
    }, [searchParams]);

    const filteredExamples = useMemo(() => {
        if (activeCategory === 'All') return EXAMPLES;
        return EXAMPLES.filter(ex => ex.categories.includes(activeCategory));
    }, [activeCategory]);

    const handleFocus = (id: string) => {
        setSearchParams({ focus: id });
    };

    const handleClose = () => {
        setSearchParams({});
    };

    const getModelForExample = (example: typeof EXAMPLES[0]) => {
        const dataUrl = example.dataUrl;
        if (!dataUrl) return undefined;

        if (!modelsRef.current.has(dataUrl)) {
            modelsRef.current.set(dataUrl, createWidgetModel([]));
        }
        return modelsRef.current.get(dataUrl);
    };

    const focusedExample = useMemo(() => EXAMPLES.find(ex => ex.id === focusedId), [focusedId]);

    return (
        <main className="relative pt-32 min-h-screen bg-bone z-20 overflow-x-hidden">
            <div className="container mx-auto px-4 mb-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-8"
                >
                    <div>
                        <h1 className="text-6xl font-display font-bold mb-4 tracking-tight">
                            WIDGET <span className="text-orange">GALLERY</span>
                        </h1>
                        <p className="text-xl text-slate/60 font-mono max-w-2xl">
                            A collection of interactive widgets synthesized from natural language.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 bg-slate/5 p-1.5 rounded-xl border border-slate/10 backdrop-blur-sm">
                        <button
                            onClick={() => setActiveCategory('All')}
                            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all ${activeCategory === 'All'
                                ? 'bg-orange text-white shadow-hard-sm'
                                : 'text-slate/40 hover:text-slate/60 hover:bg-slate/5'
                                }`}
                        >
                            All
                        </button>
                        {CATEGORIES.map(({ label, icon: Icon }) => (
                            <button
                                key={label}
                                onClick={() => setActiveCategory(label)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all ${activeCategory === label
                                    ? 'bg-orange text-white shadow-hard-sm'
                                    : 'text-slate/40 hover:text-slate/60 hover:bg-slate/5'
                                    }`}
                            >
                                <Icon className="w-3 h-3" />
                                {label}
                            </button>
                        ))}
                    </div>
                </motion.div>
            </div>

            <div className="container mx-auto px-4 pb-32">
                <AnimatePresence mode="wait">
                    {!focusedId ? (
                        <motion.div
                            key="grid"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 grid-cols-4 lg:grid-cols-6 md:grid-cols-3 gap-6 auto-rows-[300px]"
                        >
                            {filteredExamples.map((example, index) => (
                                <GalleryCard
                                    key={example.id}
                                    example={example}
                                    index={index}
                                    model={getModelForExample(example)}
                                    onOpen={() => handleFocus(example.id)}
                                />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="focus"
                            initial={{ opacity: 0, x: 100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-[calc(100vh-200px)] sm:h-[calc(100vh-250px)]"
                        >
                            {/* Sidebar List - Hidden on mobile */}
                            <div className="hidden lg:flex lg:w-80 flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar">
                                <div className="flex flex-col gap-4 w-full">
                                    <button
                                        onClick={handleClose}
                                        className="flex items-center gap-2 p-4 bg-white border-2 border-slate rounded-xl font-mono text-xs uppercase tracking-widest hover:bg-slate hover:text-white transition-all group shadow-hard-sm"
                                    >
                                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                        Back to Gallery
                                    </button>
                                    {EXAMPLES.map((ex) => (
                                        <motion.div
                                            key={ex.id}
                                            whileHover={{ x: 4 }}
                                            onClick={() => handleFocus(ex.id)}
                                            className={`
                                                p-4 rounded-xl border-2 cursor-pointer transition-all
                                                ${focusedId === ex.id
                                                    ? 'bg-orange border-orange text-white shadow-hard-sm'
                                                    : 'bg-white border-slate/10 hover:border-orange/50 text-slate'}
                                            `}
                                        >
                                            <h4 className="font-display font-bold text-sm mb-1">{ex.label}</h4>
                                            <p className={`text-[10px] font-mono uppercase tracking-tighter opacity-60`}>
                                                {ex.categories.join(' • ')}
                                            </p>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Notebook View */}
                            <motion.div
                                layoutId={`card-${focusedId}`}
                                className="flex-1 bg-white border-2 border-slate rounded-2xl shadow-hard overflow-hidden flex flex-col"
                            >
                                {/* Mobile Back Button */}
                                <button
                                    onClick={handleClose}
                                    className="lg:hidden flex items-center gap-2 p-4 m-4 mb-0 bg-white border-2 border-slate rounded-xl font-mono text-xs uppercase tracking-widest hover:bg-slate hover:text-white transition-all group shadow-hard-sm"
                                >
                                    <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                    Back to Gallery
                                </button>

                                <div className="p-4 border-b-2 border-slate/5 flex items-center justify-between bg-bone/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-red-400" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                        <div className="w-3 h-3 rounded-full bg-green-400" />
                                        <span className="ml-4 font-mono text-xs text-slate/40 uppercase tracking-widest hidden sm:inline">
                                            Synthesis Environment / {focusedExample?.label}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                                    {focusedExample && NOTEBOOK_MAP[focusedExample.id] ? (
                                        <PyodideNotebook
                                            cells={NOTEBOOK_MAP[focusedExample.id].cells}
                                            dataFiles={NOTEBOOK_MAP[focusedExample.id].dataFiles}
                                            notebookKey={focusedExample.id}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-slate/30 font-mono">
                                            <Box className="w-12 h-12 mb-4 opacity-20" />
                                            <p>Notebook environment not found for this module.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
};

const GalleryCard = ({ example, index, model, onOpen }: { example: typeof EXAMPLES[0]; index: number; model: any; onOpen: () => void }) => {
    const sizeClasses = {
        small: 'md:col-span-2 md:row-span-1',
        medium: 'md:col-span-2 md:row-span-2',
        large: 'md:col-span-4 md:row-span-2',
    };

    const hasNotebook = !!NOTEBOOK_MAP[example.id];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.5, delay: index * 0.05, type: "spring", stiffness: 200, damping: 25 }}
            className={`
                relative group bg-white border-2 border-slate rounded-2xl overflow-hidden shadow-hard hover:shadow-hard-lg transition-all
                ${sizeClasses[example.size as keyof typeof sizeClasses] || 'md:col-span-1 md:row-span-1'}
            `}
        >
            {/* Preview Area */}
            <div className="absolute inset-0 bg-slate/5 group-hover:bg-orange/5 transition-colors overflow-hidden">
                {example.gifUrl ? (
                    <img src={example.gifUrl} alt={example.label} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full p-4">
                        <DynamicWidget
                            moduleUrl={example.moduleUrl}
                            model={model}
                            exampleId={example.id}
                            dataUrl={example.dataUrl}
                            dataType={example.dataType}
                        />
                    </div>
                )}

                {/* Hover Overlay for Navigation */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 pointer-events-auto">
                        {hasNotebook && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpen();
                                }}
                                className="bg-orange text-white p-3 rounded-xl shadow-hard-sm hover:scale-110 active:scale-95 transition-all"
                                title="Open in Notebook"
                            >
                                <SquareArrowOutUpRight className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Overlay - Non-interactive part */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                    {example.categories.map((cat: string) => (
                        <span key={cat} className="text-[9px] font-mono font-bold text-orange uppercase bg-orange/10 px-2 py-0.5 rounded tracking-widest">
                            {cat}
                        </span>
                    ))}
                </div>
                <h3 className="text-2xl font-display font-bold mb-2 group-hover:text-orange transition-colors">
                    {example.label}
                </h3>
                <p className="text-xs font-mono text-slate/50 line-clamp-2 italic">
                    "{example.prompt}"
                </p>
            </div>

            {/* Decorative Corner */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-orange/20 rounded-tl-2xl pointer-events-none" />
        </motion.div>
    );
};

export default GalleryPage;