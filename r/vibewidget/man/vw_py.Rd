\name{vw_py}
\alias{vw_py}
\title{Access the vendored Python engine directly}
\usage{
vw_py()
}
\value{
A reticulate Python module proxy for
\code{vibe_widget.hosts.session_api}.
}
\description{
Every exported R function in this package is a thin wrapper around a call
on this object; this accessor exists for advanced use (introspection,
calling something this package does not yet wrap) and is what actually
triggers Python initialization on first access.
}
