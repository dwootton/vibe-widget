import React from 'react';
import { Copy } from 'lucide-react';

const InstallCommand = ({ command }: { command: string }) => (
  <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6">
    <div
      className="flex items-center gap-3 transition-all cursor-pointer group"
      onClick={() => {
        navigator.clipboard.writeText(command);
      }}
    >
      <span className="text-orange">$</span>
      <code className="font-mono text-orange">{command}</code>
      <Copy className="w-4 h-4 text-slate/40 group-hover:text-orange transition-colors" />
    </div>
  </pre>
);

export default InstallCommand;
