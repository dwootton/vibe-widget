import React from 'react';
import Highlight, { defaultProps, themes } from 'prism-react-renderer';

const CodeBlock = ({ code, language = 'python' }: { code: string; language?: string }) => {
    const normalized = code.trim().replace(/^`+|`+$/g, '');

    return (
        <div className="bg-material-bg text-bone rounded-lg border-orange relative overflow-hidden my-2 max-w-full overflow-x-auto">
            <Highlight
                {...defaultProps}
                theme={themes.nightOwl}
                code={normalized}
                language={language as any}
            >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                    <pre
                        className={`${className} p-4 text-sm leading-relaxed`}
                        style={{ ...style, background: 'transparent', margin: 0 }}
                    >
                        {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({ line })}>
                                {line.map((token, key) => (
                                    <span key={key} {...getTokenProps({ token })} />
                                ))}
                            </div>
                        ))}
                    </pre>
                )}
            </Highlight>
        </div>
    );
};

export default CodeBlock;
