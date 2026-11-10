\name{vw_prepare_data}
\alias{vw_prepare_data}
\title{Normalize a data.frame before it crosses into Python}
\usage{
vw_prepare_data(df)
}
\arguments{
\item{df}{A data.frame (or an object coercible to one, e.g. a tibble).}
}
\value{
A plain \code{data.frame} safe to pass to \code{vw_create()}/\code{vw_edit()}.
}
\description{
\pkg{reticulate} converts a \code{data.frame} to a \code{pandas.DataFrame}
automatically, but several common R column types need to be normalized
first for the result to be something the engine (and, downstream, the
generated JavaScript) can actually use sensibly:
\itemize{
\item \code{Date}/\code{POSIXct} become ISO 8601 strings.
\item \code{factor} becomes its character labels.
\item \code{difftime} becomes a plain numeric count of seconds.
\item list-columns are rejected outright rather than silently mis-serialized.
}
}
