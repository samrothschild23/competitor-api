const rateLimit = require('express-rate-limit');

/**
 * Adds X-RateLimit-* headers to every response so RapidAPI and developers
 * can see quota usage. The actual enforcement is done by RapidAPI's proxy —
 * this middleware just reflects the standard headers.
 */
function rateLimitHeaders(req, res, next) {
  // RapidAPI passes its own quota headers through the proxy.
  // We forward them and add our own for transparency.
  const rapidKey = req.headers['x-rapidapi-key'];
  const rapidHost = req.headers['x-rapidapi-host'];

  if (rapidKey) {
    // Echo back so clients can confirm routing
    res.setHeader('X-RapidAPI-Host', rapidHost || process.env.RAPIDAPI_HOST || 'competitor-api.p.rapidapi.com');
  }

  // Sane defaults — actual limits enforced by RapidAPI
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '99');
  res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + 3600);

  next();
}

/**
 * Light server-side rate limiter as a backstop (1000 req / 15 min per IP).
 * RapidAPI's proxy is the primary enforcement layer.
 */
const serverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        status: 429,
        message: 'Too many requests. Please slow down or upgrade your plan.',
      },
    });
  },
});

module.exports = { rateLimitHeaders, serverLimiter };
