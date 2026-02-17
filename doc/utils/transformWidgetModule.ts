let babelLoader: Promise<any> | null = null;

async function loadBabel(): Promise<any> {
  if (!babelLoader) {
    babelLoader = import('@babel/standalone');
  }
  return babelLoader;
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.toLowerCase().startsWith("<!") ||
    (trimmed.toLowerCase().startsWith("<html") && /<html[\s>]/i.test(trimmed))
  );
}

function looksLikeJsx(code: string): boolean {
  return /<[A-Za-z][^>]*>/.test(code);
}

export async function transformWidgetModule(code: string): Promise<string> {
  if (looksLikeHtml(code)) {
    throw new Error(
      "Widget module is HTML, not JavaScript (e.g. a 404 page or SPA index). " +
        "Ensure the widget URL points to a real .js or .vw file, or that the LLM returned code instead of an error page."
    );
  }
  if (!looksLikeJsx(code)) return code;

  const Babel = await loadBabel();
  const result = Babel.transform(code, {
    presets: [['react', { runtime: 'classic' }]],
    filename: 'widget.js',
  });

  const compiled = result?.code || code;
  return `const React = window.React;\n${compiled}`;
}
