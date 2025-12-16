import re
import time
from typing import Dict, List, Tuple


class CodeStreamParser:
    """Parse streaming JavaScript code to detect landmarks and generate micro-updates."""
    
    BUBBLE_COOLDOWN = 0.5  # 500ms between bubbles of same type
    
    PATTERNS = {
        "import": (
            r'import\s+.*?\s+from\s+["\'](?:https?://)?(?:esm\.sh/)?([^"\'@]+)(?:@([^"\']+))?',
            "Importing {package}..."
        ),
        "export_function": (
            r'export\s+default\s+function',
            "Creating widget component..."
        ),
        "const_data": (
            r'const\s+data\s*=\s*model\.get\(',
            "Loading data..."
        ),
        "react_hooks": (
            r'React\.(?:useState|useEffect|useRef|useMemo|useCallback)',
            "Setting up React hooks..."
        ),
        "html_template": (
            r'html`',
            "Building UI components..."
        ),
        "style_object": (
            r'style=\$\{\{',
            "Applying styles..."
        ),
        "data_map": (
            r'\.map\(\(',
            "Processing data..."
        ),
        "svg_create": (
            r'\.append\(["\']svg["\']\)',
            "Creating SVG canvas..."
        ),
        "element_create": (
            r'\.append\(["\'](?:div|canvas|g|circle|rect|path)["\']\)',
            "Adding visualization elements..."
        ),
        "scale": (
            r'd3\.scale(?:Linear|Band|Time|Point)',
            "Setting up scales..."
        ),
        "axis": (
            r'd3\.axis(?:Bottom|Left|Top|Right)',
            "Creating axes..."
        ),
        "data_binding": (
            r'model\.on\(["\']change:',
            "Setting up reactivity..."
        ),
        "selection": (
            r'\.selectAll\(["\'][^"\']+["\']\)',
            "Binding data to elements..."
        ),
        "transition": (
            r'\.transition\(\)',
            "Adding animations..."
        ),
        "event_listener": (
            r'\.on\(["\'](?:click|mouseover|mouseout)',
            "Adding interactivity..."
        ),
        "conditional_render": (
            r'\$\{[^}]*&&[^}]*html`',
            "Adding conditional rendering..."
        ),
        "return_statement": (
            r'return\s+html`',
            "Finalizing component..."
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
                        "icon": "→"
                    })
        
        return updates
    
    def has_new_pattern(self) -> bool:
        """Check if new patterns were detected in last parse."""
        return self.has_new_updates
    
    def get_actions(self) -> List[Dict[str, str]]:
        """Get all detected actions for the timeline."""
        return self.actions
    
    def get_progress(self) -> float:
        """Get code generation progress based on detected patterns (0.0 to 1.0)."""
        total_patterns = len(self.PATTERNS)
        detected_count = len(self.detected)
        return min(1.0, detected_count / total_patterns)
    
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


class RevisionStreamParser:
    """Parse streaming code during revisions to detect edit-specific landmarks."""
    
    BUBBLE_COOLDOWN = 0.3
    
    PATTERNS = {
        "fill_color": (
            r'fill[=:]\s*["\']?#[0-9a-fA-F]+|fill[=:]\s*["\']?\w+',
            "Updating fill color..."
        ),
        "stroke_color": (
            r'stroke[=:]\s*["\']?#[0-9a-fA-F]+',
            "Adjusting stroke..."
        ),
        "style_change": (
            r'style=\$\{\{[^}]*(?:color|background|font|border|padding|margin)',
            "Applying style changes..."
        ),
        "attr_update": (
            r'\.attr\(["\'](?:fill|stroke|r|width|height|x|y|cx|cy)',
            "Updating element attributes..."
        ),
        "text_update": (
            r'\.text\(|textContent',
            "Updating text content..."
        ),
        "transition": (
            r'\.transition\(\)',
            "Adding transition effects..."
        ),
        "event_handler": (
            r'\.on\(["\'](?:click|mouseover|mouseout|mouseenter|mouseleave)',
            "Configuring interactions..."
        ),
        "scale_domain": (
            r'\.domain\(\[',
            "Adjusting scale domain..."
        ),
        "scale_range": (
            r'\.range\(\[',
            "Setting scale range..."
        ),
        "opacity": (
            r'opacity[=:]\s*[\d.]+',
            "Adjusting opacity..."
        ),
        "font_size": (
            r'font-?[sS]ize[=:]\s*[\d]+',
            "Updating font size..."
        ),
        "transform": (
            r'transform[=:]\s*["\']|\.attr\(["\']transform',
            "Applying transformations..."
        ),
        "class_update": (
            r'class[=:]\s*["\']|classList',
            "Updating element classes..."
        ),
        "dimension": (
            r'(?:width|height)[=:]\s*[\d]+',
            "Adjusting dimensions..."
        ),
        "radius": (
            r'(?:rx|ry|r)[=:]\s*[\d]+|\.attr\(["\']r["\']',
            "Updating radius..."
        ),
        "border_radius": (
            r'border-?[rR]adius[=:]\s*[\d]+',
            "Adjusting border radius..."
        ),
    }
    
    def __init__(self):
        self.buffer = ""
        self.detected = set()
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
                if pattern_name in self.last_bubble_time:
                    if current_time - self.last_bubble_time[pattern_name] < self.BUBBLE_COOLDOWN:
                        continue
                
                self.detected.add(pattern_name)
                self.last_bubble_time[pattern_name] = current_time
                self.has_new_updates = True
                
                updates.append({
                    "type": "micro_bubble",
                    "message": message_template,
                    "pattern": pattern_name,
                })
        
        return updates
    
    def has_new_pattern(self) -> bool:
        """Check if new patterns were detected in last parse."""
        return self.has_new_updates
