/** Netlify function: server-side proxy for the ElevenLabs text-to-speech API (returns binary mp3). */

// SECURITY: the real API key lives ONLY in the host environment variable
// ELEVENLABS_API_KEY. It is never hard-coded, never bundled into the client,
// and never logged or echoed back in any response.
export const handler = async (event) => {
  // Only POST is proxied.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Read the key from the host env only.
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    // Do NOT echo the key or any env contents.
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'server missing ELEVENLABS_API_KEY' }),
    };
  }

  try {
    // Reconstruct the ElevenLabs path from the original request path.
    // Rewrites are status-200, so event.path is the ORIGINAL path
    // (e.g. /api/tts/v1/text-to-speech/{voiceId}). Strip the proxy prefix
    // to yield e.g. /v1/text-to-speech/{voiceId}. Also tolerate the raw
    // function path used when calling the function directly.
    let path = event.path || '';
    if (path.startsWith('/api/tts')) {
      path = path.slice('/api/tts'.length);
    } else if (path.startsWith('/.netlify/functions/tts')) {
      path = path.slice('/.netlify/functions/tts'.length);
    }

    // Preserve the query string (e.g. ?output_format=mp3_44100_128).
    const query = event.rawQuery ? `?${event.rawQuery}` : '';
    const url = 'https://api.elevenlabs.io' + path + query;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: event.body,
    });

    if (!upstream.ok) {
      return { statusCode: upstream.status, body: 'tts upstream error' };
    }

    // Return the mp3 as base64 so Netlify serves it as binary.
    const buf = Buffer.from(await upstream.arrayBuffer());
    return {
      statusCode: 200,
      headers: { 'content-type': 'audio/mpeg' },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch {
    // Never throw; surface a generic upstream error without leaking details.
    return { statusCode: 502, body: JSON.stringify({ error: 'upstream error' }) };
  }
};
