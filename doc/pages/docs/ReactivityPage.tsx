import React from 'react';
import DocContent from '../../components/DocContent';
import CodeBlock from '../../components/CodeBlock';

const ReactivityPage = () => (
    <DocContent title="Reactivity">
        <p>Outputs are reactive state handles that can be passed into other widgets.</p>
        <CodeBlock
            code={`scatter = vw.create(\n    "scatter plot with brush selection tool",\n    df,\n    outputs=vw.outputs(selected_indices="indices of selected points")\n)\n\nhistogram = vw.create(\n    "histogram with highlighted bars for selected data",\n    vw.inputs(df, selected_indices=scatter.outputs.selected_indices)\n)`}
        />
        <p>When you select points in the scatter plot, the histogram updates via trait syncing. Outputs are exposed under <code>widget.outputs.&lt;name&gt;</code>.</p>
    </DocContent>
);

export default ReactivityPage;
