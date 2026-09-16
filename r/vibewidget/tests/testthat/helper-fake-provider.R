# Every Python-backed test in this suite uses the deterministic fake
# provider (see `vibe_widget.llm.fake` in the vendored engine) - never the
# network, never an API key. This is a testthat "helper" file, sourced
# automatically before every test file, but *only* when running this
# package's own test suite - it has no effect on normal package use.
Sys.setenv(VIBE_PROVIDER = "fake")
Sys.setenv(VIBE_DISABLE_BUNDLING = "1")

# The Python-backed lane is opt-in (`VIBEWIDGET_TEST_PYTHON=true`) because it
# requires reticulate to actually provision a Python environment (via `uv`),
# which needs network access on a machine that has never run it before and
# can be slow in CI. The pure-R lane (argument normalization, data
# preparation, mode detection, snapshot shaping) always runs regardless.
vw_test_python_enabled <- function() {
  identical(Sys.getenv("VIBEWIDGET_TEST_PYTHON", "true"), "true")
}

# The vendored engine caches generated widget code under `.vibewidget/`
# relative to the current working directory (matching the Python package's
# own behavior). Running the Python-backed lane from the package source
# tree would otherwise litter it with cache files on every test run - move
# the whole test session's cwd to a throwaway temp directory instead.
if (identical(Sys.getenv("VIBEWIDGET_TEST_PYTHON", "true"), "true")) {
  .vw_test_cwd <- tempfile("vibewidget-tests-")
  dir.create(.vw_test_cwd)
  setwd(.vw_test_cwd)
}

skip_unless_python <- function() {
  testthat::skip_if_not(vw_test_python_enabled(), "VIBEWIDGET_TEST_PYTHON=false")
  ready <- tryCatch(
    {
      vw_py() # touching the module proxy forces reticulate to provision Python
      TRUE
    },
    error = function(e) {
      message("Python engine could not be initialized: ", conditionMessage(e))
      FALSE
    }
  )
  testthat::skip_if_not(ready, "Python engine unavailable (no network for uv provisioning?)")
}
