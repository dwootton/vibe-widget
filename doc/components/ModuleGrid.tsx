import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Network, Database, Layers, Wand2, Share2, Box, Cpu, ArrowRight } from 'lucide-react';
import { FeatureCardProps } from '../types';


const features: FeatureCardProps[] = [
    {
        title: "Speak Human",
        description: "Describe your viz in plain English. The AI writes production-ready React.",
        icon: <Wand2 className="w-6 h-6" />,
    },
    {
        title: "Linked Widgets",
        description: "Select points in one chart → instantly updates another.",
        icon: <Network className="w-6 h-6" />,
    },
    {
        title: "Universal Data",
        description: "Works with DataFrames, CSV, JSON, NetCDF, PDF tables, and more.",
        icon: <Database className="w-6 h-6" />,
    },
    {
        title: "Composition",
        description: "Create interactive dashboards where widgets communicate.",
        icon: <Layers className="w-6 h-6" />,
    },
    {
        title: "Smart Caching",
        description: "Generated widgets are automatically cached to disk.",
        icon: <Box className="w-6 h-6" />,
    },
    {
        title: "Multi-Model",
        description: "Choose between Claude, GPT, Gemini, or OpenRouter models.",
        icon: <Share2 className="w-6 h-6" />,
    }
];

const ModuleCard: React.FC<{ feature: FeatureCardProps, index: number }> = ({ feature, index }) => {
    return (
        <motion.div
            initial={{ opacity: 0, rotateY: 90, scale: 0.8 }}
            whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ 
                duration: 0.8, 
                delay: index * 0.1, 
                type: "spring", 
                stiffness: 80, 
                damping: 15 
            }}
            whileHover={{ 
                rotateY: 10, 
                rotateX: -5,
                y: -10,
                transition: { duration: 0.2 } 
            }}
            className="group relative h-[300px] perspective-1000 cursor-pointer"
        >
            {/* The Front Card */}
            <div className="absolute inset-0 bg-white border-2 border-slate rounded-2xl p-8 shadow-hard group-hover:shadow-hard-lg group-hover:border-orange transition-all flex flex-col justify-between overflow-hidden">
                {/* Technical Blueprint lines background (visible on hover) */}
                <div className="absolute inset-0 bg-grid-pattern opacity-0 group-hover:opacity-[0.03] transition-opacity pointer-events-none" />
                
                <div className="relative z-10">
                    <div className="w-14 h-14 bg-bone border-2 border-slate/10 rounded-xl flex items-center justify-center group-hover:bg-orange group-hover:text-white group-hover:border-orange group-hover:scale-110 transition-all duration-500 shadow-sm">
                        {feature.icon}
                    </div>
                </div>

                <div className="relative z-10">
                    <span className="font-mono text-[10px] text-slate/30 uppercase tracking-[0.2em] mb-2 block">System.Module_0{index + 1}</span>
                    <h3 className="text-2xl font-bold font-display mb-3 group-hover:text-orange transition-colors">{feature.title}</h3>
                    <p className="text-slate/50 font-sans leading-relaxed text-sm group-hover:text-slate/70 transition-colors">
                        {feature.description}
                    </p>
                </div>

                {/* Bottom Deco */}
                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate group-hover:bg-orange transition-colors" />
            </div>

            {/* Corner Deco */}
            <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-100 transition-opacity">
                 <div className="w-3 h-3 border-t-2 border-r-2 border-slate group-hover:border-orange" />
            </div>
        </motion.div>
    );
};

const ModuleGrid = () => {
    return (
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-40">
            <div className="mb-20 text-center md:text-left">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="inline-block px-3 py-1 bg-orange/10 text-orange font-mono text-[10px] font-bold uppercase tracking-widest rounded-full mb-4"
                >
                    System Architecture
                </motion.div>
                <h2 className="text-6xl font-display font-bold mb-4 tracking-tighter">Tools of <span className="text-orange">Synthesis.</span></h2>
                <p className="text-xl text-slate/40 font-sans max-w-2xl">A library for interactive visualization.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {features.map((feature, idx) => (
                    <ModuleCard key={idx} feature={feature} index={idx} />
                ))}
            </div>

            <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                className="mt-32 text-center"
            >
                {/* Fixed: Link and ArrowRight were not imported */}
                <Link to="/docs" className="inline-flex items-center gap-4 px-10 py-5 bg-slate text-white rounded-xl font-bold shadow-hard hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all group">
                    <span className="font-display text-xl uppercase tracking-tighter">View Full Documentation</span>
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </Link>
            </motion.div>
        </div>
    );
};

export default ModuleGrid;