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

    // Filter by min_score in case the actor returns extras, then enrich
    const leads = items
      .filter((l) => (l.score ?? 100) >= min_score)
      .map(enrichLead);

    res.json({
      success: true,
      data: {
        industry: industry.trim(),
        location: location.trim(),
        min_score,
        leads,
        total: leads.length,
        market_intelligence: computeMarketIntelligence(leads),
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

const HIGH_VALUE_CATEGORIES = ['restaurant', 'hotel', 'clinic', 'dental', 'medical', 'law', 'attorney', 'real estate', 'finance', 'accounting'];
const MID_VALUE_CATEGORIES = ['retail', 'salon', 'spa', 'gym', 'fitness', 'auto', 'repair', 'contractor', 'plumber', 'electrician'];

function enrichLead(lead) {
  const score = lead.score ?? 100;
  const category = (lead.category || lead.type || '').toLowerCase();

  let outreach_priority;
  if (score >= 80) outreach_priority = 'immediate';
  else if (score >= 65) outreach_priority = 'this_week';
  else outreach_priority = 'this_month';

  let estimated_deal_value;
  if (HIGH_VALUE_CATEGORIES.some((k) => category.includes(k))) estimated_deal_value = '$5000+/mo';
  else if (MID_VALUE_CATEGORIES.some((k) => category.includes(k))) estimated_deal_value = '$2000-5000/mo';
  else estimated_deal_value = '$500-2000/mo';

  const signals = lead.signals || lead.signal_tags || [];
  const signalsStr = (Array.isArray(signals) ? signals.join(' ') : String(signals)).toLowerCase();

  let pitch_angle;
  if (signalsStr.includes('no website') || signalsStr.includes('missing website')) {
    pitch_angle = 'Help them establish an online presence — they have no website and are losing customers to competitors';
  } else if (signalsStr.includes('low review') || signalsStr.includes('few review')) {
    pitch_angle = 'Boost their reputation — build a review generation system to close the gap with higher-rated competitors';
  } else if (signalsStr.includes('no social') || signalsStr.includes('missing social')) {
    pitch_angle = 'Launch their social media presence — they are invisible on the channels where customers discover local businesses';
  } else if (score >= 80) {
    pitch_angle = `High-scoring ${lead.category || 'business'} — pitch on competitive advantage and growth acceleration`;
  } else {
    pitch_angle = `Offer a quick-win audit to identify the biggest growth gaps for this ${lead.category || 'business'}`;
  }

  return { ...lead, outreach_priority, estimated_deal_value, pitch_angle };
}

const DEAL_VALUE_MIDPOINTS = { '$500-2000/mo': 1250, '$2000-5000/mo': 3500, '$5000+/mo': 7500 };

function computeMarketIntelligence(leads) {
  if (!leads.length) {
    return {
      total_opportunity_value: '$0/mo',
      avg_lead_score: 0,
      top_category: 'N/A',
      recommended_approach: 'No leads found matching your criteria',
    };
  }

  const total = leads.reduce((sum, l) => sum + (DEAL_VALUE_MIDPOINTS[l.estimated_deal_value] || 1250), 0);
  const total_opportunity_value = `$${total.toLocaleString()}/mo`;

  const avg_lead_score = parseFloat(
    (leads.reduce((s, l) => s + (l.score ?? 100), 0) / leads.length).toFixed(1)
  );

  const categoryCounts = {};
  leads.forEach((l) => {
    const cat = l.category || l.type || 'Unknown';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });
  const top_category = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const immediateCount = leads.filter((l) => l.outreach_priority === 'immediate').length;
  let recommended_approach;
  if (immediateCount >= 5) {
    recommended_approach = `Focus on the ${immediateCount} immediate-priority leads first; they show the strongest signals for rapid close`;
  } else if (immediateCount > 0) {
    recommended_approach = `Start with ${immediateCount} high-priority lead${immediateCount > 1 ? 's' : ''}, then work through the rest by score`;
  } else {
    recommended_approach = 'Prioritize outreach by score and lead with a free audit offer to improve conversion';
  }

  return { total_opportunity_value, avg_lead_score, top_category, recommended_approach };
}

module.exports = router;
