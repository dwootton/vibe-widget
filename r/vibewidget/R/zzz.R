#' @importFrom reticulate py_require import_from_path
NULL

.vw_state <- new.env(parent = emptyenv())
.vw_state$session_api <- NULL
.vw_state$py_ready <- FALSE

# The exact dependency set the vendored engine needs (see
# `inst/python/vibe_widget/pyproject.toml` for the canonical list this must
# be kept in sync with). Declaring it in `.onLoad` via `py_require()` is the
# whole "install step" a user needs: `py_require()` resolves and caches an
# ephemeral Python environment via `uv` the first time any Python is
# actually touched (not at package load time), so `library(vibewidget)`
# itself stays fast and side-effect-free even before Python exists at all.
.vw_python_requirements <- c(
  "anywidget>=0.9.0",
  "openai>=1.50.0",
  "requests>=2.32.0",
  "pandas>=2.0.0",
  "pretty-little-summary==0.3.0",
  "websockets>=13,<16"
)

.onLoad <- function(libname, pkgname) {
  # `py_require()` only declares a requirement; it does not initialize
  # Python. Requirements from every loaded package are merged and resolved
  # (via `uv`) only when reticulate is first asked to actually import
  # something - see `vw_py()` below.
  reticulate::py_require(packages = .vw_python_requirements, python_version = ">=3.10")

  python_dir <- .vw_python_dir()

  # `import_from_path()` with `delay_load = TRUE` returns immediately with a
  # proxy module; the actual `uv`-provisioned interpreter is not started,
  # and this vendored path is not even added to `sys.path`, until the first
  # attribute access on the proxy (i.e. the first real call from `R/*.R`).
  # This keeps a bare `library(vibewidget)` cheap and network-free.
  .vw_state$session_api <- reticulate::import_from_path(
    "vibe_widget.hosts.session_api",
    path = python_dir,
    delay_load = list(
      on_error = function(e) {
        stop(.vw_python_init_error_message(e), call. = FALSE)
      }
    )
  )

  invisible(NULL)
}

.vw_python_dir <- function() {
  dir <- system.file("python", package = "vibewidget")
  if (!nzchar(dir)) {
    # Only reachable when the package is loaded via `devtools::load_all()`
    # before `inst/python` has been synced - see `data-raw/sync-python.R`.
    dir <- file.path(getwd(), "inst", "python")
  }
  dir
}

.vw_python_init_error_message <- function(e) {
  paste0(
    "vibewidget could not start its Python engine.\n\n",
    "This package runs a vendored copy of the `vibe_widget` Python engine ",
    "through reticulate. The first time it is used, reticulate provisions ",
    "a Python environment (via `uv`) with the engine's dependencies. That ",
    "step failed with:\n\n  ", conditionMessage(e), "\n\n",
    "Things worth checking:\n",
    "  - Network access (the first run downloads `uv` and Python packages;\n",
    "    later runs are cached under `tools::R_user_dir(\"reticulate\")`).\n",
    "  - `reticulate::py_require()` / `reticulate::py_config()` for details ",
    "on the environment reticulate resolved.\n",
    "  - Set `RETICULATE_PYTHON` to point at a specific interpreter if you ",
    "need to bypass automatic provisioning."
  )
}

#' Access the vendored Python engine directly
#'
#' Returns the `vibe_widget.hosts.session_api` Python module (a reticulate
#' module proxy). Every exported R function in this package is a thin
#' wrapper around a call on this object; this accessor exists for advanced
#' use (introspection, calling something this package does not yet wrap) and
#' is what actually triggers Python initialization on first access.
#'
#' @return A reticulate Python module proxy.
#' @export
vw_py <- function() {
  .vw_state$session_api
}
