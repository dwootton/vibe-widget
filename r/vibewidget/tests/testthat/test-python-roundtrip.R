test_that("vw_create generates against the fake provider and reaches ready", {
  skip_unless_python()
  df <- data.frame(x = 1:3, y = 4:6)
  w <- vw_create(
    "scatter of x vs y", df,
    outputs = list(selection = "selected rows"),
    inputs = list(threshold = 10),
    actions = list(reset = "clear selection"),
    cache = FALSE, wait = TRUE, wait_timeout = 20
  )
  on.exit(w$close(), add = TRUE)

  expect_identical(w$status(), "ready")
  expect_true(nzchar(w$code()))
  expect_true(w$is_terminal())
})

test_that("outputs, inputs, and actions round-trip through the widget", {
  skip_unless_python()
  df <- data.frame(x = 1:3, y = 4:6)
  w <- vw_create(
    "t", df,
    outputs = list(selection = "s"),
    inputs = list(threshold = 10),
    actions = list(reset = "r"),
    cache = FALSE, wait = TRUE, wait_timeout = 20
  )
  on.exit(w$close(), add = TRUE)

  expect_null(w$outputs$selection)

  w$inputs$threshold <- 42
  expect_equal(w$inputs$threshold, 42)

  expect_error(w$outputs$selection <- 1, "read-only")

  w$actions$reset()
  # No observable R-side effect from `reset` itself; this only asserts the
  # call does not error - see the Python-side test suite for the underlying
  # `action_event` trait assertion.
  expect_true(TRUE)
})

test_that("vw_observe delivers a changed input via the later-scheduled loop", {
  skip_unless_python()
  df <- data.frame(x = 1:3, y = 4:6)
  w <- vw_create("t", df, inputs = list(threshold = 1), cache = FALSE, wait = TRUE, wait_timeout = 20)
  on.exit(w$close(), add = TRUE)

  seen <- NULL
  vw_observe(w, "threshold", function(v) seen <<- v)
  w$inputs$threshold <- 7

  deadline <- Sys.time() + 5
  while (is.null(seen) && Sys.time() < deadline) {
    later::run_now(0.2)
    Sys.sleep(0.05)
  }
  expect_equal(seen, 7)
  vw_unobserve(w, "threshold")
})

test_that("vw_edit reruns generation and returns to a terminal status", {
  skip_unless_python()
  df <- data.frame(x = 1:3, y = 4:6)
  w <- vw_create("t", df, cache = FALSE, wait = TRUE, wait_timeout = 20)
  on.exit(w$close(), add = TRUE)

  code_before <- w$code()
  w$edit("make it bigger", timeout = 20)
  expect_true(w$is_terminal())
  expect_true(nzchar(code_before))
})

test_that("vw_save writes a .vw bundle and vw_html writes a static document", {
  skip_unless_python()
  df <- data.frame(x = 1:3, y = 4:6)
  w <- vw_create("t", df, cache = FALSE, wait = TRUE, wait_timeout = 20)
  on.exit(w$close(), add = TRUE)

  vw_path <- withr::local_tempfile(fileext = ".vw")
  vw_save(w, vw_path)
  expect_true(file.exists(vw_path))

  html_path <- withr::local_tempfile(fileext = ".html")
  vw_html(w, html_path)
  content <- readLines(html_path, warn = FALSE)
  expect_true(any(grepl("VibeWidgetHost.mount", content, fixed = TRUE)))
})

test_that("vw_options reflects vw_config", {
  skip_unless_python()
  vw_config(execution = "auto")
  opts <- vw_options()
  expect_identical(opts$execution, "auto")
})

test_that("static-mode htmlwidget rendering excludes the multi-megabyte bundle trait", {
  skip_unless_python()
  df <- data.frame(x = 1:3, y = 4:6)
  w <- vw_create("t", df, cache = FALSE, wait = TRUE, wait_timeout = 20)
  on.exit(w$close(), add = TRUE)

  hw <- vibewidget:::.vw_as_htmlwidget(w, mode = "static")
  expect_s3_class(hw, "htmlwidget")
  expect_identical(hw$x$mode, "static")
  expect_null(hw$x$snapshot[["_esm"]])
  expect_false(is.null(hw$x$snapshot$data))
})

test_that("live-mode htmlwidget rendering registers with the shared local server", {
  skip_unless_python()
  df <- data.frame(x = 1:3, y = 4:6)
  w <- vw_create("t", df, cache = FALSE, wait = TRUE, wait_timeout = 20)
  on.exit(w$close(), add = TRUE)

  hw <- vibewidget:::.vw_as_htmlwidget(w, mode = "live")
  expect_identical(hw$x$mode, "live")
  expect_match(hw$x$wsUrl, "^ws://127\\.0\\.0\\.1:")
  expect_identical(hw$x$sessionId, w$session$id)
  expect_true(nzchar(hw$x$token))
})
