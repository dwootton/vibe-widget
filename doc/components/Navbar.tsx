import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Menu, X, Star } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';

const Navbar = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [githubStars, setGithubStars] = useState<number | null>(null);

  useEffect(() => {
    getGithubStars().then(stars => setGithubStars(stars));
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  async function getGithubStars(repo = 'dwootton/vibe-widgets') {
    const response = await fetch(`https://api.github.com/repos/${repo}`);
    if (!response.ok) {
      throw new Error('Failed to fetch repo info');
    }
    const data = await response.json();
    console.log(data);
    return data.stargazers_count;
  }

  const navLinks = [
    { label: 'Docs', href: '/docs', prefix: '01.' },
    { label: 'Gallery', href: '/gallery', prefix: '02.' },
  ];

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

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-6 font-mono text-sm font-medium">
          {navLinks.map(({ label, href, prefix }) => {
            const isActive = location.pathname.includes(href.replace('/', ''));
            return (
              <Link
                key={href}
                to={href}
                className={`relative hover:text-orange transition-colors group ${isActive ? 'text-orange' : ''}`}
              >
                <span className="mr-1 text-orange/50">{prefix}</span>
                {label}
                <span className={`absolute -bottom-1 left-0 h-0.5 bg-orange transition-all group-hover:w-full ${isActive ? 'w-full' : 'w-0'}`} />
              </Link>
            );
          })}
        </div>

        <a
          href="https://github.com/dwootton/vibe-widgets"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate text-bone font-bold rounded-sm shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
        >
          <Github className="w-4 h-4" />
          <span className="hidden sm:inline">GitHub</span>
          <span className="flex items-center gap-1 font-mono">
            <Star className="w-4 h-4 text-yellow-400" />
          </span>
          {githubStars ?? ''}
        </a>

        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 border-2 border-slate/20 rounded-sm bg-white/60 shadow-hard-sm"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label="Toggle navigation"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 bg-bone border-b-2 border-slate/10 shadow-hard z-30 md:hidden"
          >
            <div className="px-6 py-6 flex flex-col gap-4 font-mono text-base">
              {navLinks.map(({ label, href, prefix }) => (
                <Link
                  key={href}
                  to={href}
                  className="flex items-center gap-3 text-slate/80 hover:text-orange"
                >
                  <span className="text-orange/60">{prefix}</span>
                  {label}
                </Link>
              ))}
              <a
                href="https://github.com/dwootton/vibe-widgets"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate text-bone font-bold rounded-sm shadow-hard-sm"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
