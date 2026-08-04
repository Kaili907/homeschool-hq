/** Netlify function: issues a short-lived Azure Speech authorization token. */

// SECURITY: the subscription key and region live only in host environment
// variables. The browser receives a short-lived token, never the subscription key.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region || !/^[a-z0-9-]+$/i.test(region)) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server missing Azure Speech configuration' }),
    };
  }

  try {
    const upstream = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': key },
      },
    );
    if (!upstream.ok) {
      return { statusCode: upstream.status, body: JSON.stringify({ error: 'token upstream error' }) };
    }
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
      body: JSON.stringify({ token: await upstream.text(), region }),
    };
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'upstream error' }) };
  }
};
