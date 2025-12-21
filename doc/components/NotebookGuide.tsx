import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { Package, Play, ArrowDown, Database, Upload, Download, CheckCircle, Terminal } from 'lucide-react';

const NotebookCell = ({ index, title, code, output, isActive, icon }: any) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { margin: "-40% 0px -40% 0px" });
    
    // Simulated typing effect for code
    const [typedCode, setTypedCode] = useState("");
    
    useEffect(() => {
        if (isInView) {
            let i = 0;
            const interval = setInterval(() => {
                setTypedCode(code.slice(0, i));
                i++;
                if (i > code.length) clearInterval(interval);
            }, 15);
            return () => clearInterval(interval);
        }
    }, [isInView, code]);

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
                            className="px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-[9px] font-bold uppercase tracking-tighter"
                        >
                            Executing...
                        </motion.div>
                    )}
                </div>
                
                <div className="bg-slate text-bone p-5 rounded-xl border-l-4 border-orange relative overflow-hidden shadow-inner">
                    <pre className="text-[13px] leading-relaxed whitespace-pre-wrap">{typedCode}<span className="inline-block w-1.5 h-4 bg-orange ml-1 animate-pulse" /></pre>
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

    const steps = [
        { id: 1, label: "Initialization", icon: <Package className="w-4 h-4" /> },
        { id: 2, label: "Synthesis", icon: <Play className="w-4 h-4" /> },
        { id: 3, label: "Refinement", icon: <Upload className="w-4 h-4" /> },
        { id: 4, label: "Exportation", icon: <Download className="w-4 h-4" /> }
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
                        <div className="sticky top-10 space-y-10">
                             <div className="space-y-4">
                                <motion.div 
                                    initial={{ scale: 0 }}
                                    whileInView={{ scale: 1 }}
                                    className="w-14 h-14 bg-orange text-white rounded-2xl shadow-hard flex items-center justify-center"
                                >
                                    <Database className="w-7 h-7" />
                                </motion.div>
                                <h2 className="text-6xl font-display font-bold leading-none tracking-tighter">The Lab <br/><span className="text-orange">Log.</span></h2>
                                <p className="text-lg text-slate/50 font-sans leading-relaxed max-w-[320px]">
                                   VibeWidget treats your data exploration as a continuous, reproducible conversation.
                                </p>
                             </div>

                             <div className="relative space-y-6 border-l-2 border-slate/5 ml-4">
                                {/* Moving Indicator */}
                                <motion.div 
                                    className="absolute -left-[3px] w-1.5 h-12 bg-orange rounded-full z-10 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                    animate={{ top: (activeStep - 1) * 64 }}
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
                            code="import vibe_widget as vw\n\n# Configure runtime environment\nvw.setup(provider='gemini', theme='retro')"
                            output={
                                <div className="text-slate/60 text-xs font-mono leading-relaxed">
                                    [SYSTEM] Initializing Vibe-Engine v.1.0.4...<br/>
                                    [AUTH] Provider: Google Gemini-3-Pro<br/>
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
                            code={`# Interactive refinement\ndashboard.revise(\n  "zoom into Europe and use a toxic color scale",\n)`}
                            output={
                                <div className="bg-slate border-2 border-black p-1 rounded-xl shadow-lg h-40 flex items-center justify-center overflow-hidden">
                                     <div className="grid grid-cols-10 gap-0.5 w-full h-full p-2">
                                        {[...Array(50)].map((_, i) => (
                                            <div 
                                                key={i} 
                                                className="w-full h-full rounded-[1px]"
                                                style={{ 
                                                    backgroundColor: i % 2 === 0 ? '#fbbf24' : '#ef4444',
                                                    opacity: Math.random() * 0.9 + 0.1
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            }
                        />
                        
                         <NotebookCell 
                            index={4}
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