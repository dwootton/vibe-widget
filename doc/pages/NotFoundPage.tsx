import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

const NotFoundPage = () => {
    return (
        <main className="min-h-screen pt-32 pb-20 bg-bone relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.15),_transparent_55%)] pointer-events-none" aria-hidden="true" />
            <div className="container mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl mx-auto bg-white/80 border-2 border-slate rounded-2xl shadow-hard-lg p-10 text-center"
                >
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-orange/40 bg-orange/10 font-mono text-xs uppercase tracking-[0.3em] text-orange">
                        <AlertTriangle className="w-4 h-4" />
                        Signal Lost
                    </div>
                    {/* 
          <h1 className="mt-8 text-5xl font-display font-bold tracking-tight">
            Navigation Drift Detected
          </h1> */}

                    <img
                        width={300}
                        src="/cat-travel-bag-svgrepo-com.svg" alt="Cat with travel bag" className="mx-auto" />
                    <p className="mt-4 text-slate/70 text-lg leading-relaxed">
                        The vector you dialed doesn’t have live content yet. Let’s route you back to an active module.
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/"
                            className="px-6 py-3 bg-orange text-white font-bold uppercase tracking-[0.2em] rounded-sm shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                        >
                            Return Home
                        </Link>
                        <Link
                            to="/docs"
                            className="px-6 py-3 border-2 border-slate font-mono text-sm rounded-sm shadow-hard-sm bg-white hover:bg-orange/10"
                        >
                            Browse Docs
                        </Link>
                    </div>
                </motion.div>
            </div>
        </main>
    );
};

export default NotFoundPage;
