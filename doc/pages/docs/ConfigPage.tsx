import React from 'react';
import DocContent from '../../components/DocContent';
import CodeBlock from '../../components/CodeBlock';

const ConfigPage = () => (
    <DocContent title="Configuration">
        <p>Configure model settings and API keys.</p>
        <h2>Set defaults</h2>
        <CodeBlock
            code={`import vibe_widget as vw\n\nvw.config(model="openai/gpt-5.2-codex")\nvw.config(mode="premium", model="openrouter")\nvw.config(execution="approve")`}
        />
        <h2>API key setup</h2>
        <CodeBlock
            language="bash"
            code="export OPENROUTER_API_KEY='your-key'"
        />
        <CodeBlock
            code={`import os\nfrom dotenv import load_dotenv\nimport vibe_widget as vw\n\nload_dotenv()\napi_key = os.getenv("MY_SECRET_API_KEY")\n\nvw.config(api_key=api_key)`}
        />
        <p>We recommend avoiding hardcoded keys in notebooks to prevent accidental leaks.</p>
        <h2>Models</h2>
        <CodeBlock
            code={`vw.models()\nvw.models(show="all")\nvw.models(verbose=False)`}
        />
        <h2>Privacy and telemetry</h2>
        <p>Vibe Widget sends the following to the model provider:</p>
        <ul>
            <li>your prompt and theme prompt</li>
            <li>data schema (column names, dtypes)</li>
            <li>a small sample of rows (up to 3)</li>
            <li>outputs/inputs descriptors</li>
            <li>full widget code for edits, audits, and runtime fixes</li>
            <li>runtime error messages (when auto-fixing)</li>
        </ul>
        <p>No API keys are written to disk. Generated widgets and audit reports are stored locally in <code>.vibewidget/</code>.</p>
    </DocContent>
);

export default ConfigPage;
