\name{vw_config}
\alias{vw_config}
\title{Configure the Vibe Widget engine}
\usage{
vw_config(model = NULL, api_key = NULL, execution = NULL,
  store_dir = NULL, ...)
}
\arguments{
\item{model}{Optional model identifier/shortcut (e.g.
\code{"google/gemini-3.1-pro-preview"}).}
\item{api_key}{Optional API key. Defaults to the \code{OPENROUTER_API_KEY}
environment variable when not set here.}
\item{execution}{One of \code{"auto"} (generated code runs immediately) or
\code{"approve"} (code must be explicitly approved before it runs).}
\item{store_dir}{Optional directory for the widget cache (\code{.vibewidget/}
by default under the current working directory).}
\item{...}{Additional keyword arguments forwarded to
\code{vibe_widget.config()} (see the Python package's documentation).}
}
\value{
Invisibly, a list describing the current configuration.
}
\description{
Sets process-wide generation options (which model to use, the API key,
the widget cache directory). Mirrors \code{vibe_widget.config(...)} on the
Python side; like that function, these settings are process-global, not
per-session.
}
\examples{
\dontrun{
vw_config(model = "google/gemini-3.1-pro-preview")
}
}
