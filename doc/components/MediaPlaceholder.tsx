import React from 'react';

const MediaPlaceholder = ({ label, caption }: { label: string; caption: string }) => (
  <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm my-4">
    <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">{label}</div>
    <div className="mt-2 text-sm text-slate/60 font-mono">{caption}</div>
  </div>
);

export default MediaPlaceholder;
