\name{vw_open}
\alias{vw_open}
\title{Open a widget's live page in the system browser or IDE viewer}
\usage{
vw_open(widget)
}
\arguments{
\item{widget}{A widget from \code{vw_create()}/\code{vw_edit()}/\code{vw_load()}.}
}
\value{
The page URL, invisibly.
}
\description{
Most of the time you do not need this - printing a widget (which happens
automatically at the console, or via \code{print()}/auto-print in a
notebook cell) already renders it inline via \pkg{htmlwidgets}. This is for
opening the same live session in a separate window/tab.
}
