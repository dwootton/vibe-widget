\name{vw_html}
\alias{vw_html}
\title{Export a widget as a self-contained static HTML document}
\usage{
vw_html(widget, path, max_rows = 500)
}
\arguments{
\item{widget}{A \code{vibewidget} object. Should already be in a terminal
status (\code{widget$wait()} first if it might still be generating).}
\item{path}{Output \code{.html} file path.}
\item{max_rows}{Maximum data rows to embed (default 500).}
}
\value{
\code{path}, invisibly.
}
\description{
Renders identically to the \code{"static"} mode used automatically in
rendered Quarto/R Markdown output: the host JS bundle plus a bounded JSON
snapshot of the widget's current state, with no live connection and no
R/Python process required to view it afterward.
}
