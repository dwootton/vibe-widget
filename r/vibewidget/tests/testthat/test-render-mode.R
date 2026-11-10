test_that("an explicit vibewidget.mode option always wins", {
  withr::local_options(vibewidget.mode = "static")
  expect_identical(vw_detect_mode(), "static")

  withr::local_options(vibewidget.mode = "live")
  expect_identical(vw_detect_mode(), "live")
})

test_that("a non-interactive session (e.g. Rscript, a knitr render) defaults to static", {
  withr::local_options(vibewidget.mode = NULL)
  # `interactive()` cannot be forced from R code; this package's own test
  # suite always runs non-interactively, so the plain default already
  # exercises that branch.
  skip_if(interactive(), "this test asserts the non-interactive default")
  expect_identical(vw_detect_mode(), "static")
})

test_that("knitr.in.progress forces static mode even if somehow interactive", {
  withr::local_options(vibewidget.mode = NULL, knitr.in.progress = TRUE)
  expect_identical(vw_detect_mode(), "static")
})

test_that(".vw_row_guarded_snapshot truncates large data and records how much", {
  fake_session <- list(
    snapshot = function() {
      list(status = "ready", data = as.list(seq_len(1000)))
    }
  )
  out <- .vw_row_guarded_snapshot(fake_session, max_rows = 10L)
  expect_length(out$data, 10)
  expect_equal(out$`_vibewidget_truncated`$original_rows, 1000)
  expect_equal(out$`_vibewidget_truncated`$shown_rows, 10)
})

test_that(".vw_row_guarded_snapshot leaves small data untouched", {
  fake_session <- list(
    snapshot = function() list(status = "ready", data = list(1, 2, 3))
  )
  out <- .vw_row_guarded_snapshot(fake_session, max_rows = 500L)
  expect_length(out$data, 3)
  expect_null(out$`_vibewidget_truncated`)
})
