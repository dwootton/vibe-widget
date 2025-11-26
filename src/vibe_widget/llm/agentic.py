"""
Agentic Orchestrator for widget generation.

Design philosophy:
- Process data first with appropriate Python tools (no LLM for parsing)
- Use LLM only for: code generation, error repair, data wrangling decisions
- Always run validation and testing after code generation
- Keep prompt context concise and focused
"""

import json
import re
from typing import Any, Callable, Tuple

from anthropic import Anthropic
import pandas as pd

from vibe_widget.data_parser.data_profile import DataProfile
from vibe_widget.data_parser.data_processor import DataProcessor
from vibe_widget.llm.tools import (
    ToolRegistry,
    ToolResult,
    CodeValidateTool,
    RuntimeTestTool,
    ErrorDiagnoseTool,
)


class AgenticOrchestrator:
    """
    Main orchestrator for widget generation.
    
    Flow:
    1. Process data (Python-based, no LLM)
    2. Generate code (LLM tool)
    3. Validate code (Python-based)
    4. Test runtime (Python-based)
    5. If errors: repair with LLM
    6. Return final code
    """
    
    def __init__(
        self,
        api_key: str | None = None,
        model: str = "claude-haiku-4-5-20251001",
        max_repair_attempts: int = 3,
    ):
        import os
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key required. Pass api_key or set ANTHROPIC_API_KEY env variable."
            )
        self.model = model
        self.client = Anthropic(api_key=self.api_key)
        self.max_repair_attempts = max_repair_attempts
        
        # Data processor (Python-based)
        self.data_processor = DataProcessor()
        
        # Python-based validation tools
        self.validate_tool = CodeValidateTool()
        self.runtime_tool = RuntimeTestTool()
        self.diagnose_tool = ErrorDiagnoseTool()
        
        # Artifacts from generation
        self.artifacts = {}
    
    def generate(
        self,
        description: str,
        source: Any,
        exports: dict[str, str] | None = None,
        imports: dict[str, str] | None = None,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> Tuple[str, pd.DataFrame, DataProfile]:
        """
        Generate widget code from description and data source.
        
        Args:
            description: Natural language widget description
            source: Data source (DataFrame, file path, URL, etc.)
            exports: Dict of export trait names -> descriptions
            imports: Dict of import trait names -> descriptions
            progress_callback: Optional callback for progress updates
        
        Returns:
            Tuple of (widget_code, processed_dataframe, data_profile)
        """
        exports = exports or {}
        imports = imports or {}
        
        self._emit(progress_callback, "step", "Processing data...")
        
        # Step 1: Process data with Python tools
        df, profile, needs_agentic = self.data_processor.process(source)
        
        # If agentic processing needed (PDF, web, unknown), use LLM tools
        if needs_agentic and df.empty:
            self._emit(progress_callback, "step", "Data requires advanced extraction...")
            df, profile = self._agentic_data_extraction(source, profile, progress_callback)
        
        self._emit(progress_callback, "step", f"Data ready: {df.shape[0]} rows × {df.shape[1]} columns")
        
        # Step 2: Prepare context for code generation
        data_info = self._build_data_info(df, profile, exports, imports)
        
        # Step 3: Generate code with LLM
        self._emit(progress_callback, "step", "Generating widget code...")
        code = self._generate_code(description, data_info, progress_callback)
        
        # Step 4: Validate code (Python-based)
        self._emit(progress_callback, "step", "Validating code...")
        validation = self.validate_tool.execute(
            code=code,
            expected_exports=list(exports.keys()),
            expected_imports=list(imports.keys()),
        )
        
        # Step 5: Runtime test (Python-based)
        self._emit(progress_callback, "step", "Testing runtime...")
        runtime = self.runtime_tool.execute(code=code)
        
        # Step 6: If errors, attempt repair
        repair_attempts = 0
        while repair_attempts < self.max_repair_attempts:
            issues = []
            
            if not validation.success:
                issues.extend(validation.output.get("issues", []))
            if not runtime.success:
                issues.extend(runtime.output.get("issues", []))
            
            if not issues:
                break
            
            repair_attempts += 1
            self._emit(progress_callback, "step", f"Repairing code (attempt {repair_attempts})...")
            
            code = self._repair_code(
                code=code,
                issues=issues,
                data_info=data_info,
                progress_callback=progress_callback,
            )
            
            # Re-validate
            validation = self.validate_tool.execute(
                code=code,
                expected_exports=list(exports.keys()),
                expected_imports=list(imports.keys()),
            )
            runtime = self.runtime_tool.execute(code=code)
        
        self._emit(progress_callback, "complete", "Widget generation complete")
        
        # Store artifacts
        self.artifacts["generated_code"] = code
        self.artifacts["validation"] = validation.output
        self.artifacts["data_profile"] = profile
        
        return code, df, profile
    
    def fix_runtime_error(
        self,
        code: str,
        error_message: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """
        Fix a runtime error in widget code.
        
        Args:
            code: Current widget code with error
            error_message: Error message from runtime
            data_info: Data context information
            progress_callback: Optional progress callback
        
        Returns:
            Fixed widget code
        """
        self._emit(progress_callback, "step", "Diagnosing error...")
        
        # Diagnose the error
        diagnosis = self.diagnose_tool.execute(
            error_message=error_message,
            code=code,
        )
        
        self._emit(progress_callback, "step", "Repairing code...")
        
        # Repair with LLM
        fixed_code = self._repair_code(
            code=code,
            issues=[diagnosis.output.get("full_error", error_message)],
            data_info=data_info,
            diagnosis=diagnosis.output,
            progress_callback=progress_callback,
        )
        
        return fixed_code
    
    def revise_code(
        self,
        code: str,
        revision_request: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """
        Revise widget code based on user request.
        
        Args:
            code: Current widget code
            revision_request: User's revision request
            data_info: Data context information
            progress_callback: Optional progress callback
        
        Returns:
            Revised widget code
        """
        self._emit(progress_callback, "step", "Revising widget code...")
        
        prompt = self._build_revision_prompt(code, revision_request, data_info)
        
        code_chunks = []
        with self.client.messages.stream(
            model=self.model,
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                code_chunks.append(text)
                self._emit(progress_callback, "chunk", text)
        
        revised_code = self._clean_code("".join(code_chunks))
        
        # Validate
        self._emit(progress_callback, "step", "Validating revision...")
        validation = self.validate_tool.execute(code=revised_code)
        
        if not validation.success:
            self._emit(progress_callback, "step", "Fixing validation issues...")
            revised_code = self._repair_code(
                code=revised_code,
                issues=validation.output.get("issues", []),
                data_info=data_info,
                progress_callback=progress_callback,
            )
        
        self._emit(progress_callback, "complete", "Revision complete")
        return revised_code
    
    def _generate_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """Generate widget code using LLM."""
        prompt = self._build_generation_prompt(description, data_info)
        
        code_chunks = []
        with self.client.messages.stream(
            model=self.model,
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                code_chunks.append(text)
                self._emit(progress_callback, "chunk", text)
        
        return self._clean_code("".join(code_chunks))
    
    def _repair_code(
        self,
        code: str,
        issues: list[str],
        data_info: dict[str, Any],
        diagnosis: dict[str, Any] | None = None,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """Repair code using LLM."""
        prompt = self._build_repair_prompt(code, issues, data_info, diagnosis)
        
        message = self.client.messages.create(
            model=self.model,
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
        
        return self._clean_code(message.content[0].text)
    
    def _agentic_data_extraction(
        self,
        source: Any,
        profile: DataProfile,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> Tuple[pd.DataFrame, DataProfile]:
        """
        Use LLM-assisted extraction for complex sources (PDF, web, unknown).
        This is called when Python extractors fail or return empty data.
        """
        # For now, return the profile as-is and empty DataFrame
        # The agentic system will work with sample_records in the profile
        if profile.sample_records:
            return pd.DataFrame(profile.sample_records), profile
        return pd.DataFrame(), profile
    
    def _build_data_info(
        self,
        df: pd.DataFrame,
        profile: DataProfile,
        exports: dict[str, str],
        imports: dict[str, str],
    ) -> dict[str, Any]:
        """Build concise data info for LLM context."""
        # Get sample data
        sample = df.head(3).to_dict(orient="records") if not df.empty else []
        
        return {
            "columns": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "shape": df.shape,
            "sample": sample,
            "exports": exports,
            "imports": imports,
            # From profile (if available)
            "is_timeseries": profile.is_timeseries,
            "temporal_column": profile.temporal_column,
            "is_geospatial": profile.is_geospatial,
            "coordinate_columns": profile.coordinate_columns,
        }
    
    def _build_generation_prompt(
        self,
        description: str,
        data_info: dict[str, Any],
    ) -> str:
        """Build concise generation prompt."""
        columns = data_info.get("columns", [])
        dtypes = data_info.get("dtypes", {})
        sample = data_info.get("sample", [])
        exports = data_info.get("exports", {})
        imports = data_info.get("imports", {})
        
        # Build exports/imports section
        traits_section = ""
        if exports:
            export_list = "\n".join([f"- {name}: {desc}" for name, desc in exports.items()])
            traits_section += f"""
EXPORTS (state to share with other widgets):
{export_list}
- Initialize exports on mount with model.set() + model.save_changes()
- Update on user interaction with model.set() + model.save_changes()
"""
        
        if imports:
            import_list = "\n".join([f"- {name}: {desc}" for name, desc in imports.items()])
            traits_section += f"""
IMPORTS (state from other widgets):
{import_list}
- Read with model.get("{list(imports.keys())[0] if imports else 'trait'}")
- Subscribe with model.on("change:trait", handler)
- Unsubscribe in cleanup with model.off("change:trait", handler)
"""
        
        return f"""Generate a React widget for AnyWidget.

TASK: {description}

DATA:
- Columns: {', '.join(str(c) for c in columns) if columns else 'No data'}
- Types: {dtypes}
- Sample: {json.dumps(sample[:2], default=str) if sample else 'None'}
{traits_section}

CRITICAL RULES:
1. export default function Widget({{ model, html, React }}) {{ ... }}
2. Use html`...` tagged templates (htm), NOT JSX
3. Access data: const data = model.get("data") || []
4. Every useEffect MUST return cleanup function
5. Use class= not className= in html templates
6. CDN imports with versions: https://esm.sh/d3@7
7. Fixed heights (400-600px), never 100vh
8. No document.body, no ReactDOM.render

TEMPLATE:
```javascript
import * as d3 from "https://esm.sh/d3@7";

export default function Widget({{ model, html, React }}) {{
  const data = model.get("data") || [];
  const containerRef = React.useRef(null);

  React.useEffect(() => {{
    if (!containerRef.current) return;
    // Initialize visualization
    return () => {{ /* cleanup */ }};
  }}, [data]);

  return html`<div ref=${{containerRef}} style=${{{{ height: '400px' }}}}></div>`;
}}
```

OUTPUT: Only JavaScript code. No markdown fences. No explanations.
"""
    
    def _build_repair_prompt(
        self,
        code: str,
        issues: list[str],
        data_info: dict[str, Any],
        diagnosis: dict[str, Any] | None = None,
    ) -> str:
        """Build repair prompt."""
        issues_text = "\n".join([f"- {issue}" for issue in issues])
        
        diagnosis_text = ""
        if diagnosis:
            diagnosis_text = f"""
DIAGNOSIS:
- Type: {diagnosis.get('error_type', 'unknown')}
- Cause: {diagnosis.get('root_cause', 'unknown')}
- Suggested fix: {diagnosis.get('suggested_fix', 'unknown')}
"""
        
        return f"""Fix this AnyWidget code.

ISSUES:
{issues_text}
{diagnosis_text}

BROKEN CODE:
```javascript
{code}
```

DATA:
- Columns: {data_info.get('columns', [])}
- Exports: {data_info.get('exports', {{}})}
- Imports: {data_info.get('imports', {{}})}

RULES:
1. export default function Widget({{ model, html, React }})
2. html`...` templates, not JSX
3. Guard all data access with null checks
4. Every useEffect needs cleanup return
5. CDN imports with versions

OUTPUT: Only fixed JavaScript code. No markdown fences.
"""
    
    def _build_revision_prompt(
        self,
        code: str,
        revision_request: str,
        data_info: dict[str, Any],
    ) -> str:
        """Build revision prompt."""
        return f"""Revise this AnyWidget code.

REQUEST: {revision_request}

CURRENT CODE:
```javascript
{code}
```

DATA:
- Columns: {data_info.get('columns', [])}
- Exports: {data_info.get('exports', {{}})}
- Imports: {data_info.get('imports', {{}})}

RULES:
1. Keep same structure: export default function Widget({{ model, html, React }})
2. Use html`...` templates
3. Maintain all cleanup handlers
4. Keep CDN imports versioned

OUTPUT: Only revised JavaScript code. No markdown fences.
"""
    
    def _clean_code(self, code: str) -> str:
        """Clean code output."""
        code = re.sub(r"```(?:javascript|jsx?|typescript|tsx?)?\s*\n?", "", code)
        code = re.sub(r"\n?```\s*", "", code)
        return code.strip()
    
    def _emit(
        self,
        callback: Callable[[str, str], None] | None,
        event_type: str,
        message: str,
    ):
        """Emit progress event."""
        if callback:
            callback(event_type, message)
    
    def get_pipeline_artifacts(self) -> dict[str, Any]:
        """Get artifacts from the generation pipeline."""
        return self.artifacts
