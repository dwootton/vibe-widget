# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2024-12-24

### Fixed
- Build command in CI/CD to use --no-isolation flag
- Prevents build-from-sdist failure when AppWrapper.bundle.js is not in git

## [0.2.2] - 2024-12-24

### Fixed
- GitHub Actions workflow to build JavaScript bundle before Python package
- CI/CD pipeline now properly builds AppWrapper.bundle.js during release

## [0.2.1] - 2024-12-24

### Fixed
- Package build configuration to properly include AppWrapper.bundle.js
- MANIFEST.in to include all necessary JavaScript source files

### Added
- PyPI Trusted Publishing setup for automated releases

## [0.2.0] - 2024-12-24

### Added
- New API design with improved developer experience
- Enhanced documentation website with syntax highlighting
- Interactive examples with copy functionality
- GitHub stars display in navbar
- Tutorial walkthrough
- Gallery view for examples
- Custom vibe-widget theme
- 404 page
- Mobile-responsive design improvements

### Changed
- Updated documentation links and structure
- Improved preview functionality
- Refined landing page with syntax highlighting

### Fixed
- Preview rendering issues
- Mobile site layout glitches

## [0.1.0] - Initial Release

### Added
- Core widget creation from natural language prompts
- Support for interactive notebook interfaces
- Integration with Jupyter, JupyterLab, Colab, VS Code notebooks, and marimo
- Widget save/load functionality (.vw bundles)
- Built-in audits and approval workflows
- OpenRouter LLM integration
- Basic documentation and examples

[0.2.0]: https://github.com/dwootton/vibe-widget/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dwootton/vibe-widget/releases/tag/v0.1.0
