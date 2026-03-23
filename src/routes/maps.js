const express = require('express');
const { runActor } = require('../apify');
const { apiError } = require('../middleware/errors');

const router = express.Router();

/**
 * GET /maps/leads
 *
 * Scored local business leads from Google Maps with outreach hints.
 * Pricing: $0.15 / call
 *
 * The caller must supply their own google_key — it is passed through to the
 * Apify actor and never stored server-side.
 */
router.get('/leads', async (req, res, next) => {
  const { industry, location, google_key } = req.query;
  const min_score = Math.min(100, Math.max(0, parseInt(req.query.min_score, 10) || 60));

  const missing = [];
  if (!industry || !industry.trim()) missing.push('industry');
  if (!location || !location.trim()) missing.push('location');
  if (!google_key || !google_key.trim()) missing.push('google_key');

  if (missing.length) {
    return next(apiError(400, `Missing required query parameter(s): ${missing.join(', ')}`));
  }

  try {
    const items = await runActor('maps', 'find_leads', {
      industry: industry.trim(),
      location: location.trim(),
      min_score,
      google_key: google_key.trim(),
    });

    // Filter by min_score in case the actor returns extras
    const leads = items.filter((l) => (l.score ?? 100) >= min_score);

    res.json({
      success: true,
      data: {
        industry: industry.trim(),
        location: location.trim(),
        min_score,
        leads,
        total: leads.length,
      },
      meta: {
        cached: false,
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
