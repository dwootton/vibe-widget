import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import DynamicWidget from './DynamicWidget';
import { EXAMPLES } from '../data/examples';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// Fixed: Added key to props type to allow assignment when mapping
const GalleryItem = ({ example, index, mode }: { example: typeof EXAMPLES[0], index: number, mode: 'horizontal' | 'grid', key?: React.Key }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: index * 0.1, type: "spring" }}
            className={`
                bg-white border-2 border-slate rounded-xl p-6 shadow-hard flex flex-col gap-4 group
                ${mode === 'horizontal' ? 'min-w-[450px]' : 'w-full'}
            `}
        >
            <div className="h-[280px] bg-bone border-2 border-slate/5 rounded-lg overflow-hidden relative shadow-inner group-hover:border-orange/20 transition-colors">
                 <div className="absolute inset-0 bg-grid-pattern opacity-[0.05] pointer-events-none" />
                 <div className="h-full w-full overflow-hidden">
                    <DynamicWidget code={example.code} />
                 </div>
                 {/* Decorative Overlay */}
                 <div className="absolute top-2 right-2 px-2 py-1 bg-white/80 backdrop-blur rounded text-[9px] font-mono border border-slate/5 text-slate/40 uppercase tracking-widest">Live Runtime</div>
            </div>
            
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-orange uppercase bg-orange/10 px-2 py-0.5 rounded tracking-widest">Component</span>
                    <span className="text-[10px] font-mono text-slate/30 uppercase tracking-widest">ID: VW-00{index+1}</span>
                </div>
                <h3 className="text-xl font-display font-bold group-hover:text-orange transition-colors">{example.label}</h3>
                <p className="font-mono text-xs text-slate/60 line-clamp-2 leading-relaxed italic border-l-2 border-slate/10 pl-3">"{example.prompt}"</p>
            </div>
        </motion.div>
    );
};

interface WidgetGalleryProps {
    mode: 'horizontal' | 'grid';
}

const WidgetGallery = ({ mode }: WidgetGalleryProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    // Horizontal transform for sticky scroll
    const x = useTransform(scrollYProgress, [0, 1], ["0%", "-65%"]);
    const springX = useSpring(x, { stiffness: 100, damping: 20 });

    if (mode === 'horizontal') {
        return (
            <div ref={containerRef} className="h-[400vh] relative">
                <div className="sticky top-0 h-screen flex items-center overflow-hidden">
                    <motion.div style={{ x: springX }} className="flex gap-12 px-12 md:px-24">
                        {EXAMPLES.map((ex, i) => (
                            <GalleryItem key={ex.id} example={ex} index={i} mode="horizontal" />
                        ))}
                        
                        {/* Final "View All" Card */}
                        <div className="min-w-[450px] flex items-center justify-center">
                            <Link to="/gallery" className="group flex flex-col items-center gap-6 p-12 bg-orange/5 border-2 border-dashed border-orange/20 rounded-xl hover:bg-orange hover:border-orange transition-all duration-500">
                                <motion.div 
                                    whileHover={{ scale: 1.1, rotate: 90 }}
                                    className="w-20 h-20 rounded-full border-2 border-orange flex items-center justify-center group-hover:bg-white group-hover:border-white group-hover:text-orange text-orange transition-all"
                                >
                                    <ArrowRight className="w-8 h-8" />
                                </motion.div>
                                <div className="text-center">
                                    <span className="font-display font-bold text-2xl group-hover:text-white transition-colors">Explore Gallery</span>
                                    <p className="text-xs font-mono mt-2 text-slate/40 group-hover:text-white/60 uppercase tracking-widest">40+ Examples</p>
                                </div>
                            </Link>
                        </div>
                    </motion.div>
                </div>
                
                {/* Visual Scroll Hint */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
                    <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Scroll to Navigate</span>
                    <div className="w-px h-12 bg-gradient-to-b from-slate to-transparent" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 md:px-12 pb-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {EXAMPLES.map((ex, i) => (
                    <GalleryItem key={ex.id} example={ex} index={i} mode="grid" />
                ))}
            </div>
        </div>
    );
};

export default WidgetGallery;