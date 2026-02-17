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

/**
 * Normalize common LLM-generated JSX mistakes that cause "Unexpected token '<'":
 * - Broken closing tags: "< \n/svg>", "<\n  /div>", "<\n  /\n  div>" → "</svg>" / "</div>"
 * - Broken opening tags: "< \ndiv", "<\n  svg" → "<div" / "<svg"
 * - Spaces in JSX props: "ref = {" → "ref={"
 * Run multiple passes so one fix doesn't leave another pattern behind.
 */
function normalizeJsx(code: string): string {
  let out = code;
  for (let i = 0; i < 3; i++) {
    const prev = out;
    out = out
      // Closing tags: < + newline(s) + / + optional space/newline + tagname + >
      .replace(/<\s*\n[\s\n]*\/[\s\n]*(\w+)\s*>/g, "</$1>")
      .replace(/<\s*\/\s*(\w+)\s*>/g, "</$1>")
      // Opening tags: < + newline(s) + optional space/newline + tagname (word)
      .replace(/<\s*\n[\s\n]*(\w+)/g, "<$1")
      // JSX props with spaces: prop = { → prop={
      .replace(/(\w+)\s*=\s*\{/g, "$1={");
    if (out === prev) break;
  }
  return out;
}

/**
 * Strip Preact hook imports so the widget uses React (host) instead.
 * The doc site runs in React; Preact's hooks use __H and crash when run inside React.
 * We remove the import and provide React hooks in the outer scope.
 */
function stripPreactHookImports(code: string): string {
  return code
    .replace(
      /import\s*\{[^}]*\}\s*from\s*["'](?:https:\/\/esm\.sh\/)?preact(?:@[^"']*)?\/hooks["'];?\s*\n?/g,
      ""
    )
    .replace(
      /import\s*\{[^}]*\}\s*from\s*["'](?:https:\/\/esm\.sh\/)?preact(?:@[^"']*)?["'];?\s*\n?/g,
      ""
    )
    .trim();
}

export async function transformWidgetModule(code: string): Promise<string> {
  if (looksLikeHtml(code)) {
    throw new Error(
      "Widget module is HTML, not JavaScript (e.g. a 404 page or SPA index). " +
        "Ensure the widget URL points to a real .js or .vw file, or that the LLM returned code instead of an error page."
    );
  }
  if (!looksLikeJsx(code)) return code;

  let normalized = normalizeJsx(code);
  const hadPreactHooks = /import\s*.*\s*from\s*["'].*preact.*\/hooks["']/.test(normalized);
  normalized = stripPreactHookImports(normalized);

  const Babel = await loadBabel();
  let result;
  try {
    result = Babel.transform(normalized, {
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
  const reactSetup =
    hadPreactHooks
      ? "const React = window.React;\nconst { useEffect, useRef, useState, useCallback, useMemo } = React;\n"
      : "const React = window.React;\n";
  return reactSetup + compiled;
}
