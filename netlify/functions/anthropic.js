/** Netlify function: server-side proxy for the Anthropic Messages API. */

// SECURITY: the real API key lives ONLY in the host environment variable
// ANTHROPIC_API_KEY. It is never hard-coded, never bundled into the client,
// and never logged or echoed back in any response.
export const handler = async (event) => {
  // Only POST is proxied.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Read the key from the host env only.
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // Do NOT echo the key or any env contents.
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server missing ANTHROPIC_API_KEY' }),
    };
  }

  try {
    // Forward the client's JSON body verbatim ({ model, max_tokens, system, messages }).
    // The browser-only 'anthropic-dangerous-direct-browser-access' header is intentionally omitted.
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: event.body,
    });

    return {
      statusCode: upstream.status,
      headers: { 'content-type': 'application/json' },
      body: await upstream.text(),
    };
  } catch {
    // Never throw; surface a generic upstream error without leaking details.
    return { statusCode: 502, body: JSON.stringify({ error: 'upstream error' }) };
  }
};
