/**
 * PlaygroundPage - Interactive Python Playground
 * 
 * Uses Pyodide to run actual Python code in the browser.
 * This is the home for interactive examples that need Python execution.
 */

import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { Code, Terminal, Sparkles } from 'lucide-react';

// Lazy load PyodideNotebook to avoid loading Pyodide on other pages
const PyodideNotebook = React.lazy(() => import('../components/PyodideNotebook'));

// Example notebook for the playground
const PLAYGROUND_CELLS = [
  {
    type: 'markdown' as const,
    content: `
      <h2>Welcome to the Vibe Widget Playground</h2>
      <p class="text-lg text-slate/70">
        This is an interactive Python environment powered by Pyodide.
        You can run Python code, create widgets, and experiment with vibe-widget.
      </p>
    `,
  },
  {
    type: 'code' as const,
    content: `# Import vibe_widget (mock for playground)
import vibe_widget as vw
import pandas as pd

# List available models
vw.models()`,
    defaultCollapsed: false,
    label: 'Setup',
  },
  {
    type: 'code' as const,
    content: `# Configure (demo mode - no actual LLM calls)
vw.config(
    model="google/gemini-3-flash-preview",
    api_key="demo-key"
)`,
    defaultCollapsed: true,
    label: 'Config',
  },
  {
    type: 'markdown' as const,
    content: `
      <h3>Create Your First Widget</h3>
      <p>
        Try creating a simple visualization. The playground will display
        the widget preview directly in your notebook.
      </p>
    `,
  },
  {
    type: 'code' as const,
    content: `# Create a simple widget
# Note: In demo mode, this will show a pre-generated widget
widget = vw.create(
    "scatter plot of temperature over time",
    data="../testdata/seattle-weather.csv",
)

widget`,
    label: 'Create Widget',
  },
];

function PlaygroundPage() {
  return (
    <main className="relative pt-32 min-h-screen bg-bone z-20">
      {/* Header */}
      <div className="container mx-auto px-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange/10 rounded-xl">
              <Terminal className="w-6 h-6 text-orange" />
            </div>
            <h1 className="text-5xl font-display font-bold tracking-tight">
              PLAYGROUND
            </h1>
          </div>
          <p className="text-xl text-slate/60 font-mono max-w-2xl">
            Interactive Python environment with Pyodide. 
            Run code, create widgets, and experiment.
          </p>
        </motion.div>
      </div>

      {/* Notebook Area */}
      <div className="container mx-auto px-4 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-4xl bg-white border-2 border-slate rounded-2xl shadow-hard overflow-hidden"
        >
          {/* Window Header */}
          <div className="p-4 border-b-2 border-slate/5 flex items-center justify-between bg-bone/50">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-4 font-mono text-xs text-slate/40 uppercase tracking-widest">
                Python Notebook / Playground
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange" />
              <span className="font-mono text-xs text-slate/40">Pyodide Runtime</span>
            </div>
          </div>

          {/* Notebook Content */}
          <div className="p-6">
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin mb-4" />
                  <span className="text-slate/50 font-mono text-sm">Loading Python runtime…</span>
                  <span className="text-slate/30 font-mono text-xs mt-2">This may take a moment</span>
                </div>
              }
            >
              <PyodideNotebook
                cells={PLAYGROUND_CELLS}
                title="Playground"
                dataFiles={[
                  { url: '/testdata/seattle-weather.csv', varName: 'weather_df', type: 'csv' },
                ]}
                notebookKey="playground"
              />
            </Suspense>
          </div>
        </motion.div>

        {/* Info Cards */}
        <div className="max-w-4xl grid md:grid-cols-2 gap-6 mt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 bg-white border-2 border-slate/10 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <Code className="w-5 h-5 text-orange" />
              <h3 className="font-display font-bold">Demo Mode</h3>
            </div>
            <p className="text-sm text-slate/60 font-mono">
              The playground runs in demo mode. Widget creation uses pre-generated
              examples. For real LLM-powered generation, use vibe-widget in a local
              Jupyter environment.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 bg-white border-2 border-slate/10 rounded-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <Terminal className="w-5 h-5 text-orange" />
              <h3 className="font-display font-bold">Full Python</h3>
            </div>
            <p className="text-sm text-slate/60 font-mono">
              Pyodide provides a full Python 3.11 runtime with pandas, numpy,
              and scikit-learn. Perfect for data exploration and learning.
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

export default PlaygroundPage;
