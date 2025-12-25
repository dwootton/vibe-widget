import React from 'react';
import { Copy } from 'lucide-react';
import DocContent from '../../components/DocContent';
import CodeBlock from '../../components/CodeBlock';

const InstallationPage = () => (
    <DocContent title="Installation">
        <p className="text-xl text-slate/70 mb-8">Get up and running with Vibe Widget in seconds.</p>
        <pre className="bg-white border-2 border-slate rounded-lg p-6 shadow-hard mb-6">
            <div
                className="flex items-center gap-3 transition-all cursor-pointer group"
                onClick={() => {
                    navigator.clipboard.writeText('pip install vibe-widget');
                }}
            >
                <span className="text-orange">$</span>
                <code className="font-mono text-orange">pip install vibe-widget</code>
                <Copy className="w-4 h-4 text-slate/40 group-hover:text-orange transition-colors" />
            </div>
        </pre>
        <p className="mb-6">Vibe Widget requires Python 3.8+ and an OpenRouter API key.</p>
        <CodeBlock
            language="bash"
            code="export OPENROUTER_API_KEY='your-key'"
        />
        <h2>Quick start</h2>
        <CodeBlock
            code={`import pandas as pd\nimport vibe_widget as vw\n\ndf = pd.read_csv("sales.csv")\n\nwidget = vw.create(\n    "scatter plot with brush selection, and a linked histogram",\n    df,\n    outputs=vw.outputs(selected_indices="indices of selected points")\n)\n\nwidget`}
        />
    </DocContent>
);

export default InstallationPage;
