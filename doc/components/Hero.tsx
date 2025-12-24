import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Terminal, Copy, ChevronDown, Check, Sparkles } from 'lucide-react';
import { EXAMPLES } from '../data/examples';
import DynamicWidget from './DynamicWidget';
import { useIsMobile } from '../utils/useIsMobile';

const RetroCat = () => (
    <svg viewBox="0 0 200 100" className="w-48 h-24 absolute -top-20 left-10 z-20 overflow-visible">
        <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                <feOffset dx="2" dy="2" result="offsetblur" />
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.3" />
                </feComponentTransfer>
                <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
        {/* Tail Animation */}
        <motion.path
            d="M 160 80 Q 190 80 190 50 Q 190 20 160 30"
            fill="none"
            stroke="#ea580c"
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ d: "M 160 80 Q 180 80 180 60 Q 180 50 160 60" }}
            animate={{ d: "M 160 80 Q 200 90 195 40 Q 180 20 160 40" }}
            transition={{ repeat: Infinity, repeatType: "mirror", duration: 2, ease: "easeInOut" }}
        />
        {/* Body */}
        <path d="M 40 80 L 160 80 A 10 10 0 0 0 170 70 L 170 50 A 20 20 0 0 0 150 30 L 60 30 A 10 10 0 0 0 50 40 L 50 70 A 10 10 0 0 0 40 80" fill="#1A1A1A" filter="url(#shadow)" />
        {/* Head */}
        <g transform="translate(30, 20)">
            <rect x="0" y="20" width="50" height="40" rx="12" fill="#1A1A1A" />
            <path d="M 5 20 L 0 5 L 15 20" fill="#1A1A1A" />
            <path d="M 45 20 L 50 5 L 35 20" fill="#1A1A1A" />
            <motion.rect
                x="12" y="35" width="8" height="8" rx="2" fill="#f97316"
                animate={{ scaleY: [1, 0.1, 1] }}
                transition={{ repeat: Infinity, duration: 4, delay: 0.5 }}
            />
            <motion.rect
                x="30" y="35" width="8" height="8" rx="2" fill="#f97316"
                animate={{ scaleY: [1, 0.1, 1] }}
                transition={{ repeat: Infinity, duration: 4, delay: 0.6 }}
            />
        </g>
        <rect x="50" y="80" width="20" height="8" rx="4" fill="#F2F0E9" />
        <rect x="140" y="80" width="20" height="8" rx="4" fill="#F2F0E9" />
    </svg>
);

const GLITCH_PHRASES = [
    'LANGUAGE TO WIDGETS',
    'CONTROLLED ITERATION',
    'PDF & WEB DATA SUPPORT',
    'REACTIVE WIDGET',
];

const GLITCH_CHARS = '!<>-_\\/[]{}-=+*^?#________';

const GlitchSubtitle = () => {
    const [displayText, setDisplayText] = useState(GLITCH_PHRASES[0]);
    const [isGlitching, setIsGlitching] = useState(false);
    const phraseIndexRef = useRef(0);
    const scrambleTimeout = useRef<number | null>(null);
    const cycleTimeout = useRef<number | null>(null);

    useEffect(() => {
        const TOTAL_FRAMES = 12;
        const FRAME_DURATION = 60;
        const cycleDelay = 3200;

        const startCycle = () => {
            cycleTimeout.current = window.setTimeout(() => {
                setIsGlitching(true);
                let frame = 0;
                const nextIndex = (phraseIndexRef.current + 1) % GLITCH_PHRASES.length;
                const target = GLITCH_PHRASES[nextIndex];

                const glitchFrame = () => {
                    frame += 1;
                    const revealCount = Math.floor((frame / TOTAL_FRAMES) * target.length);
                    const scrambled = target
                        .split('')
                        .map((char, idx) => (idx < revealCount ? char : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]))
                        .join('');
                    setDisplayText(scrambled || target);

                    if (frame >= TOTAL_FRAMES) {
                        phraseIndexRef.current = nextIndex;
                        setDisplayText(target);
                        setIsGlitching(false);
                        startCycle();
                        return;
                    }

                    scrambleTimeout.current = window.setTimeout(glitchFrame, FRAME_DURATION);
                };

                glitchFrame();
            }, cycleDelay);
        };

        startCycle();

        return () => {
            if (scrambleTimeout.current) {
                clearTimeout(scrambleTimeout.current);
            }
            if (cycleTimeout.current) {
                clearTimeout(cycleTimeout.current);
            }
        };
    }, []);

    return (
        <div className="flex items-center gap-3 font-mono text-sm tracking-[0.3em] uppercase text-slate/60">
            <span className="inline-flex h-2 w-2 rounded-full bg-orange animate-pulse" aria-hidden="true" />
            <span
                className={`glitch-text ${isGlitching ? 'glitch-active' : ''}`}
                data-text={displayText}
            >
                {displayText}
            </span>
        </div>
    );
};

