% Hand-written - see man/vw_create.Rd for why, and R/create.R for the
% authoritative roxygen source comment.
\name{vw_edit}
\alias{vw_edit}
\title{Revise an existing widget by building on its code}
\usage{
vw_edit(description, source, data = NULL, outputs = NULL, inputs = NULL,
  actions = NULL, theme = NULL, cache = TRUE, wait = !interactive(),
  wait_timeout = 120)
}
\arguments{
\item{description}{Natural-language description of the change.}
\item{source}{A \code{vibewidget} object, a saved widget id (character), or a
path to a \code{.vw} bundle.}
\item{data}{Optional replacement data.frame (defaults to reusing
\code{source}'s data).}
\item{outputs}{See \code{\link{vw_create}}.}
\item{inputs}{See \code{\link{vw_create}}.}
\item{actions}{See \code{\link{vw_create}}.}
\item{theme}{See \code{\link{vw_create}}.}
\item{cache}{See \code{\link{vw_create}}.}
\item{wait}{See \code{\link{vw_create}}.}
\item{wait_timeout}{See \code{\link{vw_create}}.}
}
\value{
A \code{vibewidget} object.
}
\description{
Mirrors \code{vibe_widget.edit(...)} on the Python side: creates a new
widget by asking the LLM to revise \code{source}'s code according to
\code{description}, rather than starting from scratch.
}
