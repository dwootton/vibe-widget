\name{vw_unobserve}
\alias{vw_unobserve}
\title{Stop observing a widget}
\usage{
vw_unobserve(widget, name = NULL, callback = NULL)
}
\arguments{
\item{widget}{A \code{vibewidget} object.}
\item{name}{Trait name to stop observing. If omitted, removes every
observer registered for this widget.}
\item{callback}{If given, remove only this specific callback (compared with
\code{identical()}); otherwise remove every callback for \code{name}.}
}
\value{
\code{NULL}, invisibly.
}
\description{
Stop observing a widget.
}
