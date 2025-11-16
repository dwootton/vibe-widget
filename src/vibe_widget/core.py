import hashlib
from pathlib import Path
from typing import Any

import anywidget
import pandas as pd
import traitlets
from IPython.display import display

from vibe_widget.code_parser import CodeStreamParser
from vibe_widget.llm.claude import ClaudeProvider
from vibe_widget.progress import ProgressWidget


class VibeWidget(anywidget.AnyWidget):
    data = traitlets.List([]).tag(sync=True)
    description = traitlets.Unicode("").tag(sync=True)

    def __init__(
        self, 
        description: str, 
        df: pd.DataFrame, 
        api_key: str | None = None, 
        model: str = "claude-haiku-4-5-20251001", 
        show_progress: bool = True,
        **kwargs
    ):
        progress = None
        parser = CodeStreamParser()
        
        if show_progress:
            progress = ProgressWidget()
            display(progress)
        
        try:
            # Step 1: Analyze schema
            if progress:
                progress.add_timeline_item(
                    "Analyzing data",
                    f"Schema: {df.shape[0]} rows × {df.shape[1]} columns",
                    icon="📊",
                    complete=False
                )
                progress.add_micro_bubble("📊 Analyzing data schema...")
                progress.update_progress(10)
            
            llm_provider = ClaudeProvider(api_key=api_key, model=model)
            data_info = self._extract_data_info(df)
            
            if progress:
                progress.add_timeline_item(
                    "Schema analyzed",
                    f"Columns: {', '.join(df.columns.tolist()[:3])}{'...' if len(df.columns) > 3 else ''}",
                    icon="✓",
                    complete=True
                )
            
            # Step 2: Generate code with streaming
            if progress:
                progress.add_timeline_item(
                    "Generating code",
                    "Streaming from Claude API...",
                    icon="🤖",
                    complete=False
                )
                progress.add_micro_bubble("🤖 Generating widget code...")
                progress.update_progress(20)
            
            # Batch updates to reduce UI thrashing
            chunk_buffer = []
            update_counter = 0
            last_progress_update = 20
            
            def stream_callback(chunk: str):
                nonlocal update_counter, last_progress_update
                
                if not progress:
                    return
                
                chunk_buffer.append(chunk)
                update_counter += 1
                
                # Parse chunk for landmarks (but don't update console yet)
                updates = parser.parse_chunk(chunk)
                
                # Only update UI every 50 chunks OR when new pattern detected
                should_update = (
                    update_counter % 50 == 0 or 
                    parser.has_new_pattern() or
                    len(''.join(chunk_buffer)) > 500
                )
                
                if should_update:
                    # Batch update console
                    if chunk_buffer:
                        progress.add_stream(''.join(chunk_buffer))
                        chunk_buffer.clear()
                    
                    # Add micro-bubbles only for new patterns
                    for update in updates:
                        if update["type"] == "micro_bubble":
                            progress.add_micro_bubble(update["message"])
                    
                    # Update progress only if changed by at least 5%
                    current_size = len(parser.buffer)
                    estimated_progress = min(80, 20 + (current_size / 50))
                    
                    if abs(estimated_progress - last_progress_update) >= 5:
                        progress.update_progress(estimated_progress)
                        last_progress_update = estimated_progress
            
            def final_stream_flush():
                """Flush remaining buffer at end of stream."""
                if progress and chunk_buffer:
                    progress.add_stream(''.join(chunk_buffer))
                    chunk_buffer.clear()
            
            widget_code = llm_provider.generate_widget_code(
                description, 
                data_info, 
                progress_callback=stream_callback if show_progress else None
            )
            
            # Flush any remaining buffered chunks
            final_stream_flush()
            
            # Add action tiles for detected patterns
            if progress:
                for action in parser.get_actions():
                    progress.add_action_tile(action["icon"], action["message"])
                
                summary = parser.get_completion_summary()
                
                progress.add_timeline_item(
                    "Code generated",
                    f"Generated {len(widget_code)} characters with {summary['total_patterns']} features",
                    icon="✓",
                    complete=True
                )
            
            # Step 3: Build widget
            if progress:
                progress.add_timeline_item(
                    "Building widget",
                    "Saving JavaScript module...",
                    icon="⚙️",
                    complete=False
                )
                progress.add_micro_bubble("⚙️ Building widget...")
                progress.update_progress(85)
            
            widget_hash = hashlib.md5(f"{description}{df.shape}".encode()).hexdigest()[:8]
            widget_dir = Path(__file__).parent / "widgets"
            widget_file = widget_dir / f"widget_{widget_hash}.js"
            
            widget_file.write_text(widget_code)
            
            if progress:
                progress.add_action_tile("📄", f"Created widget_{widget_hash}.js")
                progress.add_timeline_item(
                    "Widget built",
                    f"Saved to {widget_file.name}",
                    icon="✓",
                    complete=True
                )
            
            self._esm = widget_code
            
            # Step 4: Finalize
            if progress:
                progress.add_timeline_item(
                    "Finalizing",
                    "Loading data and initializing...",
                    icon="🎨",
                    complete=False
                )
                progress.add_micro_bubble("🎨 Finalizing widget...")
                progress.update_progress(95)
            
            data_json = df.to_dict(orient="records")
            
            super().__init__(
                data=data_json,
                description=description,
                **kwargs
            )
            
            if progress:
                progress.add_timeline_item(
                    "Widget ready!",
                    f"Successfully created {description}",
                    icon="✓",
                    complete=True
                )
                progress.complete()
                
        except Exception as e:
            if progress:
                progress.add_timeline_item(
                    "Error occurred",
                    str(e),
                    icon="✗",
                    complete=False
                )
                progress.error(str(e))
            raise

    def _extract_data_info(self, df: pd.DataFrame) -> dict[str, Any]:
        return {
            "columns": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "shape": df.shape,
            "sample": df.head(3).to_dict(orient="records"),
        }


def create(
    description: str,
    df: pd.DataFrame,
    api_key: str | None = None,
    model: str = "claude-haiku-4-5-20251001",
    show_progress: bool = True,
) -> VibeWidget:
    return VibeWidget(
        description=description, 
        df=df, 
        api_key=api_key, 
        model=model,
        show_progress=show_progress
    )
