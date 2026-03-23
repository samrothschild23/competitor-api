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
        market_summary: computeMarketSummary(items),
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
      data: {
        ...product,
        seller_intelligence: computeSellerIntelligence(product),
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

function computeMarketSummary(items) {
  if (!items.length) {
    return {
      avg_opportunity_score: 0,
      niche_gap_detected: false,
      niche_gap_signal: 'Insufficient data',
      recommended_entry_price: 0,
      total_results_analyzed: 0,
    };
  }

  const scores = items.map((i) => i.opportunity_score ?? i.opportunityScore ?? 50);
  const avg_opportunity_score = parseFloat(
    (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  );

  const avgReviews =
    items.reduce((a, i) => a + (i.review_count || i.reviewCount || 0), 0) / items.length;
  const niche_gap_detected = avg_opportunity_score >= 65 || avgReviews < 100;
  const niche_gap_signal = niche_gap_detected
    ? avg_opportunity_score >= 65
      ? 'High opportunity scores indicate underserved demand'
      : 'Low review counts suggest early-stage market'
    : 'Market appears saturated with established players';

  const top3Prices = items
    .slice(0, 3)
    .map((i) => parseFloat(i.price || i.current_price || 0))
    .filter((x) => x > 0);
  const recommended_entry_price = top3Prices.length
    ? parseFloat((top3Prices.reduce((a, b) => a + b, 0) / top3Prices.length).toFixed(2))
    : 0;

  return {
    avg_opportunity_score,
    niche_gap_detected,
    niche_gap_signal,
    recommended_entry_price,
    total_results_analyzed: items.length,
  };
}

function computeSellerIntelligence(product) {
  const seller = (product.seller || product.sold_by || '').toLowerCase();
  const is_amazon_competing = seller.includes('amazon');

  const reviewCount = product.review_count || product.reviewCount || product.ratings_total || 0;
  let estimated_monthly_sales;
  if (reviewCount < 50) estimated_monthly_sales = 'Low (<100/mo)';
  else if (reviewCount < 500) estimated_monthly_sales = 'Medium (100-1000/mo)';
  else estimated_monthly_sales = 'High (1000+/mo)';

  // Listing quality: title length (30) + images (25) + reviews (25) + bullet points (20)
  const title = product.title || '';
  const imageCount = (product.images || product.image_urls || []).length;
  const bulletPoints = product.bullet_points || product.features || [];
  let quality = 0;
  if (title.length >= 80) quality += 30;
  else if (title.length >= 40) quality += 15;
  if (imageCount >= 7) quality += 25;
  else if (imageCount >= 3) quality += 15;
  else if (imageCount >= 1) quality += 5;
  if (reviewCount >= 100) quality += 25;
  else if (reviewCount >= 10) quality += 15;
  else if (reviewCount >= 1) quality += 5;
  if (bulletPoints.length >= 5) quality += 20;
  else if (bulletPoints.length >= 1) quality += 10;
  const listing_quality_score = Math.min(100, quality);

  const price = parseFloat(product.price || product.current_price || 0);
  const weight = product.weight_kg || product.weight || 0;

  const key_risks = [];
  const key_opportunities = [];

  if (is_amazon_competing) key_risks.push('Amazon is a direct competitor on this listing');
  if (reviewCount > 1000) key_risks.push('Established competitors with large review moats');
  if (price < 15) key_risks.push('Low price point reduces FBA margin viability');
  if (weight > 2) key_risks.push('Heavy item increases FBA fulfillment fees');

  if (!is_amazon_competing) key_opportunities.push('No direct Amazon competition');
  if (reviewCount < 100) key_opportunities.push('Low review count — easier to compete');
  if (price > 30) key_opportunities.push('Strong price point for FBA margins');
  if (listing_quality_score < 50) key_opportunities.push('Poor listing quality from competitors — easy differentiation');

  let fba_recommendation;
  if (is_amazon_competing || price < 15) fba_recommendation = 'Avoid';
  else if (key_risks.length >= 2) fba_recommendation = 'Risky';
  else if (key_opportunities.length >= 2) fba_recommendation = 'Highly recommended';
  else fba_recommendation = 'Viable';

  return {
    is_amazon_competing,
    estimated_monthly_sales,
    listing_quality_score,
    fba_recommendation,
    key_risks,
    key_opportunities,
  };
}

module.exports = router;
