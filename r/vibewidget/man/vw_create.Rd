% Hand-written (see NAMESPACE for why roxygen2 could not be run in this
% sandbox). Source of truth is the roxygen comment above `vw_create()` in
% R/create.R; keep both in sync if you edit this by hand, or regenerate
% both from R/create.R with `devtools::document()` once roxygen2 is usable.
\name{vw_create}
\alias{vw_create}
\title{Create an interactive widget from a plain-English description}
\usage{
vw_create(description, data = NULL, outputs = NULL, inputs = NULL,
  actions = NULL, theme = NULL, model = NULL, cache = TRUE,
  wait = !interactive(), wait_timeout = 120)
}
\arguments{
\item{description}{Natural-language description of the widget to generate.}
\item{data}{A data.frame (or an object coercible to one) to visualize.
Normalized via \code{\link{vw_prepare_data}} before it crosses into Python.}
\item{outputs}{Named list of \verb{name: description} for widget state that
should be readable back in R (via \code{widget$outputs$name()}), e.g.
\code{list(selection = "selected rows")}.}
\item{inputs}{Named list of \verb{name: initial value} for state R can push into
the widget (via \code{widget$inputs$name <- value}).}
\item{actions}{Named list of \verb{name: description} for callable behaviors
exposed as \code{widget$actions$name()}.}
\item{theme}{Optional theme description string.}
\item{model}{Optional model override for this call; see
\code{\link{vw_config}} for the process-wide default. Not session-scoped.}
\item{cache}{If \code{FALSE}, bypass the on-disk widget cache and always
regenerate.}
\item{wait}{If \code{TRUE}, block until generation reaches a terminal status
(with a progress spinner) before returning. Defaults to \code{TRUE} outside
an interactive session and \code{FALSE} at an interactive console/notebook.}
\item{wait_timeout}{Timeout in seconds for \code{wait = TRUE}.}
}
\value{
A \code{vibewidget} object. Printing it (automatic at the console or in a
notebook cell) renders it via \pkg{htmlwidgets}.
}
\description{
Generates a self-contained, LLM-authored interactive interface for
\code{data} and renders it inline (in the Positron/RStudio Viewer, a
notebook cell, or - for rendered Quarto/R Markdown output, which has no R
process behind it - as a static, self-contained snapshot). Generation
happens on a background Python thread; \code{vw_create()} returns
immediately (unless \code{wait = TRUE}) with a widget object whose
\code{$status()} streams from \code{"generating"} to a terminal status.
}
\examples{
\dontrun{
library(vibewidget)
w <- vw_create(
  "temperature trends by region with a year slider",
  weather_df,
  outputs = list(selection = "selected rows")
)
w
w$outputs$selection()
}
}
