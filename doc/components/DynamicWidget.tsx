import React, { useMemo } from 'react';
import * as d3 from 'd3';
// @ts-ignore
import { html } from 'htm/react/index.js';

interface DynamicWidgetProps {
  code: string;
}

export default function DynamicWidget({ code }: DynamicWidgetProps) {
  const Component = useMemo(() => {
    try {
      // 1. Strip imports (naive approach for the specific format we generated)
      const cleanCode = code
        .replace(/import .* from .*/g, '')
        .replace(/export default function .*\({.*}\) {/, 'const Widget = ({ model, html, React }) => {') // Transform export default
        .replace(/return html`/, 'return html`') 
        .concat('\nreturn Widget;'); // Return the component function

      // 2. Create a function that constructs the component
      // We pass dependencies into the scope
      const createComponent = new Function('React', 'html', 'd3', cleanCode);
      
      // 3. Execute to get the Component definition
      const WidgetFn = createComponent(React, html, d3);
      
      return WidgetFn;
    } catch (e) {
      console.error("Widget Compilation Error:", e);
      return () => <div className="p-4 text-red-500 font-mono text-xs">Error compiling widget. check console.</div>;
    }
  }, [code]);

  // Mock Model for the widgets - Memoize to prevent re-renders
  const mockModel = useMemo(() => ({
    get: () => {},
    set: () => {},
    save_changes: () => {},
    on: () => {},
    off: () => {}
  }), []);

  return (
    <div className="w-full h-full overflow-hidden">
        <Component model={mockModel} html={html} React={React} />
    </div>
  );
}