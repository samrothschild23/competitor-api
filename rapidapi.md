# Publishing to RapidAPI Marketplace

Step-by-step guide for listing the Competitor Intelligence API on RapidAPI.

---

## 1. Prerequisites

- RapidAPI provider account at https://rapidapi.com/provider
- API deployed and reachable at a public HTTPS URL (e.g. via Railway, Render, or a VPS)
- `openapi.yaml` from this repo

---

## 2. Create the API listing

1. Log in to the RapidAPI provider dashboard.
2. Click **"Add New API"**.
3. Choose **"I have an existing API"** and select **OpenAPI / Swagger**.
4. Upload `openapi.yaml` from this repository — RapidAPI will auto-populate most fields.

---

## 3. Basic info

| Field | Value |
|---|---|
| **API Name** | Competitor Intelligence API |
| **Short description** | Real-time Shopify store analysis, Amazon product research with Opportunity Scores, and scored Google Maps business leads — all in one API. |
| **Category** | `Data` → `E-Commerce` |
| **Tags** | `shopify`, `amazon`, `ecommerce`, `competitor-intelligence`, `google-maps`, `product-research`, `lead-generation`, `fba`, `dropshipping` |
| **Website** | Your landing page or GitHub repo |
| **Visibility** | Public |

---

## 4. Listing description (copy-paste into RapidAPI)

```
## Competitor Intelligence API

Get an unfair advantage in e-commerce with real-time competitive data delivered through a single, developer-friendly REST API.

### What you can do

**Shopify Intelligence**
- Analyze any Shopify store: products, pricing, collections, installed apps, and theme detection
- Pull the full paginated product catalog from any store

**Amazon Product Research**
- Search by keyword and get every result scored with a proprietary Opportunity Score (demand vs. competition)
- Deep-dive any ASIN for sales estimates, BSR history, review metrics, and a full FBA profit/fee breakdown

**Google Maps Lead Generation**
- Discover scored local business leads by industry and location
- Each lead comes with a 0–100 quality score and AI-generated outreach hints

### Why developers choose this API
- One key, five powerful endpoints
- Sub-30s response times
- Consistent JSON structure across all endpoints
- Clear error messages with actionable guidance
- Pagination support for large data sets

### Use cases
- Shopify competitor trackers
- Amazon FBA opportunity finders
- E-commerce agency prospecting tools
- Dropshipping product research dashboards
- Local business outreach platforms
```

---

## 5. Pricing tiers

Set these up under **Plans** in the RapidAPI dashboard:

| Plan | Price | Calls/month | Overage |
|---|---|---|---|
| **Free** | $0 | 10 | Not available |
| **Basic** | $9.99 | 500 | $0.03–$0.15 / call |
| **Pro** | $29.99 | 2,000 | $0.03–$0.15 / call |
| **Ultra** | $99.99 | 10,000 | $0.03–$0.10 / call |

> **Tip:** Set per-endpoint pricing overrides so cheaper endpoints (e.g. `/shopify/products` at $0.03) don't eat the same quota as expensive ones (e.g. `/maps/leads` at $0.15). Use RapidAPI's **"Pricing by endpoint"** feature.

---

## 6. Endpoint configuration

For each endpoint, set the following in the RapidAPI dashboard:

| Endpoint | Description | Sample params |
|---|---|---|
| `GET /health` | API status — free | — |
| `GET /shopify/analyze` | Full store analysis | `url=https://gymshark.com` |
| `GET /shopify/products` | Product catalog | `url=https://gymshark.com&page=1&limit=50` |
| `GET /amazon/search` | Keyword search | `keyword=wireless+earbuds&marketplace=US` |
| `GET /amazon/product` | Product detail | `asin=B08N5WRWNW&marketplace=US` |
| `GET /maps/leads` | Business leads | `industry=yoga+studio&location=Austin+TX&google_key=YOUR_KEY` |

Mark `GET /health` as **"Free"** (no quota consumed).

---

## 7. Base URL

Enter the deployed API URL as the base URL:

```
https://your-deployment.up.railway.app
```

RapidAPI will proxy all requests through `competitor-api.p.rapidapi.com` and inject the `X-RapidAPI-Key` and `X-RapidAPI-Host` headers automatically.

---

## 8. Testing before publishing

1. In the RapidAPI dashboard, go to the **Endpoints** tab.
2. Click **"Test Endpoint"** for each route.
3. Confirm every endpoint returns a `200` with a `success: true` JSON body.
4. Confirm `/health` returns free (no quota hit).

---

## 9. Go live

1. Click **"Publish API"** in the dashboard.
2. Submit for RapidAPI review (usually approved within 1–3 business days).
3. Once approved, share the marketplace URL with developers.

---

## 10. Post-launch tips

- **Monitor usage** in the RapidAPI Analytics tab — watch for endpoints with high error rates.
- **Set up a webhook** in the RapidAPI dashboard to get notified when users subscribe.
- **Write a blog post** targeting "shopify competitor analysis api", "amazon fba research api", etc. to drive organic signups.
- **Respond to reviews** within 24 hours — RapidAPI surfaces provider responsiveness to potential subscribers.
