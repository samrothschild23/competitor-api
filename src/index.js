require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { rateLimitHeaders, serverLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errors');
const shopifyRoutes = require('./routes/shopify');
const amazonRoutes = require('./routes/amazon');
const mapsRoutes = require('./routes/maps');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json());

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(cors());

// ── Global middleware ───────────────────────────────────────────────────────
app.use(serverLimiter);
app.use(rateLimitHeaders);

// Disable fingerprinting
app.disable('x-powered-by');

// ── Health check (free, no auth required) ──────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      { method: 'GET', path: '/shopify/analyze',  description: 'Full Shopify store analysis',          price_per_call: '$0.10' },
      { method: 'GET', path: '/shopify/products',  description: 'Paginated product catalog',            price_per_call: '$0.03' },
      { method: 'GET', path: '/amazon/search',     description: 'Keyword search with Opportunity Score', price_per_call: '$0.08' },
      { method: 'GET', path: '/amazon/product',    description: 'Full product analysis + FBA estimate', price_per_call: '$0.10' },
      { method: 'GET', path: '/maps/leads',        description: 'Scored local business leads',          price_per_call: '$0.15' },
    ],
  });
});

// ── Feature routes ──────────────────────────────────────────────────────────
app.use('/shopify', shopifyRoutes);
app.use('/amazon',  amazonRoutes);
app.use('/maps',    mapsRoutes);

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { status: 404, message: `Route ${req.method} ${req.path} not found. See GET /health for available endpoints.` },
  });
});

// ── Centralised error handler ───────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[competitor-api] listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app; // for testing
