import React from 'react';
import { motion } from 'framer-motion';
import { Github } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';

const Navbar = () => {
  const location = useLocation();
  
  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "circOut" }}
      className="fixed top-0 left-0 right-0 z-40 bg-bone/80 backdrop-blur-md border-b-2 border-slate/10 px-6 py-4 flex items-center justify-between"
    >
      <Link to="/" className="flex items-center gap-2 group cursor-pointer">
        <div className="w-8 h-8 bg-orange rounded-sm shadow-hard-sm flex items-center justify-center group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-none transition-all">
          <Logo className="w-5 h-5 text-white" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">
          Vibe<span className="text-orange">Widget</span>
        </span>
      </Link>

      <div className="flex items-center gap-8">
        <div className="hidden md:flex items-center gap-6 font-mono text-sm font-medium">
            <Link 
              to="/docs"
              className={`relative hover:text-orange transition-colors group ${location.pathname.includes('docs') ? 'text-orange' : ''}`}
            >
              <span className="mr-1 text-orange/50">01.</span>
              Docs
              <span className={`absolute -bottom-1 left-0 h-0.5 bg-orange transition-all group-hover:w-full ${location.pathname.includes('docs') ? 'w-full' : 'w-0'}`} />
            </Link>
            <Link 
              to="/gallery"
              className={`relative hover:text-orange transition-colors group ${location.pathname.includes('gallery') ? 'text-orange' : ''}`}
            >
              <span className="mr-1 text-orange/50">02.</span>
              Gallery
              <span className={`absolute -bottom-1 left-0 h-0.5 bg-orange transition-all group-hover:w-full ${location.pathname.includes('gallery') ? 'w-full' : 'w-0'}`} />
            </Link>
        </div>

        <a 
          href="https://github.com/dwootton/vibe-widgets"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-slate text-bone font-bold rounded-sm shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
        >
          <Github className="w-4 h-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>
    </motion.nav>
  );
};

export default Navbar;
