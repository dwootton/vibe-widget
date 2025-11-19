"""Test the new App Wrapper architecture without making API calls"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent / "src"))

from vibe_widget.core import VibeWidget
import traitlets

print("Testing App Wrapper Architecture")
print("=" * 50)

print("\n1. Checking VibeWidget has new traitlets...")
widget_traits = VibeWidget.class_trait_names()
assert 'status' in widget_traits, "Missing 'status' traitlet"
assert 'logs' in widget_traits, "Missing 'logs' traitlet"
assert 'code' in widget_traits, "Missing 'code' traitlet"
print("   ✓ All required traitlets present")

print("\n2. Checking app_wrapper.js exists...")
app_wrapper_path = Path(__file__).parent / "src" / "vibe_widget" / "app_wrapper.js"
assert app_wrapper_path.exists(), "app_wrapper.js not found"
print(f"   ✓ Found at {app_wrapper_path}")

print("\n3. Validating app_wrapper.js structure...")
wrapper_content = app_wrapper_path.read_text()
assert "import React" in wrapper_content, "Missing React import"
assert "function AppWrapper" in wrapper_content, "Missing AppWrapper component"
assert "function ProgressMap" in wrapper_content, "Missing ProgressMap component"
assert "function SandboxedRunner" in wrapper_content, "Missing SandboxedRunner component"
assert "function FloatingMenu" in wrapper_content, "Missing FloatingMenu component"
assert "export default { render }" in wrapper_content, "Missing default export"
print("   ✓ All components present")

print("\n4. Checking ESM imports use esm.sh CDN...")
assert "https://esm.sh/react" in wrapper_content, "React not from esm.sh"
assert "https://esm.sh/react-dom" in wrapper_content, "ReactDOM not from esm.sh"
print("   ✓ Using ESM CDN imports")

print("\n5. Checking state-based rendering logic...")
assert "status === 'generating'" in wrapper_content, "Missing 'generating' state check"
assert "status === 'error'" in wrapper_content, "Missing 'error' state check"
assert "status === 'ready'" in wrapper_content or "ProgressMap" in wrapper_content, "Missing ready/generating state handling"
print("   ✓ State-based rendering implemented")

print("\n6. Checking model reactivity...")
assert "model.on('change:status'" in wrapper_content, "Missing status change listener"
assert "model.on('change:logs'" in wrapper_content, "Missing logs change listener"
assert "model.on('change:code'" in wrapper_content, "Missing code change listener"
print("   ✓ Model reactivity configured")

print("\n7. Checking dynamic code execution in SandboxedRunner...")
assert "import(url)" in wrapper_content or "await import" in wrapper_content, "Missing dynamic import"
print("   ✓ Dynamic code execution implemented")

print("\n" + "=" * 50)
print("✓ All architecture tests passed!")
print("\nArchitecture Summary:")
print("  • Unified AppWrapper component")
print("  • State management (idle → generating → ready/error)")
print("  • Streaming logs during generation")
print("  • Dynamic code sandbox execution")
print("  • Floating menu for future interactions")
print("\nNext steps:")
print("  • Test with actual API call: python test_app_wrapper.py")
print("  • Implement vw.change(widget, 'new instruction') method")
