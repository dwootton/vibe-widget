import React from 'react';

const DocContent = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="max-w-3xl w-full min-w-0">
        <h1 className="text-5xl font-display font-bold mb-8">{title}</h1>
        <div className="prose prose-slate max-w-none font-sans break-words">
            {children}
        </div>
    </div>
);

export default DocContent;
