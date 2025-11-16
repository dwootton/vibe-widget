import re
import time
from typing import Dict, List, Tuple


class CodeStreamParser:
    """Parse streaming JavaScript code to detect landmarks and generate micro-updates."""
    
    BUBBLE_COOLDOWN = 0.5  # 500ms between bubbles of same type
    
    PATTERNS = {
        "import": (
            r'import\s+.*?\s+from\s+["\'](?:https?://)?(?:esm\.sh/)?([^"\'@]+)(?:@([^"\']+))?',
            "📦 Importing {package}..."
        ),
        "function_render": (
            r'function\s+render\s*\(',
            "⚙️ Building render function..."
        ),
        "const_data": (
            r'const\s+data\s*=\s*model\.get\(',
            "📊 Loading data..."
        ),
        "svg_create": (
            r'\.append\(["\']svg["\']\)',
            "🎨 Creating SVG canvas..."
        ),
        "element_create": (
            r'\.append\(["\'](?:div|canvas|g|circle|rect|path)["\']\)',
            "🎨 Adding visualization elements..."
        ),
        "scale": (
            r'd3\.scale(?:Linear|Band|Time|Point)',
            "📏 Setting up scales..."
        ),
        "axis": (
            r'd3\.axis(?:Bottom|Left|Top|Right)',
            "📐 Creating axes..."
        ),
        "data_binding": (
            r'model\.on\(["\']change:',
            "🔄 Setting up reactivity..."
        ),
        "selection": (
            r'\.selectAll\(["\'][^"\']+["\']\)',
            "🎯 Binding data to elements..."
        ),
        "transition": (
            r'\.transition\(\)',
            "✨ Adding animations..."
        ),
        "event_listener": (
            r'\.on\(["\'](?:click|mouseover|mouseout)',
            "👆 Adding interactivity..."
        ),
    }
    
    def __init__(self):
        self.buffer = ""
        self.detected = set()
        self.actions = []
        self.last_bubble_time = {}
        self.has_new_updates = False
        
    def parse_chunk(self, chunk: str) -> List[Dict[str, str]]:
        """Parse a code chunk and return detected micro-updates."""
        self.buffer += chunk
        updates = []
        self.has_new_updates = False
        current_time = time.time()
        
        for pattern_name, (regex, message_template) in self.PATTERNS.items():
            if pattern_name in self.detected:
                continue
                
            match = re.search(regex, self.buffer)
            if match:
                # Check cooldown - only emit bubble if enough time has passed
                if pattern_name in self.last_bubble_time:
                    if current_time - self.last_bubble_time[pattern_name] < self.BUBBLE_COOLDOWN:
                        continue  # Skip this update, too soon
                
                self.detected.add(pattern_name)
                self.last_bubble_time[pattern_name] = current_time
                self.has_new_updates = True
                
                # Extract package name for imports
                if pattern_name == "import" and match.groups():
                    package = match.group(1)
                    version = match.group(2) if len(match.groups()) > 1 else None
                    message = message_template.format(
                        package=f"{package}@{version}" if version else package
                    )
                else:
                    message = message_template
                
                updates.append({
                    "type": "micro_bubble",
                    "message": message,
                    "pattern": pattern_name,
                })
                
                # Also create action tile for imports
                if pattern_name == "import":
                    self.actions.append({
                        "type": "action_tile",
                        "title": "Loaded dependency",
                        "message": message,
                        "icon": "📦"
                    })
        
        return updates
    
    def has_new_pattern(self) -> bool:
        """Check if new patterns were detected in last parse."""
        return self.has_new_updates
    
    def get_actions(self) -> List[Dict[str, str]]:
        """Get all detected actions for the timeline."""
        return self.actions
    
    def get_completion_summary(self) -> Dict[str, any]:
        """Get summary of detected code features."""
        return {
            "total_patterns": len(self.detected),
            "has_imports": "import" in self.detected,
            "has_reactivity": "data_binding" in self.detected,
            "has_animation": "transition" in self.detected,
            "has_interaction": "event_listener" in self.detected,
            "detected_patterns": list(self.detected),
        }
