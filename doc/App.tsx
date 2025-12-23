import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import NotebookGuide from './components/NotebookGuide';
import ModuleGrid from './components/ModuleGrid';
import WidgetGallery from './components/WidgetGallery';
import Footer from './components/Footer';
import DocsPage from './pages/DocsPage';
import NotFoundPage from './pages/NotFoundPage';

// const Cursor = () => {
//   const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

//   useEffect(() => {
//     const updateMousePosition = (e: MouseEvent) => {
//       setMousePosition({ x: e.clientX, y: e.clientY });
//     };
//     window.addEventListener('mousemove', updateMousePosition);
//     return () => window.removeEventListener('mousemove', updateMousePosition);
//   }, []);

//   return (
//     <motion.div
//       className="fixed top-0 left-0 w-8 h-8 border-2 border-orange rounded-full pointer-events-none z-[9999] mix-blend-difference"
//       animate={{ x: mousePosition.x - 16, y: mousePosition.y - 16 }}
//       transition={{ type: "spring", stiffness: 1900, damping: 88 }}
//     >
//       <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-orange rounded-full transform -translate-x-1/2 -translate-y-1/2" />
//     </motion.div>
//   );
// };

const LandingPage = () => {
  return (
    <main className="relative">
      <Hero />
      
      {/* CONTENT LAYERS - Higher Z-Index and Background Color to cover Hero */}
      <div className="relative z-20 bg-bone border-t-2 border-slate/10 shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
          <section id="gallery-preview" className="relative pt-20">
             {/* Horizontal Scroll Gallery */}
              <div className="container mx-auto px-4 mb-8">
                <h2 className="text-4xl font-display font-bold">Featured Widgets</h2>
              </div>
              <WidgetGallery mode="horizontal" />
          </section>

          <section id="guide" className="relative pt-20">
              <NotebookGuide />
          </section>

          <section id="modules" className="relative mt-20 pb-20">
              <ModuleGrid />
          </section>
      </div>
    </main>
  );
};

const GalleryPage = () => {
  return (
    <main className="relative pt-32 min-h-screen bg-bone z-20">
       <div className="container mx-auto px-4 mb-12">
          <h1 className="text-6xl font-display font-bold mb-4">Widget Gallery</h1>
          <p className="text-xl text-slate/60 font-mono">Community creations and examples.</p>
       </div>
       <WidgetGallery mode="grid" />
    </main>
  );
};

// Wrapper to handle scroll progress for the whole app
const AppContent = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="bg-bone min-h-screen text-slate selection:bg-orange selection:text-white overflow-clip font-sans">
      {/* <Cursor /> */}
      
      {/* GLOBAL BACKGROUND LAYERS (PARALLAX) */}
      <div className="bg-noise" />
      <div className="perspective-grid" />
      
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1.5 bg-orange origin-left z-[100]"
        style={{ scaleX }}
      />

      <Navbar />
      
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/docs/*" element={<DocsPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/gallery/*" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <Footer />
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}