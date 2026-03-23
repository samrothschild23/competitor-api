# Competitor Intelligence API

Real-time competitive intelligence for e-commerce developers — Shopify store analysis, Amazon product research, and Google Maps lead generation in one REST API.

## Quick start

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# → add your APIFY_TOKEN

# 3. Start
npm start            # production
npm run dev          # hot-reload via nodemon
```

The server starts on `http://localhost:3000` (or `PORT` from `.env`).

---

## Endpoints

All endpoints return JSON. All paid endpoints require an `X-RapidAPI-Key` header when called through RapidAPI.

### `GET /health`
Free. Returns API status and endpoint list.

```bash
curl http://localhost:3000/health
```

```json
{
  "success": true,
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-23T10:00:00.000Z",
  "endpoints": [...]
}
```

---

### `GET /shopify/analyze` — $0.10/call

Full store intelligence: products, pricing, collections, theme, installed apps.

| Param | Type | Required | Description |
|---|---|---|---|
| `url` | string | ✅ | Full Shopify store URL |

```bash
curl "http://localhost:3000/shopify/analyze?url=https://gymshark.com" \
  -H "X-RapidAPI-Key: YOUR_KEY"
```

```json
{
  "success": true,
  "data": {
    "url": "https://gymshark.com",
    "store": { "name": "Gymshark", "currency": "GBP" },
    "products": [...],
    "collections": [...],
    "pricing": { "min": 20, "max": 70, "average": 38 },
    "theme": { "name": "Dawn", "version": "8.0.0" },
    "apps": ["Klaviyo", "Yotpo", "ReCharge"]
  },
  "meta": { "cached": false, "retrieved_at": "..." }
}
```

---

### `GET /shopify/products` — $0.03/call

Paginated product catalog.

| Param | Type | Required | Default |
|---|---|---|---|
| `url` | string | ✅ | — |
| `page` | integer | ❌ | 1 |
| `limit` | integer | ❌ | 50 (max 200) |

```bash
curl "http://localhost:3000/shopify/products?url=https://gymshark.com&page=2&limit=25"
```

```json
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {
      "page": 2, "limit": 25, "total": 312,
      "pages": 13, "has_next": true
    }
  }
}
```

---

### `GET /amazon/search` — $0.08/call

Keyword search with Opportunity Score for each result.

| Param | Type | Required | Default |
|---|---|---|---|
| `keyword` | string | ✅ | — |
| `marketplace` | string | ❌ | `US` |

Supported marketplaces: `US`, `UK`, `DE`, `FR`, `CA`, `JP`, `AU`, `IN`, `MX`, `IT`, `ES`

```bash
curl "http://localhost:3000/amazon/search?keyword=wireless+earbuds&marketplace=US"
```

```json
{
  "success": true,
  "data": {
    "keyword": "wireless earbuds",
    "marketplace": "US",
    "results": [
      {
        "asin": "B08N5WRWNW",
        "title": "Sony WF-1000XM4",
        "price": 279.99,
        "rating": 4.6,
        "review_count": 18432,
        "opportunity_score": 74
      }
    ],
    "total": 20
  }
}
```

---

### `GET /amazon/product` — $0.10/call

Full product analysis with FBA cost/profit estimate.

| Param | Type | Required | Default |
|---|---|---|---|
| `asin` | string | ✅ | — |
| `marketplace` | string | ❌ | `US` |

```bash
curl "http://localhost:3000/amazon/product?asin=B08N5WRWNW&marketplace=US"
```

```json
{
  "success": true,
  "data": {
    "asin": "B08N5WRWNW",
    "title": "Sony WF-1000XM4",
    "monthly_sales_estimate": 4200,
    "monthly_revenue_estimate": 1175958,
    "fba_estimate": {
      "referral_fee": 42.00,
      "fulfillment_fee": 6.50,
      "storage_fee_monthly": 0.94,
      "total_fees": 49.44,
      "net_profit_estimate": 38.55
    }
  }
}
```

---

### `GET /maps/leads` — $0.15/call

Scored business leads with outreach hints.

| Param | Type | Required | Default |
|---|---|---|---|
| `industry` | string | ✅ | — |
| `location` | string | ✅ | — |
| `min_score` | integer | ❌ | 60 |
| `google_key` | string | ✅ | — |

> `google_key` is your Google Maps API key, passed through to the scraper and never stored.

```bash
curl "http://localhost:3000/maps/leads?industry=yoga+studio&location=Austin+TX&min_score=70&google_key=YOUR_GOOGLE_KEY"
```

```json
{
  "success": true,
  "data": {
    "industry": "yoga studio",
    "location": "Austin, TX",
    "min_score": 70,
    "leads": [
      {
        "name": "Black Swan Yoga",
        "score": 88,
        "address": "2349 Thornton Rd, Austin, TX",
        "phone": "+1-512-555-0101",
        "website": "https://blackswanyoga.com",
        "rating": 4.8,
        "review_count": 412,
        "outreach_hints": [
          "No online booking widget detected — upsell scheduling software",
          "Last Google post was 6 months ago — offer social media management"
        ]
      }
    ],
    "total": 14
  }
}
```

---

## Error responses

All errors follow the same shape:

```json
{
  "success": false,
  "error": {
    "status": 400,
    "message": "Missing required query parameter: url"
  }
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request — missing or invalid parameter |
| `401` | Unauthorized — missing or invalid API key |
| `404` | Not found — no data for the given identifier |
| `429` | Rate limit exceeded |
| `504` | Gateway timeout — Apify actor timed out, retry |
| `500` | Internal server error |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `APIFY_TOKEN` | ✅ | Apify API token |
| `PORT` | ❌ | HTTP port (default `3000`) |
| `NODE_ENV` | ❌ | `production` or `development` |

---

## Deployment

Any Node.js host works. Recommended for low-latency RapidAPI responses:

**Railway (one-click)**
```bash
railway init && railway up
```

**Render**
- Build command: `npm install`
- Start command: `npm start`
- Add `APIFY_TOKEN` in the Environment tab

**Docker**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Publishing on RapidAPI

See [`rapidapi.md`](./rapidapi.md) for the full step-by-step guide including pricing tiers, listing copy, and dashboard configuration.
