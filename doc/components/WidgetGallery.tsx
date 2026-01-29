import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import DynamicWidget from './DynamicWidget';
import { EXAMPLES } from '../data/examples';
import { createWidgetModel } from '../utils/exampleDataLoader';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const GalleryItem = ({
  example,
  index,
  mode,
  model,
}: {
  example: typeof EXAMPLES[0],
  index: number,
  mode: 'horizontal' | 'grid',
  model?: any,
  key?: React.Key
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/gallery?focus=${example.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.1, type: "spring" }}
      onClick={handleClick}
      className={`
                relative bg-white border-2 border-slate rounded-xl p-4 sm:p-6 shadow-hard flex flex-col gap-4 group cursor-pointer
                ${mode === 'horizontal' ? 'min-w-[280px] sm:min-w-[360px] lg:min-w-[450px]' : 'w-full'}
            `}
    >
      <div className="h-[200px] sm:h-[240px] lg:h-[280px] bg-bone border-2 border-slate/5 rounded-lg overflow-hidden relative shadow-inner group-hover:border-orange/20 transition-colors">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.05] pointer-events-none" />
        <div className="h-full w-full overflow-hidden">
          <DynamicWidget
            moduleUrl={example.moduleUrl}
            model={model}
            exampleId={example.id}
            dataUrl={example.dataUrl}
            dataType={example.dataType}
          />
        </div>
      </div>

      <div className="space-y-2">
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

  // Shared models for cross-widget reactivity (using dataUrl as key)
  const modelsRef = useRef<Map<string, any>>(new Map());

  const getModelForExample = (example: typeof EXAMPLES[0]) => {
    const dataUrl = example.dataUrl;
    if (!dataUrl) return undefined;

    if (!modelsRef.current.has(dataUrl)) {
      modelsRef.current.set(dataUrl, createWidgetModel([]));
    }
    return modelsRef.current.get(dataUrl);
  };

  // Horizontal transform for sticky scroll
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-65%"]);
  const springX = useSpring(x, { stiffness: 100, damping: 20 });

  // Filter for featured widgets in horizontal mode
  const featuredExamples = mode === 'horizontal'
    ? EXAMPLES.filter(ex => ex.categories.includes('Featured')).slice(0, 4)
    : EXAMPLES;

  if (mode === 'horizontal') {
    return (
      <div ref={containerRef} className="h-[200vh] relative">
        <div className="sticky top-0 h-screen flex items-center overflow-hidden">
          <motion.div style={{ x: springX }} className="flex gap-12 px-12 md:px-24">
            {featuredExamples.map((ex, i) => (
              <GalleryItem
                key={ex.id}
                example={ex}
                index={i}
                mode="horizontal"
                model={getModelForExample(ex)}
              />
            ))}

            {/* Final "View All" Card */}
            <div className="min-w-[250px] flex items-center justify-center">
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
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-12 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {featuredExamples.map((ex, i) => (
          <GalleryItem key={ex.id} example={ex} index={i} mode="grid" model={getModelForExample(ex)} />
        ))}
      </div>
    </div>
  );
};


export default WidgetGallery;
