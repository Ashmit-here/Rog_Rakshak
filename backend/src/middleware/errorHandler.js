function errorHandler(error, req, res, next) {
  const statusCode =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500

  if (statusCode >= 500) {
    console.error(error)
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  })
}

module.exports = errorHandler