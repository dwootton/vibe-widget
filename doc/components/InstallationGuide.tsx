import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Package, ToggleRight, PlayCircle } from 'lucide-react';

const StepCard = ({ number, title, subtitle, icon, code, children }: any) => {
    return (
        <div className="min-w-[85vw] md:min-w-[600px] h-[500px] bg-white border-2 border-slate rounded-xl p-8 shadow-hard flex flex-col relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-9xl font-display font-bold text-bone select-none z-0">
                0{number}
            </div>
            
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-orange text-white rounded-md flex items-center justify-center shadow-hard-sm">
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold font-display">{title}</h3>
                        <p className="font-mono text-sm text-slate/60">{subtitle}</p>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    {children}
                </div>

                {code && (
                    <div className="mt-6 bg-slate text-bone p-4 rounded font-mono text-sm relative group/code cursor-pointer overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange" />
                        <code>{code}</code>
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/code:translate-y-0 transition-transform duration-200" />
                    </div>
                )}
            </div>
        </div>
    );
};

const InstallationGuide = () => {
    const targetRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
    });

    const x = useTransform(scrollYProgress, [0, 1], ["0%", "-65%"]);

    return (
        <section ref={targetRef} className="h-[300vh] bg-bone relative">
            <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
                <div className="container mx-auto px-4 md:px-12 mb-8">
                     <h2 className="text-4xl font-display font-bold mb-2">The Assembly Guide</h2>
                     <p className="text-slate/60 font-mono">Follow the manual to synthesize your data.</p>
                </div>

                <div className="flex items-center gap-8 pl-4 md:pl-12 w-full">
                    <motion.div style={{ x }} className="flex gap-8">
                        
                        <StepCard 
                            number={1} 
                            title="The Parts" 
                            subtitle="ACQUIRE MODULES" 
                            icon={<Package />} 
                            code="pip install vibe-widget"
                        >
                            <div className="flex items-center justify-center gap-4">
                                <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                    className="w-32 h-32 border-4 border-dashed border-slate/20 rounded-full flex items-center justify-center"
                                >
                                    <div className="w-24 h-24 bg-orange/10 rounded-full flex items-center justify-center">
                                        <Package className="w-10 h-10 text-orange" />
                                    </div>
                                </motion.div>
                            </div>
                        </StepCard>

                        <StepCard 
                            number={2} 
                            title="Power Up" 
                            subtitle="CONNECT POWER SOURCE" 
                            icon={<ToggleRight />} 
                            code="export OPENROUTER_API_KEY='sk-...'"
                        >
                            <div className="flex flex-col items-center justify-center gap-4">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked readOnly />
                                    <div className="w-32 h-16 bg-slate/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-slate after:border-2 after:rounded-full after:h-14 after:w-14 after:transition-all peer-checked:bg-orange shadow-inner"></div>
                                </label>
                                <span className="font-mono font-bold text-orange">SYSTEM ONLINE</span>
                            </div>
                        </StepCard>

                        <StepCard 
                            number={3} 
                            title="Synthesis" 
                            subtitle="GENERATE OUTPUT" 
                            icon={<PlayCircle />} 
                            code='vw.create("scatter plot of sales data", df)'
                        >
                             <div className="grid grid-cols-2 gap-4 h-48">
                                <div className="bg-slate/5 rounded p-2 flex flex-col gap-2">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="h-2 bg-slate/10 w-full rounded animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                                    ))}
                                </div>
                                <div className="bg-white border-2 border-slate rounded shadow-hard-sm flex items-end justify-around p-2 pb-0 overflow-hidden">
                                     {[...Array(5)].map((_, i) => (
                                        <motion.div 
                                            key={i}
                                            className="w-4 bg-orange"
                                            animate={{ height: ["20%", "80%", "40%"] }}
                                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                                        />
                                    ))}
                                </div>
                             </div>
                        </StepCard>

                        {/* End Card */}
                        <div className="min-w-[300px] h-[500px] flex items-center justify-center">
                            <div className="text-center space-y-4">
                                <h3 className="text-3xl font-display font-bold">Ready?</h3>
                                <button className="bg-slate text-white px-8 py-3 font-mono rounded shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
                                    Read Full Docs
                                </button>
                            </div>
                        </div>

                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default InstallationGuide;
