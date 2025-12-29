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
            "Updating fill color"
        ),
        "stroke_color": (
            r'stroke[=:]\s*["\']?#[0-9a-fA-F]+',
            "Adjusting stroke"
        ),
        "style_change": (
            r'style=\$\{\{[^}]*(?:color|background|font|border|padding|margin)',
            "Applying style changes"
        ),
        "attr_update": (
            r'\.attr\(["\'](?:fill|stroke|r|width|height|x|y|cx|cy)',
            "Updating element attributes"
        ),
        "text_update": (
            r'\.text\(|textContent',
            "Updating text content"
        ),
        "transition": (
            r'\.transition\(\)',
            "Adding transition effects"
        ),
        "event_handler": (
            r'\.on\(["\'](?:click|mouseover|mouseout|mouseenter|mouseleave)',
            "Configuring interactions"
        ),
        "scale_domain": (
            r'\.domain\(\[',
            "Adjusting scale domain"
        ),
        "scale_range": (
            r'\.range\(\[',
            "Setting scale range"
        ),
        "opacity": (
            r'opacity[=:]\s*[\d.]+',
            "Adjusting opacity"
        ),
        "font_size": (
            r'font-?[sS]ize[=:]\s*[\d]+',
            "Updating font size"
        ),
        "transform": (
            r'transform[=:]\s*["\']|\.attr\(["\']transform',
            "Applying transformations"
        ),
        "class_update": (
            r'class[=:]\s*["\']|classList',
            "Updating element classes"
        ),
        "dimension": (
            r'(?:width|height)[=:]\s*[\d]+',
            "Adjusting dimensions"
        ),
        "radius": (
            r'(?:rx|ry|r)[=:]\s*[\d]+|\.attr\(["\']r["\']',
            "Updating radius"
        ),
        "border_radius": (
            r'border-?[rR]adius[=:]\s*[\d]+',
            "Adjusting border radius"
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


# ============================================================================
# Component Code Extraction Utilities
# ============================================================================

def extract_imports(code: str) -> str:
    """Extract all import statements from JavaScript code."""
    import_lines = []
    for line in code.split('\n'):
        stripped = line.strip()
        if stripped.startswith('import '):
            import_lines.append(line)
    return '\n'.join(import_lines)


def extract_named_exports(code: str) -> list[str]:
    """
    Extract named exports (components) from JavaScript code.
    
    Detects patterns like:
    - export const ComponentName = ...
    - export function ComponentName(...) {...}
    - export class ComponentName {...}
    
    Returns:
        List of component names found
    """
    components = []
    
    # Match: export const Name = ...
    const_exports = re.findall(r'export\s+const\s+([A-Z][a-zA-Z0-9_]*)\s*=', code)
    components.extend(const_exports)
    
    # Match: export function Name(...) {...}
    func_exports = re.findall(r'export\s+function\s+([A-Z][a-zA-Z0-9_]*)\s*\(', code)
    components.extend(func_exports)
    
    # Match: export class Name {...}
    class_exports = re.findall(r'export\s+class\s+([A-Z][a-zA-Z0-9_]*)\s*\{', code)
    components.extend(class_exports)
    
    return list(set(components))  # Remove duplicates


def extract_component_code(full_code: str, component_name: str) -> str | None:
    """
    Extract the code for a specific named export component.
    
    Args:
        full_code: Full widget JavaScript code
        component_name: Name of the component to extract
    
    Returns:
        Component code if found, None otherwise
    """
    # Pattern for arrow function: export const Name = (...) => { ... };
    arrow_pattern = rf'export\s+const\s+{re.escape(component_name)}\s*=\s*\([^)]*\)\s*=>\s*\{{'
    # Pattern for function component: export const Name = ({ ... }) => { ... }
    func_component_pattern = rf'export\s+const\s+{re.escape(component_name)}\s*=\s*\(\{{'
    # Pattern for regular function: export function Name(...) { ... }
    function_pattern = rf'export\s+function\s+{re.escape(component_name)}\s*\('
    
    for pattern in [arrow_pattern, func_component_pattern, function_pattern]:
        match = re.search(pattern, full_code)
        if match:
            start = match.start()
            # Find the matching closing brace
            brace_count = 0
            in_string = False
            string_char = None
            i = match.end() - 1  # Start from the opening brace
            
            while i < len(full_code):
                char = full_code[i]
                
                # Handle string literals
                if char in '"\'`' and (i == 0 or full_code[i-1] != '\\'):
                    if not in_string:
                        in_string = True
                        string_char = char
                    elif char == string_char:
                        in_string = False
                        string_char = None
                
                if not in_string:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            # Include trailing semicolon if present
                            end = i + 1
                            if end < len(full_code) and full_code[end] == ';':
                                end += 1
                            return full_code[start:end]
                i += 1
    
    return None


def generate_standalone_wrapper(full_code: str, component_name: str) -> str:
    """
    Generate standalone widget code that renders only a specific component.
    
    This keeps all the original code (imports, helper functions, all components)
    but replaces the default export to render only the target component.
    
    Args:
        full_code: Full widget JavaScript code
        component_name: Name of the component to render
    
    Returns:
        Modified code with new default export
    """
    # Find the default export function
    default_pattern = r'export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{'
    match = re.search(default_pattern, full_code)
    
    if not match:
        # No default export found, append one
        return full_code + f"""

// Standalone wrapper for {component_name}
export default function Widget({{ model, html, React }}) {{
  return html`<${{{component_name}}} model=${{model}} html=${{html}} React=${{React}} />`;
}}
"""
    
    # Find the end of the default export function
    start = match.start()
    brace_count = 0
    in_string = False
    string_char = None
    i = match.end() - 1
    
    while i < len(full_code):
        char = full_code[i]
        
        if char in '"\'`' and (i == 0 or full_code[i-1] != '\\'):
            if not in_string:
                in_string = True
                string_char = char
            elif char == string_char:
                in_string = False
                string_char = None
        
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end = i + 1
                    break
        i += 1
    else:
        # Couldn't find end, return original
        return full_code
    
    # Replace the default export with a simple wrapper that renders the component
    pre_default = full_code[:start]
    post_default = full_code[end:] if end < len(full_code) else ""
    
    new_default = f"""// Standalone wrapper for {component_name}
export default function Widget({{ model, html, React }}) {{
  return html`<${{{component_name}}} model=${{model}} html=${{html}} React=${{React}} />`;
}}"""
    
    return pre_default + new_default + post_default
