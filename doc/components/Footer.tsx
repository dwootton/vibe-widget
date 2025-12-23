import React from 'react';
import { Gamepad2 } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-slate text-bone py-20 px-4 md:px-12">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div>
           <h3 className="text-2xl font-display font-bold mb-4">VibeWidget</h3>
           <p className="font-mono text-sm text-bone/60 max-w-xs">
              Open source tools for the future data scientists and tinkerers.
           </p>
        </div>

        <div className="grid grid-cols-2 gap-12 font-mono text-sm">
            <div className="flex flex-col gap-4">
                <span className="text-orange font-bold uppercase tracking-wider">Project</span>
                <a href="/docs" className="hover:text-orange transition-colors">Documentation</a>
                <a href="https://pypi.org/project/vibe-widget/0.2.0/" target='_blank' className="hover:text-orange transition-colors">PyPI</a>
                <a href="https://github.com/dwootton/vibe-widget" className="hover:text-orange transition-colors" target='_blank'>GitHub</a>
            </div>
            <div className="flex flex-col gap-4">
                <span className="text-orange font-bold uppercase tracking-wider">Community</span>
                <a href="#" className="hover:text-orange transition-colors">Twitter</a>
                <a href="https://github.com/dwootton/vibe-widget/issues/new" className="hover:text-orange transition-colors" target='_blank'>Issues</a>
            </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-bone/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-bone/40">
         <div>
            © {new Date().getFullYear()} Vibe Widget. MIT License.
         </div>
         <div className="flex items-center gap-2">
            Made with Vibes by dwootton & Ryan <Gamepad2 className="w-4 h-4 text-orange" />
         </div>
      </div>
    </footer>
  );
};

export default Footer;
