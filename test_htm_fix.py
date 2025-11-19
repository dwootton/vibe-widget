"""
Test the fixed architecture with htm instead of JSX
This validates the syntax without making an API call
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent / "src"))

print("Testing HTM-based App Wrapper Architecture")
print("=" * 50)

print("\n1. Checking app_wrapper.js uses htm (not JSX)...")
app_wrapper_path = Path(__file__).parent / "src" / "vibe_widget" / "app_wrapper.js"
wrapper_content = app_wrapper_path.read_text()

assert "import htm from" in wrapper_content, "Missing htm import"
assert "const html = htm.bind(React.createElement)" in wrapper_content, "Missing htm binding"
print("   ✓ htm imported and bound to React.createElement")

print("\n2. Validating no JSX syntax present...")
jsx_patterns = [
    "return <div",
    "return <span",
    "return <button",
    "className=",
]
for pattern in jsx_patterns:
    if pattern in wrapper_content:
        print(f"   ✗ Found JSX pattern: {pattern}")
        sys.exit(1)
print("   ✓ No JSX syntax found")

print("\n3. Checking htm template syntax...")
assert "html`" in wrapper_content, "Missing html tagged templates"
assert "<${" in wrapper_content, "Missing component interpolation syntax"
print("   ✓ Using html tagged templates correctly")

print("\n4. Verifying dependency injection pattern...")
assert "model=${model}" in wrapper_content, "Missing model prop passing"
assert "html=${html}" in wrapper_content, "Missing html prop passing"
assert "React=${React}" in wrapper_content, "Missing React prop passing"
print("   ✓ Dependency injection implemented")

print("\n5. Checking SandboxedRunner expects function (not object)...")
assert "typeof module.default === 'function'" in wrapper_content, "Not checking for function export"
print("   ✓ SandboxedRunner validates function export")

print("\n6. Validating LLM prompt structure...")
from vibe_widget.llm.claude import ClaudeProvider
import os

os.environ['ANTHROPIC_API_KEY'] = 'test-key'
provider = ClaudeProvider(api_key='test-key')

prompt = provider._build_prompt(
    "test visualization",
    {"columns": ["a", "b"], "dtypes": {}, "sample": []}
)

assert "export default function" in prompt, "Prompt doesn't specify function export"
assert "{ model, html, React }" in prompt, "Prompt missing dependency injection params"
assert "html`" in prompt, "Prompt doesn't show htm usage"
assert "DO NOT use JSX" in prompt, "Prompt doesn't warn against JSX"
print("   ✓ LLM prompt uses dependency injection pattern")

print("\n" + "=" * 50)
print("✓ All HTM architecture tests passed!")
print("\nKey Changes:")
print("  • AppWrapper uses htm (not JSX)")
print("  • Generated code receives { model, html, React }")
print("  • No transpilation/bundler required")
print("  • Browser-compatible JavaScript")
print("\nReady to test in Jupyter Lab!")
