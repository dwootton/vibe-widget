from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    @abstractmethod
    def generate_widget_code(self, description: str, data_info: dict[str, Any] | None) -> str:
        pass
