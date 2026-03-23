const axios = require('axios');

const ACTORS = {
  shopify: 'o1Utd0sitgdDan3Bw',
  amazon: 'mcHv75wegrch48E6I',
  maps: 'YUNn3SCogmVnrsUp4',
};

const APIFY_TIMEOUT_MS = 29_000; // stay under 30s RapidAPI hard limit

/**
 * Runs an Apify actor synchronously and returns the dataset items.
 *
 * @param {'shopify'|'amazon'|'maps'} actor
 * @param {string} tool  – the "tool" field sent in the actor input
 * @param {object} params – tool-specific parameters
 * @returns {Promise<Array>} dataset items from the actor run
 */
async function runActor(actor, tool, params) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw Object.assign(new Error('APIFY_TOKEN environment variable is not set'), { status: 500 });
  }

  const actorId = ACTORS[actor];
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;

  let response;
  try {
    response = await axios.post(
      url,
      { tool, params },
      {
        timeout: APIFY_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      const e = new Error('The intelligence actor timed out. Please retry in a moment.');
      e.status = 504;
      throw e;
    }

    const status = err.response?.status;
    const apifyMsg = err.response?.data?.error?.message || err.message;

    if (status === 401 || status === 403) {
      const e = new Error('Apify authentication failed. Check APIFY_TOKEN.');
      e.status = 500;
      throw e;
    }

    const e = new Error(`Apify actor error: ${apifyMsg}`);
    e.status = status >= 400 && status < 500 ? 422 : 502;
    throw e;
  }

  const items = response.data;
  if (!Array.isArray(items)) {
    const e = new Error('Unexpected response format from intelligence actor.');
    e.status = 502;
    throw e;
  }

  return items;
}

module.exports = { runActor };
