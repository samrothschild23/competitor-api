const express = require('express');
const { runActor } = require('../apify');
const { apiError } = require('../middleware/errors');

const router = express.Router();

const VALID_MARKETPLACES = ['US', 'UK', 'DE', 'FR', 'CA', 'JP', 'AU', 'IN', 'MX', 'IT', 'ES'];

/**
 * GET /amazon/search
 *
 * Keyword search with Opportunity Score for each result.
 * Pricing: $0.08 / call
 */
router.get('/search', async (req, res, next) => {
  const { keyword } = req.query;
  const marketplace = (req.query.marketplace || 'US').toUpperCase();

  if (!keyword || !keyword.trim()) {
    return next(apiError(400, 'Missing required query parameter: keyword'));
  }

  if (!VALID_MARKETPLACES.includes(marketplace)) {
    return next(
      apiError(400, `Invalid marketplace. Supported values: ${VALID_MARKETPLACES.join(', ')}`)
    );
  }

  try {
    const items = await runActor('amazon', 'search_products', {
      keyword: keyword.trim(),
      marketplace,
    });

    res.json({
      success: true,
      data: {
        keyword: keyword.trim(),
        marketplace,
        results: items,
        total: items.length,
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

/**
 * GET /amazon/product
 *
 * Full product analysis for a given ASIN including FBA cost estimate.
 * Pricing: $0.10 / call
 */
router.get('/product', async (req, res, next) => {
  const { asin } = req.query;
  const marketplace = (req.query.marketplace || 'US').toUpperCase();

  if (!asin || !asin.trim()) {
    return next(apiError(400, 'Missing required query parameter: asin'));
  }

  if (!/^[A-Z0-9]{10}$/.test(asin.trim().toUpperCase())) {
    return next(apiError(400, 'Invalid ASIN. Must be exactly 10 alphanumeric characters (e.g. B08N5WRWNW)'));
  }

  if (marketplace && !VALID_MARKETPLACES.includes(marketplace)) {
    return next(
      apiError(400, `Invalid marketplace. Supported values: ${VALID_MARKETPLACES.join(', ')}`)
    );
  }

  try {
    const items = await runActor('amazon', 'analyze_product', {
      asin: asin.trim().toUpperCase(),
      marketplace,
    });

    const product = items[0] || null;

    if (!product) {
      return next(apiError(404, `No product found for ASIN ${asin} in marketplace ${marketplace}`));
    }

    res.json({
      success: true,
      data: product,
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
