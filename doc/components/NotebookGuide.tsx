import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { Package, Play, ArrowDown, Database, Upload, Download, CheckCircle, Terminal, ListCheck, SquarePen } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const NotebookCell = ({ index, title, code, output, isActive, icon }: any) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { margin: "-40% 0px -40% 0px" });

    // Simulated typing effect for code
    const [typedCode, setTypedCode] = useState("");
    const hasTypedOnceRef = useRef(false);
    const typingIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (isInView && !hasTypedOnceRef.current) {
            hasTypedOnceRef.current = true;
            let i = 0;
            typingIntervalRef.current = window.setInterval(() => {
                setTypedCode(code.slice(0, i));
                i++;
                if (i > code.length) {
                    if (typingIntervalRef.current) {
                        clearInterval(typingIntervalRef.current);
                        typingIntervalRef.current = null;
                    }
                    setTypedCode(code);
                }
            }, 15);
            return () => {
                if (typingIntervalRef.current) {
                    clearInterval(typingIntervalRef.current);
                    typingIntervalRef.current = null;
                }
            };
        }
        if (!isInView) {
            if (typingIntervalRef.current) {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
            }
            setTypedCode(code);
        }
    }, [isInView, code]);

    // Custom style for syntax highlighter that matches the design
    const customStyle = {
        background: '#1A1A1A',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        margin: 0,
        fontSize: '13px',
        lineHeight: '1.5',
        fontFamily: 'Space Mono, JetBrains Mono, monospace',
    };

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, type: "spring" }}
            className={`flex flex-col gap-4 p-8 rounded-2xl border-2 transition-all duration-700 ease-out perspective-1000 ${isInView ? 'border-orange bg-white shadow-hard-lg scale-100' : 'border-slate/5 bg-white/20 opacity-30 scale-95'}`}
        >
            <div className="font-mono text-sm space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate/40">
                        <Terminal className="w-4 h-4" />
                        <span className="text-[10px] uppercase tracking-widest font-bold">Cell: {index}</span>
                    </div>
                    {isInView && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter ${output ? 'bg-green-500/10 text-green-600' : 'bg-orange/10 text-orange'}`}
                        >
                            {output ? 'Executed' : 'Executing...'}
                        </motion.div>
                    )}
                </div>

                <div className="bg-slate text-bone rounded-xl border-l-4 border-orange relative overflow-hidden shadow-inner">
                    {/* Syntax highlighted code with typing animation */}
                    {typedCode.length > 0 ? (
                        <div className="relative">
                            <SyntaxHighlighter
                                language="python"
                                style={vscDarkPlus}
                                customStyle={customStyle}
                                PreTag="div"
                                CodeTag="code"
                                showLineNumbers={false}
                            >
                                {typedCode}
                            </SyntaxHighlighter>
                            {/* Typing cursor */}
                            {typedCode.length < code.length && (
                                <span className="absolute bottom-5 right-5 inline-block w-1.5 h-4 bg-orange animate-pulse" />
                            )}
                        </div>
                    ) : (
                        <div style={customStyle}>
                            <span className="inline-block w-1.5 h-4 bg-orange animate-pulse" />
                        </div>
                    )}
                </div>
            </div>

            {/* Fixed: AnimatePresence was not imported */}
            <AnimatePresence>
                {isInView && output && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ delay: 0.4 }}
                        className="font-mono text-sm mt-4"
                    >
                        <div className="flex items-center gap-2 mb-3 text-orange/60">
                            <span className="text-[10px] font-bold uppercase tracking-widest">Output</span>
                            <div className="h-px bg-orange/10 flex-1" />
                        </div>
                        <div className="p-5 bg-bone rounded-xl border-2 border-dashed border-slate/10 shadow-inner">
                            {output}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const NotebookGuide = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    const bamako = [
        "#002b51", "#114a5b", "#27675f", "#48825f", "#6a9c5d",
        "#8fb55d", "#b4cb61", "#d8de6c", "#f3eb7a", "#fff595", "#ffffb3"
    ];

    const steps = [
        { id: 1, label: "Initialization", icon: <Package className="w-4 h-4" /> },
        { id: 2, label: "Synthesis", icon: <SquarePen className="w-4 h-4" /> },
        { id: 3, label: "Audit", icon: <ListCheck className="w-4 h-4" /> },
        { id: 4, label: "Refinement", icon: <Upload className="w-4 h-4" /> },
        { id: 5, label: "Exportation", icon: <Download className="w-4 h-4" /> }
    ];

    // Map scroll progress to active step (2 cells per step)
    const [activeStep, setActiveStep] = useState(1);
    scrollYProgress.on("change", (latest) => {
        const step = Math.min(Math.floor(latest * (steps.length / 1.2)) + 1, steps.length);
        setActiveStep(step);
    });

    return (
        <div ref={containerRef} className="bg-bone min-h-[200vh] relative pt-32">
            <div className="container mx-auto px-6 md:px-24">
                <div className="flex flex-col lg:flex-row gap-16">
                    {/* Left Column: Sticky Nav */}
                    <div className="lg:w-[400px] lg:flex-shrink-0">
                        <div className="sticky top-20 space-y-10 pt-6">
                            <div className="space-y-4">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    whileInView={{ scale: 1 }}
                                    className="w-14 h-14 bg-orange text-white rounded-2xl shadow-hard flex items-center justify-center"
                                >
                                    <Database className="w-7 h-7" />
                                </motion.div>
                                <h2 className="text-5xl font-display leading-none tracking-tighter"> vw.<span className="text-orange font-bold ">Tutorial</span></h2>
                                <p className="text-lg text-slate/50 font-sans leading-relaxed max-w-[320px]">
                                    VibeWidgets offers methods to create, revise, audit, and theme widgets via plain English.
                                </p>
                            </div>

                            <div className="relative space-y-6 border-l-2 border-slate/5 ml-4">
                                {/* Moving Indicator */}
                                <motion.div
                                    className="absolute -left-[3px] -top-[30px] w-1.5 h-12 bg-orange rounded-full z-10 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                    animate={{ top: (activeStep - 1) * 64 - 12 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                                {steps.map((step) => (
                                    <div
                                        key={step.id}
                                        className={`pl-8 flex items-center gap-4 transition-all duration-500 ${activeStep === step.id ? 'text-orange scale-105 opacity-100' : 'text-slate/30 opacity-40 grayscale'}`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors ${activeStep === step.id ? 'border-orange bg-orange/5' : 'border-slate/10'}`}>
                                            {step.icon}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40">Step 0{step.id}</span>
                                            <span className="text-sm font-bold font-display">{step.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Cells */}
                    <div className="flex-1 space-y-40 pb-20">
                        <NotebookCell
                            index={1}
                            icon={<Package />}
                            code={`import vibe_widget as vw

# Configure runtime environment
vw.config(theme="vibe-widgets")`}
                            output={
                                <div className="text-slate/60 text-xs font-mono leading-relaxed">
                                    [SYSTEM] Initializing Vibe-Engine v.1.0.4...<br />
                                    [AUTH] Provider: Google Gemini-3-Pro<br />
                                    <span className="text-green-600 font-bold">[READY] Core components loaded successfully.</span>
                                </div>
                            }
                        />

                        <NotebookCell
                            index={2}
                            icon={<Play />}
                            code={`# Synthesize visualization\ndashboard = vw.create(\n  "heatmap of global carbon emissions",\n  data=emissions_df\n)`}
                            output={
                                <div className="bg-white border-2 border-slate p-1 rounded-xl shadow-sm h-40 flex items-center justify-center overflow-hidden relative">
                                    <div className="absolute inset-0 bg-orange/5 animate-pulse" />
                                    <div className="grid grid-cols-10 gap-0.5 w-full h-full p-2">
                                        {[...Array(50)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-full h-full rounded-[1px] transition-all duration-1000"
                                                style={{
                                                    backgroundColor: i % 3 === 0 ? '#f97316' : i % 5 === 0 ? '#1A1A1A' : '#e5e7eb',
                                                    opacity: Math.random() * 0.8 + 0.2
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold border border-slate/5 shadow-sm">Grid Preview Generated</span>
                                    </div>
                                </div>
                            }
                        />

                        <NotebookCell
                            index={3}
                            icon={<Upload />}
                            code={`# Audit the heatmap\ndashboard.audit(level="fast")`}
                            output={
                                <div className="bg-white border-2 border-slate p-4 rounded-xl shadow-sm text-xs font-mono text-slate/70 leading-relaxed">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] uppercase tracking-widest text-orange font-bold">Audit • Fast</span>
                                        <span className="text-[10px] uppercase tracking-widest text-slate/40">Heatmap</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-orange font-bold">Issue 1:</span> Color scale is not perceptually uniform; small value differences are hard to read.
                                        </div>
                                        <div>
                                            <span className="text-orange font-bold">Issue 2:</span> Missing legend makes it unclear how colors map to emissions values.
                                        </div>
                                        <div className="text-slate/50">
                                            Suggested fix: switch to a colorblind-safe palette and add a labeled color legend.
                                        </div>
                                    </div>
                                </div>
                            }
                        />

                        <NotebookCell
                            index={4}
                            icon={<Upload />}
                            code={`# Apply audit fix\ndashboard.edit(\n  "use a perceptually uniform palette and filter to just europe",\n)`}
                            output={
                                <div className="bg-white border-2 border-slate p-2 rounded-xl shadow-sm h-40 flex flex-col overflow-hidden">
                                    <div className="grid grid-cols-10 gap-0.5 w-full h-full p-2">
                                        {[...Array(50)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-full h-full rounded-[1px]"
                                                style={{
                                                    backgroundColor: bamako[i % bamako.length],
                                                    opacity: Math.random() * 0.8 + 0.2
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div className="mt-1 px-2 pb-1 flex items-center gap-2 text-[9px] font-mono text-slate/60">
                                        <span>Low</span>
                                        <div className="flex-1 h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, #002b51, #27675f, #6a9c5d, #b4cb61, #f3eb7a, #ffffb3)" }} />
                                        <span>High</span>
                                    </div>
                                </div>
                            }
                        />

                        <NotebookCell
                            index={5}
                            icon={<Download />}
                            code={`# Persistence\ndashboard.save("climate_report.vw")`}
                            output={
                                <div className="text-slate/60 text-xs flex items-center gap-3 bg-white p-3 rounded-lg border border-slate/10">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate">climate_report.vw</span>
                                        <span className="opacity-50">342KB • Binary Synthesis Format</span>
                                    </div>
                                </div>
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotebookGuide;
