/**
 * Centralized error handler middleware.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  // Log server errors
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}:`, err.stack || err);
  }

  res.status(status).json({
    success: false,
    error: {
      status,
      message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}

/**
 * Creates a standard API error.
 */
function apiError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

module.exports = { errorHandler, apiError };