const Hero = () => {
    const [selectedExample, setSelectedExample] = useState(EXAMPLES[1]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'complete'>('complete');
    const [inputText, setInputText] = useState("");
    const [filteredExamples, setFilteredExamples] = useState(EXAMPLES);
    const [packageVersion, setPackageVersion] = useState<string | null>(null);
    const isMobile = useIsMobile();

    const { scrollY } = useScroll();

    const textY = useTransform(scrollY, [0, 800], [0, 250]);
    const simulatorY = useTransform(scrollY, [0, 800], [0, -100]);
    const opacity = useTransform(scrollY, [0, 600], [1, 0]);

    useEffect(() => {
        if (inputText) {
            const filtered = EXAMPLES.filter(ex =>
                ex.prompt.toLowerCase().includes(inputText.toLowerCase()) ||
                ex.label.toLowerCase().includes(inputText.toLowerCase())
            );
            setFilteredExamples(filtered);
        } else {
            setFilteredExamples(EXAMPLES);
        }
    }, [inputText]);

    const handleSelect = (example: typeof EXAMPLES[0]) => {
        setSelectedExample(example);
        setInputText(example.prompt);
        setIsMenuOpen(false);
        setGenerationState('idle');
    };

    const handleRun = (e: React.FormEvent) => {
        e.preventDefault();
        setGenerationState('generating');
        setTimeout(() => {
            setGenerationState('complete');
        }, 1500);
    };

    async function getLatestPyPIVersion(packageName) {
        const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
        if (!response.ok) {
            throw new Error('Failed to fetch package info');
        }
        const data = await response.json();
        console.log(data);
        return data.info.version;
    }

    useEffect(() => {
        getLatestPyPIVersion('vibe-widget')
            .then(version => setPackageVersion(version))
            .catch(err => console.error(err));
    }, []);

    const titleWords = "Build Interfaces for Interactive Exploration.".split(" ");

    const wrapperClasses = `w-full z-0 flex flex-col px-4 md:px-12 max-w-7xl mx-auto ${isMobile ? 'relative pt-24 pb-12 h-auto' : 'sticky top-0 h-screen pt-32 pb-20'} pointer-events-none`;
    const gridClasses = `grid grid-cols-1 lg:grid-cols-12 gap-10 items-center pointer-events-auto ${isMobile ? 'py-8' : 'h-full'}`;

    return (
        <div className={wrapperClasses}>
            <div className={gridClasses}>

                {/* Left Column */}
                <motion.div style={isMobile ? undefined : { y: textY, opacity }} className={`lg:col-span-6 space-y-8 z-10 flex flex-col justify-center ${isMobile ? '' : 'h-full pb-32'}`}>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate/20 bg-bone/80 backdrop-blur-sm w-fit"
                    >
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-mono font-medium tracking-wide uppercase">{`${packageVersion} Live`}</span>
                    </motion.div>

                    <h1 className="text-4xl md:text-6xl font-display font-bold leading-[0.9] tracking-tighter mix-blend-multiply flex flex-wrap gap-x-4">
                        {titleWords.map((word, i) => (
                            <motion.span
                                key={i}
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i, type: "spring", stiffness: 100 }}
                                className={word.includes('.') ? 'text-orange' : ''}
                            >
                                {word}
                            </motion.span>
                        ))}
                    </h1>

                    <GlitchSubtitle />

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-xl md:text-2xl text-slate/70 max-w-xl font-sans leading-relaxed"
                    >
                        Create, revise, audit, and wire widgets together via plain English.
                        Run your widgets in JupyterLab · VS Code · Colab. Powered by AnyWidget.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="flex flex-wrap gap-4 pt-4"
                    >
                        <div
                            className="flex items-center gap-3 px-6 py-4 border-2 border-slate/10 rounded-md font-mono text-sm bg-white/50 shadow-hard-sm hover:shadow-hard hover:-translate-y-1 transition-all cursor-pointer group"
                            onClick={() => {
                                navigator.clipboard.writeText(`pip install vibe-widget`);
                            }}
                        >
                            <span className="text-orange">$</span>
                            <span>pip install vibe-widget</span>
                            <Copy className="w-4 h-4 text-slate/40 group-hover:text-orange transition-colors" />
                        </div>
                    </motion.div>
                </motion.div>

                {/* Right Column */}
                <motion.div style={isMobile ? undefined : { y: simulatorY }} className={`lg:col-span-6 relative mt-10 lg:mt-0 ${isMobile ? '' : 'pb-32'}`}>
                    {!isMobile && <RetroCat />}

                    <motion.div
                        initial={{ opacity: 0, scale: isMobile ? 1 : 0.95, rotateY: isMobile ? 0 : 18 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        transition={{ duration: 1, type: "spring", stiffness: 50 }}
                        className="relative z-10 bg-bone border-4 border-slate rounded-2xl shadow-hard-lg p-2 flex flex-col gap-0 min-h-[450px] perspective-1000"
                    >
                        {/* Header */}
                        <div className="bg-slate text-bone p-3 rounded-t-lg flex justify-between items-center">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-orange/80 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                <div className="w-3 h-3 rounded-full bg-bone/20" />
                            </div>
                            <div className="flex gap-1">
                                {[1, 2, 3].map(i => <div key={i} className="w-1 h-3 bg-bone/20" />)}
                            </div>
                        </div>

                        <div className="bg-white border-b-2 border-slate/10 p-4 relative z-50">
                            <form onSubmit={handleRun} className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-orange">
                                    <Terminal className="w-4 h-4" />
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        value={inputText}
                                        onChange={(e) => {
                                            setInputText(e.target.value);
                                            setIsMenuOpen(true);
                                        }}
                                        onFocus={() => setIsMenuOpen(true)}
                                        placeholder="Describe your visualization..."
                                        className="w-full bg-bone/50 border-2 border-slate/10 rounded py-3 pl-10 pr-10 font-mono text-sm focus:outline-none focus:border-orange focus:ring-0 transition-all placeholder:opacity-30"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate/40 hover:text-orange" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {isMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate rounded shadow-hard z-50 overflow-hidden max-h-60 overflow-y-auto"
                                        >
                                            {filteredExamples.length === 0 ? (
                                                <div className="px-4 py-3 font-mono text-xs text-slate/50">No matches...</div>
                                            ) : (
                                                filteredExamples.map((ex) => (
                                                    <div
                                                        key={ex.id}
                                                        onClick={() => handleSelect(ex)}
                                                        className="px-4 py-3 hover:bg-orange/10 cursor-pointer font-mono text-xs flex justify-between items-center group border-b border-slate/5 last:border-0"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="font-bold group-hover:text-orange transition-colors">{ex.label}</span>
                                                            <span className="text-slate/50 truncate max-w-[250px] italic">{ex.prompt}</span>
                                                        </div>
                                                        {selectedExample.id === ex.id && <Check className="w-3 h-3 text-orange" />}
                                                    </div>
                                                ))
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </form>
                        </div>

                        {/* Screen Area */}
                        <div className="flex-1 bg-[#F2F0E9] relative overflow-hidden rounded-b-lg p-1">
                            <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.05)] pointer-events-none z-20" />
                            <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(26,26,26,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(26,26,26,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />

                            <div className="relative z-10 w-full h-full flex items-center justify-center">
                                <AnimatePresence mode="wait">
                                    {generationState === 'idle' && (
                                        <motion.div
                                            key="idle"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-center text-slate/40 font-mono text-sm"
                                        >
                                            <motion.div
                                                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                                                transition={{ repeat: Infinity, duration: 2 }}
                                                className="mb-2 flex justify-center"
                                            >
                                                <Sparkles className="w-8 h-8" />
                                            </motion.div>
                                            READY_TO_SYNTHESIZE
                                            <br />
                                            <button onClick={handleRun} className="mt-4 px-6 py-2 bg-orange text-white rounded font-bold text-xs shadow-hard-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase tracking-widest">Generate</button>
                                        </motion.div>
                                    )}

                                    {generationState === 'generating' && (
                                        <motion.div
                                            key="generating"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="w-full px-8 space-y-4"
                                        >
                                            <div className="font-mono text-xs text-orange mb-2 animate-pulse tracking-widest uppercase">Synthesizing...</div>
                                            <div className="h-1.5 bg-slate/10 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-orange"
                                                    initial={{ width: "0%" }}
                                                    animate={{ width: "100%" }}
                                                    transition={{ duration: 1.5, ease: "circInOut" }}
                                                />
                                            </div>
                                            <div className="font-mono text-[9px] text-slate/40 flex flex-col gap-1">
                                                <span> Fetching architectural patterns</span>
                                                <span> Mapping data dimensions</span>
                                                <span> Injecting reactive state</span>
                                            </div>
                                        </motion.div>
                                    )}

                                    {generationState === 'complete' && (
                                        <motion.div
                                            key="complete"
                                            initial={{ opacity: 0, filter: 'blur(10px)' }}
                                            animate={{ opacity: 1, filter: 'blur(0px)' }}
                                            className="w-full h-full bg-white border border-slate/10 shadow-sm rounded overflow-hidden flex flex-col"
                                        >
                                            <div className="flex-1 p-2 overflow-auto scrollbar-hide">
                                                <DynamicWidget
                                                    moduleUrl={selectedExample.moduleUrl}
                                                    exampleId={selectedExample.id}
                                                    dataUrl={selectedExample.dataUrl}
                                                    dataType={selectedExample.dataType}
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[130%] bg-orange/10 blur-[100px] rounded-full -z-10" />
                </motion.div>
            </div>
        </div>
    );
};

export default Hero;