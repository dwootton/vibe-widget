import React, { useState, useMemo, useEffect } from 'react';
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
import { SquareArrowOutUpRight, X, Filter, LayoutGrid, Zap, Box, BarChart3 } from 'lucide-react';
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
    'weather-bars': { cells: CROSS_WIDGET_NOTEBOOK, dataFiles: WEATHER_DATA_FILES }, // Shared for now
    'solar-system': { cells: PDF_WEB_NOTEBOOK, dataFiles: PDF_WEB_DATA_FILES },
    'hn-clone': { cells: PDF_WEB_NOTEBOOK, dataFiles: PDF_WEB_DATA_FILES }, // Shared for now
    'revise-demo': { cells: REVISE_NOTEBOOK, dataFiles: REVISE_DATA_FILES },
};

const GalleryPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState<Category | 'All'>('All');
    const [focusedId, setFocusedId] = useState<string | null>(searchParams.get('focus'));

    useEffect(() => {
        const focus = searchParams.get('focus');
        if (focus) {
            setFocusedId(focus);
        } else {
            setFocusedId(null);
        }
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
                            A collection of high-performance, reactive widgets synthesized from natural language.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex flex-wrap gap-2 bg-slate/5 p-1.5 rounded-xl border border-slate/10 backdrop-blur-sm">
                        <button
                            onClick={() => setActiveCategory('All')}
                            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-all ${activeCategory === 'All'
                                ? 'bg-orange text-white shadow-hard-sm'
                                : 'text-slate/40 hover:text-slate/60 hover:bg-slate/5'
                                }`}
                        >
                            All Modules
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
                                    onClick={() => handleFocus(example.id)}
                                />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="focus"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-250px)]"
                        >
                            {/* Sidebar List */}
                            <div className="w-full lg:w-80 flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar">
                                <div className="flex flex-col gap-4">
                                    <button
                                        onClick={handleClose}
                                        className="flex items-center gap-2 p-4 bg-white border-2 border-slate rounded-xl font-mono text-xs uppercase tracking-widest hover:bg-slate hover:text-white transition-all group"
                                    >
                                        <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                        Back to Gallery
                                    </button>
                                    {EXAMPLES.map((ex) => (
                                        <div
                                            key={ex.id}
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
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notebook View */}
                            <div className="flex-1 bg-white border-2 border-slate rounded-2xl shadow-hard overflow-hidden flex flex-col">
                                <div className="p-4 border-b-2 border-slate/5 flex items-center justify-between bg-bone/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-red-400" />
                                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                        <div className="w-3 h-3 rounded-full bg-green-400" />
                                        <span className="ml-4 font-mono text-xs text-slate/40 uppercase tracking-widest">
                                            Synthesis Environment / {focusedExample?.label}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
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
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
};

const GalleryCard = ({ example, index, onClick }: { example: any; index: number; onClick: () => void }) => {
    const sizeClasses = {
        small: 'md:col-span-1 md:row-span-1',
        medium: 'md:col-span-2 md:row-span-1',
        large: 'md:col-span-2 md:row-span-2',
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            whileHover={{ y: -8 }}
            onClick={onClick}
            className={`
                relative group cursor-pointer bg-white border-2 border-slate rounded-2xl overflow-hidden shadow-hard hover:shadow-hard-lg transition-all
                ${sizeClasses[example.size as keyof typeof sizeClasses] || 'md:col-span-1 md:row-span-1'}
            `}
        >
            {/* Preview Area */}
            <div className="absolute inset-0 bg-slate/5 group-hover:bg-orange/5 transition-colors">
                {/* Placeholder for GIF/Preview */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                    <div className="w-full h-full bg-grid-pattern opacity-10" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-mono text-[100px] font-bold text-slate/10 select-none">
                            {example.id.slice(0, 2).toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Hover Icon */}
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                    <div className="bg-orange text-white p-3 rounded-xl shadow-hard-sm">
                        <SquareArrowOutUpRight className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/90 to-transparent">
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
