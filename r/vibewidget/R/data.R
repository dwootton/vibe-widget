#' Normalize a data.frame before it crosses into Python
#'
#' `reticulate` converts a `data.frame` to a `pandas.DataFrame`
#' automatically, but several common R column types need to be normalized
#' first for the result to be something the engine (and, downstream, the
#' generated JavaScript) can actually use sensibly:
#'
#' - `Date`/`POSIXct` become ISO 8601 strings (rather than reticulate's
#'   default numeric day/second counts, which the engine's data summarizer
#'   and any generated code would otherwise see as plain numbers).
#' - `factor` becomes its character labels (reticulate's default pandas
#'   `Categorical` conversion is fine internally, but the generated frontend
#'   code deals in the row-record JSON, where R's underlying integer codes
#'   would otherwise leak through).
#' - `difftime` becomes a plain numeric count of seconds.
#' - list-columns are rejected outright (see below) rather than silently
#'   mis-serialized.
#'
#' @param df A data.frame (or an object coercible to one, e.g. a tibble).
#' @return A plain `data.frame` safe to pass to `vw_create()`/`vw_edit()`.
#' @export
vw_prepare_data <- function(df) {
  if (is.null(df)) {
    return(df)
  }
  df <- as.data.frame(df, stringsAsFactors = FALSE)

  list_cols <- vapply(df, is.list, logical(1))
  if (any(list_cols)) {
    stop(
      "vw_prepare_data(): column(s) ",
      paste(shQuote(names(df)[list_cols]), collapse = ", "),
      " are list-columns, which have no well-defined row-record JSON ",
      "representation. Unnest or drop them before calling vw_create().",
      call. = FALSE
    )
  }

  for (name in names(df)) {
    col <- df[[name]]
    df[[name]] <- .vw_normalize_column(col)
  }
  df
}

.vw_normalize_column <- function(col) {
  if (inherits(col, "POSIXct") || inherits(col, "POSIXt")) {
    return(format(col, "%Y-%m-%dT%H:%M:%OS3%z"))
  }
  if (inherits(col, "Date")) {
    return(format(col, "%Y-%m-%d"))
  }
  if (inherits(col, "difftime")) {
    return(as.numeric(col, units = "secs"))
  }
  if (is.factor(col)) {
    return(as.character(col))
  }
  if (inherits(col, "integer64")) {
    # bit64::integer64 has no pandas-native equivalent reticulate handles by
    # default; stringify rather than silently truncating to double
    # precision (a real risk above 2^53).
    return(format(col, scientific = FALSE))
  }
  col
}
