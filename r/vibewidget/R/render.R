.vw_server_cache <- new.env(parent = emptyenv())

# One `LocalHostServer` per R process, lazily started and reused across
# every widget - mirrors `vibe_widget.hosts.server.get_shared_server()`, so
# opening many widgets in one session does not open a socket per widget.
.vw_shared_server <- function() {
  if (is.null(.vw_server_cache$server)) {
    server_mod <- reticulate::import_from_path(
      "vibe_widget.hosts.server",
      path = .vw_python_dir(),
      delay_load = TRUE
    )
    .vw_server_cache$server <- server_mod$get_shared_server()
  }
  .vw_server_cache$server
}

#' Detect which rendering mode a widget should use
#'
#' `"live"` means a browser page opens a WebSocket back to a Python
#' `HostSession` running in this R process - full round trip, used in the
#' Positron/RStudio console and in notebooks. `"static"` means a
#' self-contained snapshot with no live connection - used for rendered
#' Quarto/R Markdown output (there is no R process behind a rendered
#' document) and for `vw_options(mode = "static")`.
#'
#' @return `"live"` or `"static"`.
#' @export
vw_detect_mode <- function() {
  forced <- getOption("vibewidget.mode")
  if (!is.null(forced)) {
    return(match.arg(forced, c("live", "static")))
  }
  in_knitr <- isTRUE(getOption("knitr.in.progress")) ||
    identical(Sys.getenv("QUARTO_RENDER"), "1") ||
    (requireNamespace("knitr", quietly = TRUE) && isTRUE(knitr::is_html_output()) && !interactive())
  if (in_knitr || !interactive()) {
    return("static")
  }
  "live"
}

.vw_as_htmlwidget <- function(widget, mode = NULL) {
  session <- widget$session
  mode <- mode %||% vw_detect_mode()

  if (identical(mode, "live")) {
    server <- .vw_shared_server()
    token <- .vw_ensure_registered(server, session)
    x <- list(
      mode = "live",
      wsUrl = server$ws_url,
      sessionId = session$id,
      token = token
    )
  } else {
    x <- list(mode = "static", snapshot = .vw_row_guarded_snapshot(session))
  }

  htmlwidgets::createWidget(
    # Two distinct widget names/bindings, not one branching on `x$mode`:
    # `vibewidget` (static) declares the host bundle as a package
    # htmlDependency, appropriate for a self-contained document;
    # `vibewidget_live` carries no such dependency and fetches the bundle
    # from the local server itself instead - see vibewidget_live.yaml for
    # why (Positron's ark kernel re-inlines file dependencies into every
    # separate Viewer/notebook-cell render rather than deduplicating them
    # the way one knitr/Quarto document build does).
    name = if (identical(mode, "live")) "vibewidget_live" else "vibewidget",
    x = x,
    package = "vibewidget",
    sizingPolicy = htmlwidgets::sizingPolicy(
      viewer.fill = TRUE,
      viewer.padding = 10,
      browser.fill = TRUE,
      knitr.figure = FALSE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = "480px"
    )
  )
}

# `register()` is safe to call more than once conceptually (it just
# re-associates a session id with a token), but re-registering on every
# print() would mint a fresh token and invalidate any page still open from a
# previous print() of the same widget - so registration state is tracked
# per Python `Session` object (via its stable `$id`) and only ever done
# once per widget.
.vw_registered_ids <- new.env(parent = emptyenv())

.vw_ensure_registered <- function(server, session) {
  id <- session$id
  existing <- .vw_registered_ids[[id]]
  if (!is.null(existing)) {
    return(existing)
  }
  token <- server$register(session$bridge, session_id = id)
  .vw_registered_ids[[id]] <- token
  token
}

.vw_row_guarded_snapshot <- function(session, max_rows = 500L) {
  snapshot <- reticulate::py_to_r(session$snapshot())
  data <- snapshot$data
  if (is.list(data) && length(data) > max_rows) {
    snapshot$data <- utils::head(data, max_rows)
    snapshot$`_vibewidget_truncated` <- list(original_rows = length(data), shown_rows = max_rows)
  }
  snapshot
}

`%||%` <- function(a, b) if (is.null(a)) b else a

#' Open a widget's live page in the system browser or IDE viewer
#'
#' Most of the time you do not need this - printing a widget (which happens
#' automatically at the console, or via `print()`/auto-print in a notebook
#' cell) already renders it inline via `htmlwidgets`. This is for opening
#' the same live session in a separate window/tab, e.g. to keep a widget
#' visible while working in the console.
#'
#' @param widget A widget from `vw_create()`/`vw_edit()`/`vw_load()`.
#' @export
vw_open <- function(widget) {
  session <- widget$session
  server <- .vw_shared_server()
  token <- .vw_ensure_registered(server, session)
  url <- server$page_url(session$id)
  viewer <- getOption("viewer", utils::browseURL)
  viewer(url)
  invisible(url)
}
