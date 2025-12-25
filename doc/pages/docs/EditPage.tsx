import React from 'react';
import DocContent from '../../components/DocContent';
import CodeBlock from '../../components/CodeBlock';

const EditPage = () => (
    <DocContent title="Edit">
        <p>While developing interactive widgets, we often do not know what to fully specify until after the first version exists. Vibe Widget makes iteration a first-class workflow by letting you edit generated widgets through code or the UI.</p>
        <p>Edits reuse existing code and optionally the theme, then apply requested changes. Each edit produces a new widget instance and persists a new version in the widget store.</p>
        <h2>Python edits</h2>
        <p>Use Python edits when you want structural changes, broader logic refactors, or to preserve edits as code in notebooks and scripts. Python edits are ideal for larger, explicit changes you want to keep versioned and reproducible.</p>
        <CodeBlock
            code={`v1 = vw.create("basic scatter", df)\n\n# Large or structural changes\nv2 = v1.edit("add hover tooltips and a right-side legend")`}
        />
        <p>Component-level edits are ideal when the widget exposes named subcomponents and you want precise changes without rewriting the full widget.</p>
        <CodeBlock
            code={`# Example: targeted edits via components\nv3 = v1.component.colo_legend.edit("style the legend with a muted palette", inputs=df)`}
        />
        <h2>UI edits</h2>
        <p>Use UI edits for fast, interactive iteration inside the widget runtime. These are best for targeted adjustments, quick fixes, and diagnostics without switching to code.</p>
        <h3>Source code editing</h3>
        <p>Make precise changes in the generated JS/HTML/CSS when you need direct control over logic or styling.</p>
        <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">Image Placeholder</div>
            <div className="mt-2 text-sm text-slate/60 font-mono">Source code editor UI with highlighted widget files.</div>
        </div>
        <h3>Visual editing (Edit Element)</h3>
        <p>Select a specific element by its bounding box and issue an edit scoped to that element, using full context from the widget.</p>
        <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm mt-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">Image Placeholder</div>
            <div className="mt-2 text-sm text-slate/60 font-mono">Edit Element UI showing bounding boxes and selected element context.</div>
        </div>
        <h3>Auditing</h3>
        <p>Detect issues, get recommendations, and optionally turn a concern into a fix request.</p>
        <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm mt-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">Image Placeholder</div>
            <div className="mt-2 text-sm text-slate/60 font-mono">Audit panel UI with issue list and recommendations.</div>
        </div>
        <h2>Code Auditing</h2>
        <p>Audits review the current widget code and description to surface concerns, design risks, and fixes. This is designed to help you catch issues early and guide the next edit.</p>
        <table className="w-full text-sm border-collapse">
            <thead>
                <tr className="text-left border-b border-slate/10">
                    <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">Level</th>
                    <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">Scope</th>
                    <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">When to Use</th>
                    <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-slate/40">Output</th>
                </tr>
            </thead>
            <tbody>
                <tr className="border-b border-slate/10">
                    <td className="py-2 pr-4">fast</td>
                    <td className="py-2 pr-4">Quick scan for top issues</td>
                    <td className="py-2 pr-4">Early iterations, frequent checks</td>
                    <td className="py-2">Short concern list + fixes</td>
                </tr>
                <tr>
                    <td className="py-2 pr-4">full</td>
                    <td className="py-2 pr-4">Deeper review, alternatives</td>
                    <td className="py-2 pr-4">Pre-share, production polish</td>
                    <td className="py-2">Detailed concerns + options</td>
                </tr>
            </tbody>
        </table>
        <h3>How to use auditing</h3>
        <p>You can run audits from Python to get a structured report without needing to re-run the widget UI.</p>
        <CodeBlock
            code={`# Run a fast audit and return a report\nreport = widget.audit(level="fast", display=False)\n\n# Deep audit for detailed alternatives\nfull_report = widget.audit(level="full", reuse=True, display=False)`}
        />
        <p>In the UI, audit recommendations can be surfaced as a checklist. You can then turn a specific concern into an edit request or keep it as a TODO for later.</p>
        <h3>Examples</h3>
        <CodeBlock
            code={`# Use audit output to guide the next change\nwidget.edit("fix accessibility issues mentioned in the audit report")`}
        />
    </DocContent>
);

export default EditPage;
