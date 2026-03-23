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
        intelligence: computeShopifyIntelligence(result),
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

    const rawProducts = Array.isArray(items) ? items : (items[0]?.products || []);
    const total = items[0]?.total ?? rawProducts.length;
    const products = rawProducts.map(enrichProduct);

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

// ---------------------------------------------------------------------------
// Intelligence helpers
// ---------------------------------------------------------------------------

const SUBSCRIPTION_APPS = ['recharge', 'bold subscriptions', 'ordergroove', 'skio', 'smartrr'];
const REVIEW_APPS = ['yotpo', 'okendo', 'stamped', 'judge.me', 'loox', 'reviews.io'];
const EMAIL_APPS = ['klaviyo', 'omnisend', 'drip', 'mailchimp', 'privy', 'postscript'];

function computeShopifyIntelligence(result) {
  const apps = result.apps || [];
  const products = result.products || [];
  const pricing = result.pricing || {};

  const appNames = apps
    .map((a) => (typeof a === 'string' ? a : a.name || a.title || ''))
    .filter(Boolean);
  const appNamesLower = appNames.map((n) => n.toLowerCase());

  const has_subscription_app = appNamesLower.some((n) => SUBSCRIPTION_APPS.some((s) => n.includes(s)));
  const has_reviews_app = appNamesLower.some((n) => REVIEW_APPS.some((s) => n.includes(s)));
  const has_email_app = appNamesLower.some((n) => EMAIL_APPS.some((s) => n.includes(s)));

  // Collect all variant prices
  const prices = products.flatMap((p) => {
    const variants = p.variants || [];
    if (variants.length) return variants.map((v) => parseFloat(v.price || 0)).filter((x) => x > 0);
    return [parseFloat(p.price || 0)].filter((x) => x > 0);
  });

  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const currency = pricing.currency || 'USD';

  let pricing_tier;
  if (avgPrice >= 500) pricing_tier = 'luxury';
  else if (avgPrice >= 100) pricing_tier = 'premium';
  else if (avgPrice >= 30) pricing_tier = 'mid-market';
  else pricing_tier = 'budget';

  let tech_sophistication;
  if (apps.length >= 10) tech_sophistication = 'advanced';
  else if (apps.length >= 4) tech_sophistication = 'intermediate';
  else tech_sophistication = 'basic';

  const onSaleCount = products.filter((p) => {
    const compareAt = parseFloat(p.compare_at_price || p.compareAtPrice || 0);
    const price = parseFloat(p.price || 0);
    return compareAt > 0 && compareAt > price;
  }).length;
  const discount_rate =
    products.length > 0
      ? `${Math.round((onSaleCount / products.length) * 100)}% of products on sale`
      : '0% of products on sale';

  // Score: apps (max 30) + products (max 20) + key app categories (30) + misc (20)
  let score = 0;
  score += Math.min(30, apps.length * 3);
  score += Math.min(20, products.length * 0.1);
  if (has_subscription_app) score += 10;
  if (has_reviews_app) score += 10;
  if (has_email_app) score += 10;
  if (pricing_tier === 'premium' || pricing_tier === 'luxury') score += 10;
  if (result.theme) score += 5;
  if (result.store) score += 5;
  const competitor_score = Math.min(100, Math.round(score));

  const storeName = result.store?.name || result.store?.title || 'This store';
  const summary = `${storeName} is a ${pricing_tier} Shopify store with ${products.length} products, ${apps.length} detected apps, and ${tech_sophistication} technical sophistication.`;

  return {
    summary,
    pricing_tier,
    tech_sophistication,
    top_apps: apps.slice(0, 5),
    has_subscription_app,
    has_reviews_app,
    has_email_app,
    product_count: products.length,
    price_range: {
      min: parseFloat(minPrice.toFixed(2)),
      max: parseFloat(maxPrice.toFixed(2)),
      avg: parseFloat(avgPrice.toFixed(2)),
      currency,
    },
    discount_rate,
    competitor_score,
  };
}

const HIGH_MARGIN_TYPES = ['jewelry', 'art', 'digital', 'supplement', 'vitamin', 'beauty', 'skincare', 'cosmetic', 'perfume', 'fragrance', 'software', 'print', 'course'];
const LOW_MARGIN_TYPES = ['electronics', 'computer', 'phone', 'tablet', 'appliance', 'furniture', 'mattress', 'bike'];
const HIGH_COMPETITION_TYPES = ['t-shirt', 'tshirt', 'phone case', 'mug', 'hoodie', 'legging', 'yoga', 'water bottle', 'backpack', 'wallet', 'sunglasses'];
const LOW_COMPETITION_TYPES = ['custom', 'handmade', 'artisan', 'bespoke', 'specialty', 'niche'];

function enrichProduct(product) {
  const type = (product.product_type || product.productType || '').toLowerCase();

  let margin_estimate;
  if (HIGH_MARGIN_TYPES.some((k) => type.includes(k))) margin_estimate = 'High (60-80%)';
  else if (LOW_MARGIN_TYPES.some((k) => type.includes(k))) margin_estimate = 'Low (10-25%)';
  else margin_estimate = 'Medium (30-50%)';

  let competition_level;
  if (LOW_COMPETITION_TYPES.some((k) => type.includes(k))) competition_level = 'Low';
  else if (HIGH_COMPETITION_TYPES.some((k) => type.includes(k))) competition_level = 'High';
  else competition_level = 'Medium';

  return { ...product, margin_estimate, competition_level };
}

// ---------------------------------------------------------------------------

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = router;
