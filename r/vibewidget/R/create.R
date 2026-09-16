#' Create an interactive widget from a plain-English description
#'
#' Generates a self-contained, LLM-authored interactive interface for
#' `data` and renders it inline (in the Positron/RStudio Viewer, a notebook
#' cell, or - for rendered Quarto/R Markdown output, which has no R process
#' behind it - as a static, self-contained snapshot).
#'
#' Generation happens on a background Python thread; `vw_create()` returns
#' immediately (unless `wait = TRUE`) with a widget object whose `$status()`
#' streams from `"generating"` to a terminal status (`"ready"`, `"error"`,
#' or `"blocked"`) as the page reflects each incremental log line and,
#' eventually, the finished widget.
#'
#' @param description Natural-language description of the widget to
#'   generate.
#' @param data A data.frame (or an object coercible to one) to visualize.
#'   Normalized via [vw_prepare_data()] before it crosses into Python.
#' @param outputs Named list of `{name: description}` for widget state that
#'   should be readable back in R (via `widget$outputs$<name>()`), e.g.
#'   `list(selection = "selected rows")`.
#' @param inputs Named list of `{name: initial value}` for state R can push
#'   into the widget (via `widget$inputs$<name> <- value`).
#' @param actions Named list of `{name: description}` for callable
#'   behaviors exposed as `widget$actions$<name>()`.
#' @param theme Optional theme description string.
#' @param model Optional model override for this call; see [vw_config()]
#'   for the process-wide default. Note this is not session-scoped (see
#'   [vw_config()]'s documentation).
#' @param cache If `FALSE`, bypass the on-disk widget cache and always
#'   regenerate.
#' @param wait If `TRUE`, block until generation reaches a terminal status
#'   (with a progress spinner) before returning. Defaults to `TRUE` outside
#'   an interactive session (e.g. `Rscript`, a knitr/Quarto render), where
#'   there is no live page a user could watch stream in, and `FALSE` at an
#'   interactive console/notebook, where the printed widget already streams
#'   progress on its own.
#' @param wait_timeout Timeout in seconds for `wait = TRUE`.
#'
#' @return A `vibewidget` object. Printing it (automatic at the console or
#'   in a notebook cell) renders it via `htmlwidgets`.
#' @export
#' @examples
#' \dontrun{
#' library(vibewidget)
#' w <- vw_create(
#'   "temperature trends by region with a year slider",
#'   weather_df,
#'   outputs = list(selection = "selected rows")
#' )
#' w
#' w$outputs$selection()
#' }
vw_create <- function(description,
                       data = NULL,
                       outputs = NULL,
                       inputs = NULL,
                       actions = NULL,
                       theme = NULL,
                       model = NULL,
                       cache = TRUE,
                       wait = !interactive(),
                       wait_timeout = 120) {
  data <- vw_prepare_data(data)
  session <- vw_py()$create_session(
    description,
    data,
    outputs = .vw_none_if_empty(outputs),
    inputs = .vw_none_if_empty(inputs),
    actions = .vw_none_if_empty(actions),
    theme = theme,
    model = model,
    cache = cache,
    wait = FALSE
  )
  widget <- .vw_new_widget(session)
  if (isTRUE(wait)) {
    .vw_wait_with_progress(widget, timeout = wait_timeout)
  }
  widget
}

#' Revise an existing widget by building on its code
#'
#' Mirrors `vibe_widget.edit(...)` on the Python side: creates a *new*
#' widget by asking the LLM to revise `source`'s code according to
#' `description`, rather than starting from scratch.
#'
#' @param description Natural-language description of the change.
#' @param source A `vibewidget` object, a saved widget id (character), or a
#'   path to a `.vw` bundle.
#' @param data Optional replacement data.frame (defaults to reusing
#'   `source`'s data).
#' @inheritParams vw_create
#' @return A `vibewidget` object.
#' @export
vw_edit <- function(description,
                     source,
                     data = NULL,
                     outputs = NULL,
                     inputs = NULL,
                     actions = NULL,
                     theme = NULL,
                     cache = TRUE,
                     wait = !interactive(),
                     wait_timeout = 120) {
  py_source <- if (inherits(source, "vibewidget")) source$session$bridge$widget else source
  data <- vw_prepare_data(data)
  session <- vw_py()$edit_session(
    py_source,
    description,
    data,
    outputs = .vw_none_if_empty(outputs),
    inputs = .vw_none_if_empty(inputs),
    actions = .vw_none_if_empty(actions),
    theme = theme,
    cache = cache,
    wait = FALSE
  )
  widget <- .vw_new_widget(session)
  if (isTRUE(wait)) {
    .vw_wait_with_progress(widget, timeout = wait_timeout)
  }
  widget
}

#' Load a widget previously saved with `$save()`
#'
#' @param path Path to a `.vw` bundle.
#' @param data Optional replacement data.frame.
#' @param approval If `TRUE` (the default), the loaded code must be
#'   explicitly approved (`widget$approve()`) before it runs - see
#'   `vw_config(execution = "approve")`.
#' @return A `vibewidget` object.
#' @export
vw_load <- function(path, data = NULL, approval = TRUE) {
  data <- vw_prepare_data(data)
  session <- vw_py()$load_session(path, data = data, approval = approval)
  .vw_new_widget(session)
}

#' Export a widget as a self-contained static HTML document
#'
#' Renders identically to the `"static"` mode used automatically in
#' rendered Quarto/R Markdown output: the host JS bundle plus a bounded
#' JSON snapshot of the widget's current state, with no live connection and
#' no R/Python process required to view it afterward.
#'
#' @param widget A `vibewidget` object. Should already be in a terminal
#'   status (`widget$wait()` first if it might still be generating).
#' @param path Output `.html` file path.
#' @param max_rows Maximum data rows to embed (default 500).
#' @return `path`, invisibly.
#' @export
vw_html <- function(widget, path, max_rows = 500) {
  invisible(widget$save_html(path, max_rows = max_rows))
}

#' Save a widget as a portable `.vw` bundle
#'
#' @param widget A `vibewidget` object.
#' @param path Output path (`.vw` suffix is added if missing).
#' @param include_inputs If `TRUE`, embed current input values (including
#'   data) in the bundle so [vw_load()] can reconstruct them without the
#'   caller supplying `data` again.
#' @return The saved path, invisibly.
#' @export
vw_save <- function(widget, path, include_inputs = FALSE) {
  invisible(widget$save(path, include_inputs = include_inputs))
}

.vw_none_if_empty <- function(x) {
  if (is.null(x) || length(x) == 0) NULL else x
}

.vw_wait_with_progress <- function(widget, timeout) {
  has_cli <- requireNamespace("cli", quietly = TRUE)
  spinner <- if (has_cli) cli::cli_status("{cli::symbol$arrow_right} Generating widget...") else NULL
  on.exit({
    if (has_cli && !is.null(spinner)) cli::cli_status_clear(spinner)
  }, add = TRUE)

  status <- widget$wait(timeout = timeout)
  if (identical(status, "error")) {
    msg <- widget$error_message()
    if (has_cli) {
      cli::cli_warn("Widget generation failed: {msg}")
    } else {
      warning("Widget generation failed: ", msg, call. = FALSE)
    }
  } else if (identical(status, "blocked")) {
    if (has_cli) {
      cli::cli_warn("Widget generation blocked after repeated runtime errors; see {.code widget$error_message()}.")
    } else {
      warning("Widget generation blocked after repeated runtime errors.", call. = FALSE)
    }
  }
  invisible(status)
}
