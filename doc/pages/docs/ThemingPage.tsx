import React from 'react';
import DocContent from '../../components/DocContent';
import CodeBlock from '../../components/CodeBlock';

const ThemingPage = () => (
    <DocContent title="Theming">
        <p>Themes are natural-language design specs that guide code generation.</p>
        <h2>List available themes</h2>
        <CodeBlock
            code={`import vibe_widget as vw\n\nvw.themes()`}
        />
        <h2>Create a custom theme</h2>
        <CodeBlock
            code={`theme = vw.theme("like national geographic but greener")\n\n# Inspect or reuse the generated description\nprint(theme.description)\n\nvw.create("...", df, theme=theme.description)`}
        />
        <h2>Use a theme in create</h2>
        <CodeBlock
            code={`vw.create("...", df, theme="financial_times")`}
        />
    </DocContent>
);

export default ThemingPage;
