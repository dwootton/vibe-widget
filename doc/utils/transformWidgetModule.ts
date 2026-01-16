let babelLoader: Promise<any> | null = null;

async function loadBabel(): Promise<any> {
  if (!babelLoader) {
    babelLoader = import('@babel/standalone');
  }
  return babelLoader;
}

function looksLikeJsx(code: string): boolean {
  return /<[A-Za-z][^>]*>/.test(code);
}

export async function transformWidgetModule(code: string): Promise<string> {
  if (!looksLikeJsx(code)) return code;

  const Babel = await loadBabel();
  const result = Babel.transform(code, {
    presets: [['react', { runtime: 'classic' }]],
    filename: 'widget.js',
  });

  const compiled = result?.code || code;
  return `const React = window.React;\n${compiled}`;
}
