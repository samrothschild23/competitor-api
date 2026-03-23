const express = require('express');
const { runActor } = require('../apify');
const { apiError } = require('../middleware/errors');

const router = express.Router();

/**
 * GET /shopify/analyze
 *
 * Full store intelligence: products, pricing, collections, theme, installed apps.
 * Pricing: $0.10 / call
 */
router.get('/analyze', async (req, res, next) => {
  const { url } = req.query;

  if (!url) {
    return next(apiError(400, 'Missing required query parameter: url'));
  }

  if (!isValidUrl(url)) {
    return next(apiError(400, 'Invalid url. Provide a full URL, e.g. https://example.myshopify.com'));
  }

  try {
    const items = await runActor('shopify', 'analyze_store', { url });

    const result = items[0] || {};

    res.json({
      success: true,
      data: {
        url,
        store: result.store || null,
        products: result.products || [],
        collections: result.collections || [],
        pricing: result.pricing || null,
        theme: result.theme || null,
        apps: result.apps || [],
        meta: result.meta || {},
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
 * GET /shopify/products
 *
 * Paginated product catalog for a Shopify store.
 * Pricing: $0.03 / call
 */
router.get('/products', async (req, res, next) => {
  const { url } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

  if (!url) {
    return next(apiError(400, 'Missing required query parameter: url'));
  }

  if (!isValidUrl(url)) {
    return next(apiError(400, 'Invalid url. Provide a full URL, e.g. https://example.myshopify.com'));
  }

  try {
    const items = await runActor('shopify', 'get_products', { url, page, limit });

    const products = Array.isArray(items) ? items : (items[0]?.products || []);
    const total = items[0]?.total ?? products.length;

    res.json({
      success: true,
      data: {
        url,
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          has_next: page * limit < total,
        },
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

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = router;
