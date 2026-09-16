\name{vw_detect_mode}
\alias{vw_detect_mode}
\title{Detect which rendering mode a widget should use}
\usage{
vw_detect_mode()
}
\value{
\code{"live"} or \code{"static"}.
}
\description{
\code{"live"} means a browser page opens a WebSocket back to a Python
\code{HostSession} running in this R process - full round trip, used in the
Positron/RStudio console and in notebooks. \code{"static"} means a
self-contained snapshot with no live connection - used for rendered
Quarto/R Markdown output (there is no R process behind a rendered
document) and for \code{vw_options(mode = "static")}.
}
