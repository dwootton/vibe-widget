# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] - 2026-09-16

### Fixed
- Agent tools reach models that reject dots in tool names: the wire name sends `fs_read` while the
  registry still resolves it back to `fs.read`, so file access works on Anthropic endpoints.
- `widget.edit` keeps the source widget's outputs and non-data inputs; a chained edit no longer
  drops the traits an earlier revision declared.
- Code returned with a sentence of prose before the first statement is stripped back to the code.
- `vibe_widget.__version__` is read from the installed distribution. It was a literal that had gone
  stale at 0.3.2, and it is what `provenance.vibe_widget_version` records in every widget sidecar.
- The source distribution no longer carries `doc/`, `examples/` and the committed widget cache,
  which had taken the 0.3.2 sdist to 14 MB. It is now about 1 MB, the same as the wheel.

### Changed
- Default generation budget is 32k output tokens, overridable with `VIBE_MAX_TOKENS`; chained edits
  on long widgets were truncating at 16k.
- Generation and revision prompts state the rules that broke d3 interactions: build the SVG from
  data and layout only, hold live gesture values in refs, read positions with `d3.pointer` against
  the plot group, give draggable marks a 12px hit area, focus the element that carries key handlers,
  and call hooks only at the top level of a component. Revisions are told to keep every existing
  feature unless the request changes it.

## [0.3.2] - 2026-09-15

### Fixed
- Several widgets on one page no longer break each other: one React instance now owns every generated widget tree, so a widget whose code defines sub-components using hooks renders instead of throwing React error #321.

## [0.3.1] - 2026-09-15

### Fixed
- `vw.create` with a cached prompt returns that widget's own code again; cache lookups no longer follow the revision chain unless asked, so chained edits hit the cache instead of regenerating.
- A `vendor/model` id with no explicit endpoint routes to OpenRouter when `OPENROUTER_API_KEY` is set, even if an Anthropic or OpenAI key is also present; changing the model re-infers the endpoint.

## [0.3.0] - 2026-09-15

### Fixed
- Auto-repair budget is `retry` attempts per generation; a successful repair no longer refills it, and exhaustion sets status `blocked` with a hint.
- Cached widgets load and render without an API key; the key is only needed for generation, edits, repairs and audits.
- Cache lookups follow only the widget's own revision chain, so two prompts sharing a variable name no longer collide.
- Quarto and nbconvert renders complete synchronously and the embedded widget state survives the HTML tokenizer; panels are legible on light themes.
- Generated code may call `model.set` for its own state; undeclared keys stay in the browser and never reach Python.
- No automatic LLM audit: approval and audit are explicit buttons, and the audit notice no longer covers widgets in auto mode.
- Unknown model ids report `not_found` with the server's message and never echo the response body; a spent key quota reports `quota`.
- A repair whose code fails to bundle is rolled back instead of applied; `vw.edit` keeps the parent's prompt history.

### Changed
- Zero-setup keys: `.env` files are discovered automatically and the provider, endpoint and default model are inferred from `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY` or `VIBE_API_KEY`.
- Positron and Quarto are detected alongside VS Code, Colab and JupyterLite.
- Requests adapt to endpoints that reject `max_tokens`, `temperature` or `stream_options`.
- Users holding both `ANTHROPIC_API_KEY` and `OPENROUTER_API_KEY` now default to Anthropic; set `VIBE_API_KEY` and `VIBE_BASE_URL` to pin a provider.

### Removed
- `vibe_widget.debug` module, which shipped caller locals and globals to the frontend
- Agent tools `python.write_module`, `python.run_module`, `widget.set_input`, and
  `widget.set_output`, plus the unregistered `cli_execute` and `code_repair` tools
- Automatic `npm install` during server-side bundling; a widget importing a package that the
  repository `node_modules` cannot resolve now falls back to the browser bundler

### Added
- `SECURITY.md`, `CONTRIBUTING.md`, and a CI workflow running ruff and pytest on 3.9 and 3.12
- `tests/` is tracked again, with smoke, tool permission, and bundling tests
- Any OpenAI-compatible endpoint via `vw.config(base_url=...)`; `temperature`, `streaming` and a
  new `timeout` are now honored, token usage is tracked and readable as `widget.usage`, and API
  failures raise a `ProviderError` with a plain-language fix instead of a raw SDK exception
- `.vibewidget/` is now a git-shareable artifact: one `.js` plus one `.json` sidecar per widget,
  no shared index file, with outputs, inputs, actions and generation provenance recorded per widget

### Changed (continued)
- Data sent to the LLM now honours `vw.config(data_privacy=..., sample_rows=...)`; schema mode
  sends no cell values
- Generated widget code receives a restricted model facade limited to the widget's declared
  inputs, outputs and actions, and no longer patches page-wide timers or `console`

### Security
- The browser can no longer choose a save path or invoke agent tools: `save_widget` writes only
  under `.vibewidget/exports/`, and the `remote_call` bridge is gone
- Approval mode is enforced in Python: `render_code` stays empty until the code is approved,
  including for cached and loaded widgets

## [0.2.4] - 2026-01-15

### Fixed
- Preserve rerun parameters across widget reruns
- Add copy button for source viewer code
- Gate noisy AppWrapper render debug logs behind debug mode

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
[0.3.0]: https://github.com/dwootton/vibe-widget/compare/v0.2.7...v0.3.0
[0.3.1]: https://github.com/dwootton/vibe-widget/compare/v0.3.0...v0.3.1
[0.3.2]: https://github.com/dwootton/vibe-widget/compare/v0.3.1...v0.3.2
