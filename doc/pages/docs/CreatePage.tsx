import React from 'react';
import DocContent from '../../components/DocContent';
import CodeBlock from '../../components/CodeBlock';

const CreatePage = () => (
    <DocContent title="Create">
        <p>Create widgets from natural language prompts and data sources.</p>
        <CodeBlock
            code={`import vibe_widget as vw\n\nwidget = vw.create(\n    "bar chart of revenue by region",\n    df\n)\n\nwidget`}
        />
        <h2>Inputs and outputs</h2>
        <p>Use <code>vw.inputs</code> to pass multiple inputs, and <code>vw.outputs</code> to define reactive state your widget exposes.</p>
        <CodeBlock
            code={`vw.create(\n    "...",\n    vw.inputs(df, selected_indices=other_widget.outputs.selected_indices)\n)`}
        />
        <CodeBlock
            code={`scatter = vw.create(\n    "scatter with brush selection",\n    df,\n    outputs=vw.outputs(selected_indices="indices of selected points")\n)\n\nscatter.outputs.selected_indices.value`}
        />
        <h2>Dataflow and I/O contract</h2>
        <p><code>vw.create</code> converts data to a list of record dicts and cleans non-JSON values (NaN/NaT/inf to <code>None</code>). Inputs and outputs are synced traitlets. When providing another widget output, Vibe Widget reads the current value once, then keeps it in sync via trait updates. Outputs start as <code>None</code> and are updated by generated JS code.</p>
        <h2>Supported data sources</h2>
        <ul>
            <li><code>pandas.DataFrame</code></li>
            <li>local file paths (CSV/TSV, JSON/GeoJSON, Parquet, NetCDF, XML, ISF, Excel, PDF, TXT)</li>
            <li>URLs (via <code>crawl4ai</code>, best-effort)</li>
        </ul>
        <p>Some loaders require optional dependencies (for example, <code>xarray</code> for NetCDF or <code>camelot</code> for PDF).</p>
        <h2>Theming</h2>
        <p>Themes are natural-language design specs that guide code generation.</p>
        <CodeBlock
            code={`vw.create("...", df, theme="financial_times")\n\nvw.create("...", df, theme="like national geographic but greener")`}
        />
        <p>Built-in themes are listed via <code>vw.themes()</code>. Theme prompts are cached for the session and can be saved locally.</p>
        <h2>Safety warning</h2>
        <p>Widgets execute LLM-generated JavaScript in the notebook frontend. Treat generated code as untrusted. Use audits and your own verification when the output informs decisions.</p>
    </DocContent>
);

export default CreatePage;
