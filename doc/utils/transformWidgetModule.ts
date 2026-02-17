let babelLoader: Promise<any> | null = null;

async function loadBabel(): Promise<any> {
  if (!babelLoader) {
    babelLoader = import('@babel/standalone');
  }
  return babelLoader;
}

export function isLikelyHtml(text: string): boolean {
  const trimmed = text.replace(/\uFEFF/g, "").trim();
  const head = trimmed.slice(0, 500).toLowerCase();
  return (
    head.startsWith("<!") ||
    /<\s*!?\s*doctype\s/i.test(head) ||
    /<\s*html[\s>]/i.test(head)
  );
}

function looksLikeHtml(text: string): boolean {
  return isLikelyHtml(text);
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
  let result;
  try {
    result = Babel.transform(code, {
      presets: [['react', { runtime: 'classic' }]],
      filename: 'widget.js',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unexpected token\s*[<(]|expected/i.test(msg)) {
      throw new Error(
        "Widget code looks like HTML or invalid JS (e.g. a 404 page). " +
          "Use vw.config(api_key=...) for live generation, or ensure the widget URL points to a real .js file."
      );
    }
    throw e;
  }

  const compiled = result?.code || code;
  return `const React = window.React;\n${compiled}`;
}
