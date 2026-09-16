\name{vw_save}
\alias{vw_save}
\title{Save a widget as a portable \code{.vw} bundle}
\usage{
vw_save(widget, path, include_inputs = FALSE)
}
\arguments{
\item{widget}{A \code{vibewidget} object.}
\item{path}{Output path (\code{.vw} suffix is added if missing).}
\item{include_inputs}{If \code{TRUE}, embed current input values (including
data) in the bundle so \code{\link{vw_load}} can reconstruct them without
the caller supplying \code{data} again.}
}
\value{
The saved path, invisibly.
}
\description{
Save a widget as a portable \code{.vw} bundle.
}
