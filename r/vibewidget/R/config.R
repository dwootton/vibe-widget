#' Configure the Vibe Widget engine
#'
#' Sets process-wide generation options (which model to use, the API key,
#' the widget cache directory). Mirrors `vibe_widget.config(...)` on the
#' Python side; like that function, these settings are process-global, not
#' per-session - if you need per-session isolation, run separate R
#' processes.
#'
#' @param model Optional model identifier/shortcut (e.g.
#'   `"google/gemini-3.1-pro-preview"`). Passed straight through to the
#'   engine's model resolution.
#' @param api_key Optional API key. Defaults to the `OPENROUTER_API_KEY`
#'   environment variable when not set here.
#' @param execution One of `"auto"` (generated code runs immediately) or
#'   `"approve"` (code must be explicitly approved before it runs).
#' @param store_dir Optional directory for the widget cache
#'   (`.vibewidget/`, by default under the current working directory).
#'   Useful because an R user's working directory is not always a fixed
#'   project root the way a Python notebook's usually is.
#' @param ... Additional keyword arguments forwarded to
#'   `vibe_widget.config()` (see the Python package's documentation).
#'
#' @return Invisibly, a list describing the current configuration.
#' @export
#' @examples
#' \dontrun{
#' vw_config(model = "google/gemini-3.1-pro-preview")
#' }
vw_config <- function(model = NULL,
                       api_key = NULL,
                       execution = NULL,
                       store_dir = NULL,
                       ...) {
  vw <- .vw_vibe_widget()
  args <- list(...)
  if (!is.null(model)) args$model <- model
  if (!is.null(api_key)) args$api_key <- api_key
  if (!is.null(execution)) args$execution <- execution
  if (!is.null(store_dir)) {
    args$store_dir <- store_dir
    if (!dir.exists(store_dir)) dir.create(store_dir, recursive = TRUE)
  }
  do.call(vw$config, args)
  invisible(vw_options())
}

#' Read the engine's current configuration
#'
#' @return A named list mirroring the Python engine's `Config` object
#'   (`model`, `api_key`, `temperature`, `mode`, `execution`, `retry`, ...).
#' @export
vw_options <- function() {
  cfg <- .vw_config_module()$get_global_config()
  reticulate::py_to_r(cfg[["__dict__"]])
}

# Lazily imports the top-level `vibe_widget` module (as opposed to
# `vibe_widget.hosts.session_api`, which `vw_py()` exposes) - only needed
# for `config()`, the one call that lives on the top-level package rather
# than the host submodule.
.vw_vibe_widget_cache <- new.env(parent = emptyenv())

.vw_vibe_widget <- function() {
  if (is.null(.vw_vibe_widget_cache$mod)) {
    .vw_vibe_widget_cache$mod <- reticulate::import_from_path(
      "vibe_widget",
      path = .vw_python_dir(),
      delay_load = TRUE
    )
  }
  .vw_vibe_widget_cache$mod
}

.vw_config_module <- function() {
  if (is.null(.vw_vibe_widget_cache$config_mod)) {
    # `vibe_widget.config` as a package *attribute* resolves to the
    # re-exported `config()` function (see `vibe_widget/__init__.py`'s
    # `from .config import config, Config`), not the submodule - so
    # `get_global_config()` must be reached by importing the submodule
    # directly instead of via the top-level module object.
    .vw_vibe_widget_cache$config_mod <- reticulate::import_from_path(
      "vibe_widget.config",
      path = .vw_python_dir(),
      delay_load = TRUE
    )
  }
  .vw_vibe_widget_cache$config_mod
}
