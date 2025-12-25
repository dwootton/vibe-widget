import React from 'react';
import DocContent from '../../components/DocContent';
import CodeBlock from '../../components/CodeBlock';

const AuditPage = () => (
    <DocContent title="Audit">
        <p>Audits review widget code and behavior through a set of lenses to surface risks, usability issues, and design gaps before you ship.</p>
        <h2>Audit framework</h2>
        <p>Each audit runs across domains and lenses so you get feedback that is both technical and experiential.</p>
        <table className="w-full text-sm border-collapse">
            <thead>
                <tr className="text-left border-b border-slate/10">
                    <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">Domain</th>
                    <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-widest text-slate/40">What It Covers</th>
                    <th className="py-2 font-mono text-[10px] uppercase tracking-widest text-slate/40">Key Questions</th>
                </tr>
            </thead>
            <tbody>
                <tr className="border-b border-slate/10">
                    <td className="py-2 pr-4">DATA</td>
                    <td className="py-2 pr-4">Input, filtering, transformations, formatting. Subdomains: <code>data.input</code>, <code>data.filtering</code>, <code>data.transformations</code>, <code>data.formatting</code>.</td>
                    <td className="py-2">What goes in? What gets dropped? How is it changed?</td>
                </tr>
                <tr className="border-b border-slate/10">
                    <td className="py-2 pr-4">COMPUTATION</td>
                    <td className="py-2 pr-4">Algorithms, parameters, assumptions. Subdomains: <code>computation.algorithm</code>, <code>computation.parameters</code>, <code>computation.assumptions</code>.</td>
                    <td className="py-2">What runs? With what settings? What does it assume?</td>
                </tr>
                <tr className="border-b border-slate/10">
                    <td className="py-2 pr-4">PRESENTATION</td>
                    <td className="py-2 pr-4">Visual encoding, scales, projection. Subdomains: <code>presentation.encoding</code>, <code>presentation.scales</code>, <code>presentation.projection</code>.</td>
                    <td className="py-2">How are results shown? What is hidden or over-emphasized?</td>
                </tr>
                <tr className="border-b border-slate/10">
                    <td className="py-2 pr-4">INTERACTION</td>
                    <td className="py-2 pr-4">Triggers, state, propagation. Subdomains: <code>interaction.triggers</code>, <code>interaction.state</code>, <code>interaction.propagation</code>.</td>
                    <td className="py-2">What changes on input? What persists? What updates downstream?</td>
                </tr>
                <tr>
                    <td className="py-2 pr-4">SYSTEM</td>
                    <td className="py-2 pr-4">Accessibility, performance, reliability. Subdomains: <code>system.accessibility</code>, <code>system.performance</code>, <code>system.reliability</code>.</td>
                    <td className="py-2">Is it usable for everyone? Is it fast and stable?</td>
                </tr>
            </tbody>
        </table>
        <p>Each domain is reviewed at a second level to pinpoint the issue scope, such as <code>data.transformations</code> or <code>computation.parameters.bin_size</code>, so fixes stay targeted and explainable.</p>
        <h2>Audit lenses</h2>
        <p>Lenses are the perspectives applied during auditing. You can think of them as different expert reviews running together, such as accessibility, data integrity, or interaction design.</p>
        <h2>Fast vs full audits</h2>
        <p><strong>Fast</strong> audits provide quick issue scans for early iteration. <strong>Full</strong> audits dig deeper with alternatives and higher coverage for pre-share polish.</p>
        <CodeBlock
            code={`# Fast audit for quick checks\nreport = widget.audit(level="fast", display=False)\n\n# Full audit for deeper review\nfull_report = widget.audit(level="full", reuse=True, display=False)`}
        />
        <p>Audit outputs are stored in <code>.vibewidget/audits</code> as JSON and YAML.</p>
        <h2>Launch an audit</h2>
        <h3>Before widget render (Python)</h3>
        <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">GIF Placeholder</div>
            <div className="mt-2 text-sm text-slate/60 font-mono">Run audit from Python before rendering the widget output.</div>
        </div>
        <h3>During UI editing</h3>
        <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm mt-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">GIF Placeholder</div>
            <div className="mt-2 text-sm text-slate/60 font-mono">Launch audit while editing the widget in the UI.</div>
        </div>
        <h2>Example audit results</h2>
        <div className="bg-white border-2 border-slate rounded-xl p-4 shadow-hard-sm">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate/40">Sample Output</div>
            <ul className="mt-3 text-sm text-slate/70 font-mono list-disc pl-5 space-y-1">
                <li>Data: Axis label missing units for “Revenue”.</li>
                <li>Accessibility: Hover tooltips are not keyboard reachable.</li>
                <li>Design: Secondary controls compete with chart for visual emphasis.</li>
            </ul>
        </div>
    </DocContent>
);

export default AuditPage;
