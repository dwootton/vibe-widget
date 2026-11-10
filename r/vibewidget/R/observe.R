# Registry: session id -> trait name -> list(callback). Backed by a single
# shared `later`-scheduled poll loop rather than one loop per observer, so
# registering many observers does not multiply the number of background
# callbacks competing for R's idle time.
.vw_observer_state <- new.env(parent = emptyenv())
.vw_observer_state$registry <- list()
.vw_observer_state$sessions <- list()
.vw_observer_state$running <- FALSE

#' Observe a widget output from R
#'
#' Registers `callback(value)` to run whenever `name` changes on `widget`.
#' Because R is single-threaded, this cannot be a live push from a
#' background thread the way a callback in, say, JavaScript would be -
#' instead, a `later`-scheduled loop polls for queued changes only when R is
#' idle at the console (or, in a script, at the next explicit
#' `later::run_now()`/event-loop tick). This means a callback can lag
#' slightly behind the change happening, but it never blocks or interrupts
#' whatever R is doing.
#'
#' @param widget A `vibewidget` object.
#' @param name The trait name to watch - typically a declared output name,
#'   but any synced trait works (e.g. `"status"`).
#' @param callback A function of one argument, the new value.
#' @param poll_interval Seconds between polls while at least one observer is
#'   registered anywhere in this R session.
#' @return The callback, invisibly (pass the same value to
#'   [vw_unobserve()] to remove just this one).
#' @export
#' @examples
#' \dontrun{
#' vw_observe(w, "selection", function(v) message(nrow(v), " rows selected"))
#' }
vw_observe <- function(widget, name, callback, poll_interval = 0.15) {
  stopifnot(is.function(callback))
  session <- widget$session
  session_id <- session$id

  reg <- .vw_observer_state$registry[[session_id]]
  if (is.null(reg)) reg <- list()
  cbs <- reg[[name]]
  if (is.null(cbs)) cbs <- list()
  cbs[[length(cbs) + 1L]] <- callback
  reg[[name]] <- cbs
  .vw_observer_state$registry[[session_id]] <- reg
  .vw_observer_state$sessions[[session_id]] <- session

  .vw_start_observer_loop(poll_interval)
  invisible(callback)
}

#' Stop observing a widget
#'
#' @param widget A `vibewidget` object.
#' @param name Trait name to stop observing. If omitted, removes every
#'   observer registered for this widget.
#' @param callback If given, remove only this specific callback (compared
#'   with `identical()`); otherwise remove every callback for `name`.
#' @return `NULL`, invisibly.
#' @export
vw_unobserve <- function(widget, name = NULL, callback = NULL) {
  session_id <- widget$session$id
  reg <- .vw_observer_state$registry[[session_id]]
  if (is.null(reg)) {
    return(invisible(NULL))
  }
  if (is.null(name)) {
    reg <- list()
  } else if (is.null(callback)) {
    reg[[name]] <- NULL
  } else {
    cbs <- reg[[name]]
    keep <- vapply(cbs, function(cb) !identical(cb, callback), logical(1))
    reg[[name]] <- cbs[keep]
    if (length(reg[[name]]) == 0) reg[[name]] <- NULL
  }
  .vw_observer_state$registry[[session_id]] <- reg
  invisible(NULL)
}

.vw_start_observer_loop <- function(poll_interval) {
  if (isTRUE(.vw_observer_state$running)) {
    return(invisible(NULL))
  }
  .vw_observer_state$running <- TRUE
  .vw_poll_once(poll_interval)
}

.vw_poll_once <- function(poll_interval) {
  any_registered <- FALSE
  for (session_id in names(.vw_observer_state$registry)) {
    reg <- .vw_observer_state$registry[[session_id]]
    if (length(reg) == 0) next
    any_registered <- TRUE
    session <- .vw_observer_state$sessions[[session_id]]

    events <- tryCatch(
      reticulate::py_to_r(session$drain_events(block = FALSE)),
      error = function(e) list()
    )
    for (event in events) {
      if (!identical(event$kind, "patch")) next
      changes <- event$changes
      for (trait_name in names(reg)) {
        if (!(trait_name %in% names(changes))) next
        value <- changes[[trait_name]]
        for (cb in reg[[trait_name]]) {
          tryCatch(
            cb(value),
            error = function(e) {
              warning(
                "vw_observe() callback for '", trait_name, "' raised an error: ",
                conditionMessage(e), call. = FALSE
              )
            }
          )
        }
      }
    }
  }

  if (any_registered) {
    later::later(function() .vw_poll_once(poll_interval), delay = poll_interval)
  } else {
    .vw_observer_state$running <- FALSE
  }
}
