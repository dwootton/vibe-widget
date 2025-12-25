import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const CodeBlock = ({ code, language = 'python' }: { code: string; language?: string }) => (
    <div className="bg-material-bg text-bone rounded-lg border-orange relative overflow-hidden my-2 max-w-full overflow-x-auto">
        <div className="relative">
            <SyntaxHighlighter
                language={language}
                style={materialDark}
                customStyle={{ background: 'transparent', margin: 0 }}
                PreTag="pre"
                CodeTag="code"
                wrapLongLines
                showLineNumbers={false}
            >
                {code.trim().replace(/^`+|`+$/g, '')}
            </SyntaxHighlighter>
        </div>
    </div>
);

export default CodeBlock;
