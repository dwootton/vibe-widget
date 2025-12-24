import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import DynamicWidget from './DynamicWidget';
import { EXAMPLES } from '../data/examples';
import { createWidgetModel } from '../utils/exampleDataLoader';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// import anime from 'animejs';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Context preview data for each widget - showing cells before and after
const WIDGET_CONTEXT = {
  'tic-tac-toe': {
    upperCell: {
      type: 'code',
      label: 'Train Model',
      content: `# Train ML model on tic-tac-toe patterns
model = train_tictactoe_model(game_data)
print(f"Model accuracy: {model.score():.2%}")`
    },
    lowerCell: {
      type: 'code',
      label: 'AI Move',
      content: `# Generate AI move based on board state
def make_ai_move(board_state):
    prediction = model.predict(board_state)
    return best_move(prediction)`
    }
  },
  'weather-scatter': {
    upperCell: {
      type: 'code',
      label: 'Load Data',
      content: `# Load Seattle weather dataset
weather_df = pd.read_csv('seattle-weather.csv')
print(f"Loaded {len(weather_df)} days of data")`
    },
    lowerCell: {
      type: 'code',
      label: 'Linked Chart',
      content: `# Create linked bar chart for selected weather
bars = vw.create(
    "bar chart of weather conditions for selection",
    vw.inputs(data, selected_indices=scatter.outputs.selected_indices)
)`
    }
  },
  'solar-system': {
    upperCell: {
      type: 'code',
      label: 'Extract PDF',
      content: `# Extract planet data from PDF
planets_df = extract_from_pdf('planets.pdf')
print(planets_df[['name', 'distance', 'radius']].head())`
    },
    lowerCell: {
      type: 'code',
      label: 'Output State',
      content: `# Access selected planet from widget
selected = solar_system.outputs.selected_planet.value
print(f"Currently viewing: {selected}")`
    }
  },
  'hn-clone': {
    upperCell: {
      type: 'code',
      label: 'Scrape Web',
      content: `# Scrape Hacker News stories
stories = scrape_hackernews()
print(f"Found {len(stories)} stories")`
    },
    lowerCell: {
      type: 'code',
      label: 'Filter Data',
      content: `# Filter high-scoring stories
top_stories = stories[stories.score > 100]
print(f"Top stories: {len(top_stories)}")`
    }
  }
};

const customStyle = {
  padding: '1.25rem',
  borderRadius: '0.75rem',
  margin: 0,
  fontSize: '13px',
  lineHeight: '1.5',
  fontFamily: 'Space Mono, JetBrains Mono, monospace',
};

// Context cell preview component
const ContextCell = ({ cell, position }: { cell: { type: string, label: string, content: string }, position: 'upper' | 'lower' }) => {
  const gradientClass = position === 'upper'
    ? 'bg-gradient-to-t from-white to-white/10'
    : 'bg-gradient-to-b from-white to-white/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'upper' ? -20 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: position === 'upper' ? -30 : 30 }}
      transition={{
        duration: 0.6,
        ease: [0.4, 0.0, 0.2, 1]
      }}
      className={`absolute ${position === 'upper' ? 'bottom-full mb-6' : 'top-full mt-6'} left-0 right-0 pointer-events-none`}
    >
      <div className={`relative backdrop-blur-sm`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[8px] font-mono font-bold text-orange/60 uppercase tracking-widest">
              {position === 'upper' ? '↑ Previous Cell' : '↓ Next Cell'}
            </span>
            <span className="text-[8px] font-mono text-slate/40 uppercase tracking-widest">
              {cell.label}
            </span>
          </div>
          <div className="text-material-bg relative overflow-hidden">
            <div className="relative">
              <pre className={`${gradientClass} p-4 rounded-lg text-xs font-mono overflow-x-auto`}>
                <SyntaxHighlighter
                  language="python"
                  // style?: { [key: string]: React.CSSProperties } | undefined;
                  style={{
                    ...materialLight,
                    'code[class*="language-"]': {
                      background: 'transparent',
                    },
                    'pre[class*="language-"]': {
                      background: 'transparent',
                      margin: 0,
                    },
                  }}
                  customStyle={customStyle}
                  PreTag="div"
                  CodeTag="code"
                  showLineNumbers={false}
                >
                  {cell.content}
                </SyntaxHighlighter>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Fixed: Added key to props type to allow assignment when mapping
const GalleryItem = ({
  example,
  index,
  mode,
  model,
  showContext = false
}: {
  example: typeof EXAMPLES[0],
  index: number,
  mode: 'horizontal' | 'grid',
  model?: any,
  showContext?: boolean,
  key?: React.Key
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/gallery?focus=${example.id}`);
  };

  const contextData = WIDGET_CONTEXT[example.id as keyof typeof WIDGET_CONTEXT];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: index * 0.1, type: "spring" }}
      onClick={handleClick}
      className={`
                relative bg-white border-2 border-slate rounded-xl p-6 shadow-hard flex flex-col gap-4 group cursor-pointer
                ${mode === 'horizontal' ? 'min-w-[450px]' : 'w-full'}
            `}
    >
      {/* Context previews (only in horizontal mode) */}
      {mode === 'horizontal' && showContext && contextData && (
        <AnimatePresence mode="wait">
          <React.Fragment key={example.id}>
            <ContextCell cell={contextData.upperCell} position="upper" />
            <ContextCell cell={contextData.lowerCell} position="lower" />
          </React.Fragment>
        </AnimatePresence>
      )}

      <div className="h-[280px] bg-bone border-2 border-slate/5 rounded-lg overflow-hidden relative shadow-inner group-hover:border-orange/20 transition-colors">
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
        {/* Decorative Overlay */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-white/80 backdrop-blur rounded text-[9px] font-mono border border-slate/5 text-slate/40 uppercase tracking-widest">Live Runtime</div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-orange uppercase bg-orange/10 px-2 py-0.5 rounded tracking-widest">Component</span>
          <span className="text-[10px] font-mono text-slate/30 uppercase tracking-widest">ID: VW-00{index + 1}</span>
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

  // Track which widget is currently centered for context preview
  const [centeredIndex, setCenteredIndex] = useState(0);

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

  // Track centered widget based on scroll progress
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      const featuredCount = featuredExamples.length;
      // Calculate which item is centered based on scroll progress
      const newIndex = Math.min(Math.round(latest * featuredCount * 0.8), featuredCount - 1);
      setCenteredIndex(newIndex);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

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
                showContext={i === centeredIndex}
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
