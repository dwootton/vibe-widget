# Constructs the R-facing widget object around a Python `Session` (see
# `vibe_widget.hosts.session_api.Session`). Not exported: callers get one
# back from `vw_create()`/`vw_edit()`/`vw_load()`.
.vw_new_widget <- function(session) {
  self <- new.env(parent = emptyenv())
  self$session <- session
  self$outputs <- .vw_make_output_namespace(session)
  self$inputs <- .vw_make_input_namespace(session)
  self$actions <- .vw_make_action_namespace(session)

  self$status <- function() session$status()
  self$code <- function() session$code()
  self$error_message <- function() session$error_message()
  self$is_terminal <- function() isTRUE(session$is_terminal())

  self$wait <- function(timeout = 120) {
    invisible(session$wait(timeout = timeout))
  }

  self$edit <- function(prompt, timeout = 120) {
    invisible(session$edit(prompt, timeout = timeout))
  }

  self$approve <- function() invisible(session$approve())

  self$save <- function(path, include_inputs = FALSE) {
    invisible(session$save(path, include_inputs = include_inputs))
  }

  self$save_html <- function(path, max_rows = 500, inline_bundle = TRUE) {
    invisible(session$save_html(path, max_rows = as.integer(max_rows), inline_bundle = inline_bundle))
  }

  self$snapshot <- function() reticulate::py_to_r(session$snapshot())

  self$close <- function(reason = "closed") invisible(session$close(reason))

  class(self) <- "vibewidget"
  self
}

.vw_make_output_namespace <- function(session) {
  ns <- new.env(parent = emptyenv())
  for (name in reticulate::py_to_r(session$output_names())) {
    local({
      output_name <- name
      makeActiveBinding(
        output_name,
        function(value) {
          if (!missing(value)) {
            stop("outputs are read-only; did you mean inputs$", output_name, "?", call. = FALSE)
          }
          reticulate::py_to_r(session$get_output(output_name))
        },
        ns
      )
    })
  }
  ns
}

.vw_make_input_namespace <- function(session) {
  ns <- new.env(parent = emptyenv())
  for (name in reticulate::py_to_r(session$input_names())) {
    local({
      input_name <- name
      makeActiveBinding(
        input_name,
        function(value) {
          if (missing(value)) {
            return(reticulate::py_to_r(session$get_input(input_name)))
          }
          session$set_input(input_name, value)
          invisible(value)
        },
        ns
      )
    })
  }
  ns
}

.vw_make_action_namespace <- function(session) {
  ns <- new.env(parent = emptyenv())
  for (name in reticulate::py_to_r(session$action_names())) {
    local({
      action_name <- name
      assign(
        action_name,
        function(...) invisible(session$invoke_action(action_name, list(...))),
        envir = ns
      )
    })
  }
  ns
}

#' @export
print.vibewidget <- function(x, ...) {
  print(.vw_as_htmlwidget(x))
  invisible(x)
}

#' @export
format.vibewidget <- function(x, ...) {
  sprintf("<vibewidget> status: %s", x$status())
}
