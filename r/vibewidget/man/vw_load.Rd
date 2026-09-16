\name{vw_load}
\alias{vw_load}
\title{Load a widget previously saved with \code{$save()}}
\usage{
vw_load(path, data = NULL, approval = TRUE)
}
\arguments{
\item{path}{Path to a \code{.vw} bundle.}
\item{data}{Optional replacement data.frame.}
\item{approval}{If \code{TRUE} (the default), the loaded code must be
explicitly approved (\code{widget$approve()}) before it runs - see
\code{vw_config(execution = "approve")}.}
}
\value{
A \code{vibewidget} object.
}
\description{
Load a widget previously saved with \code{$save()}.
}
