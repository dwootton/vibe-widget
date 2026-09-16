test_that("Date columns become ISO 8601 strings", {
  df <- data.frame(d = as.Date(c("2026-01-01", "2026-06-15")))
  out <- vw_prepare_data(df)
  expect_identical(out$d, c("2026-01-01", "2026-06-15"))
})

test_that("POSIXct columns become ISO 8601 strings", {
  df <- data.frame(t = as.POSIXct("2026-01-01 12:30:00", tz = "UTC"))
  out <- vw_prepare_data(df)
  expect_match(out$t, "^2026-01-01T12:30:00")
})

test_that("factor columns become character labels, not integer codes", {
  df <- data.frame(g = factor(c("b", "a", "b"), levels = c("a", "b")))
  out <- vw_prepare_data(df)
  expect_identical(out$g, c("b", "a", "b"))
  expect_true(is.character(out$g))
})

test_that("difftime columns become numeric seconds", {
  df <- data.frame(dt = as.difftime(c(1, 2), units = "hours"))
  out <- vw_prepare_data(df)
  expect_equal(out$dt, c(3600, 7200))
})

test_that("plain numeric/character/logical columns pass through unchanged", {
  df <- data.frame(n = c(1L, 2L), s = c("a", "b"), b = c(TRUE, FALSE))
  out <- vw_prepare_data(df)
  expect_identical(out$n, df$n)
  expect_identical(out$s, df$s)
  expect_identical(out$b, df$b)
})

test_that("list-columns are rejected with a clear error, not mis-serialized", {
  df <- data.frame(x = 1:2)
  df$listcol <- list(1:2, 3:4)
  expect_error(vw_prepare_data(df), "list-column")
})

test_that("NULL data passes through as NULL", {
  expect_null(vw_prepare_data(NULL))
})

test_that("a tibble-like object (data.frame subclass) is coerced to a plain data.frame", {
  tbl_like <- data.frame(x = 1:3, y = 4:6)
  class(tbl_like) <- c("tbl_df", "tbl", "data.frame")
  out <- vw_prepare_data(tbl_like)
  expect_identical(class(out), "data.frame")
  expect_identical(out$x, 1:3)
})
