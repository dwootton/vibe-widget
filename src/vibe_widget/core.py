import json
from pathlib import Path
from typing import Any

import pandas as pd

from vibe_widget.llm.claude import ClaudeProvider
from vibe_widget.templates import REACT_TEMPLATE


class VibeWidget:
    def __init__(self, api_key: str | None = None, model: str = "claude-sonnet-4-5-20250929"):
        self.llm_provider = ClaudeProvider(api_key=api_key, model=model)

    def create(
        self,
        description: str,
        df: pd.DataFrame,
        output_path: str | Path | None = None,
    ) -> str:
        data_info = self._extract_data_info(df)

        component_code = self.llm_provider.generate_widget_code(description, data_info)

        data_json = df.to_dict(orient="records")
        full_component_code = f"""
        const data = {json.dumps(data_json, indent=2)};
        {component_code}
        """

        html_content = REACT_TEMPLATE.format(component_code=full_component_code)

        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(html_content)
            return str(output_file.absolute())

        return html_content

    def _extract_data_info(self, df: pd.DataFrame) -> dict[str, Any]:
        return {
            "columns": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "shape": df.shape,
            "sample": df.head(3).to_dict(orient="records"),
        }


_default_widget = None


def create(
    description: str,
    df: pd.DataFrame,
    output_path: str | Path | None = None,
    api_key: str | None = None,
    model: str = "claude-sonnet-4-5-20250929",
) -> str:
    global _default_widget
    if _default_widget is None:
        _default_widget = VibeWidget(api_key=api_key, model=model)
    return _default_widget.create(description, df, output_path)
