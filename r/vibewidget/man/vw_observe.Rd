\name{vw_observe}
\alias{vw_observe}
\title{Observe a widget output from R}
\usage{
vw_observe(widget, name, callback, poll_interval = 0.15)
}
\arguments{
\item{widget}{A \code{vibewidget} object.}
\item{name}{The trait name to watch - typically a declared output name, but
any synced trait works (e.g. \code{"status"}).}
\item{callback}{A function of one argument, the new value.}
\item{poll_interval}{Seconds between polls while at least one observer is
registered anywhere in this R session.}
}
\value{
The callback, invisibly (pass the same value to \code{\link{vw_unobserve}}
to remove just this one).
}
\description{
Registers \code{callback(value)} to run whenever \code{name} changes on
\code{widget}. Because R is single-threaded, this cannot be a live push
from a background thread - instead, a \code{later}-scheduled loop polls
for queued changes only when R is idle at the console, so a callback can
lag slightly behind the change happening but never blocks or interrupts
whatever R is doing.
}
\examples{
\dontrun{
vw_observe(w, "selection", function(v) message(nrow(v), " rows selected"))
}
}
