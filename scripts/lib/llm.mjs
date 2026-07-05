// Provider order: Gemini (primary, free-tier gemini-2.5-flash) -> Groq (fallback,
// free-tier llama-3.3-70b-versatile). If neither key is set, throws clearly so
// the pipeline fails loudly instead of silently producing empty content.
//
// Both are called via plain fetch — no SDK dependency, keeps package.json empty.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function callGemini(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

async function callGroq(prompt, apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Groq returned an empty response.');
  return text;
}

/**
 * Call the LLM with automatic fallback: Gemini first, Groq if Gemini
 * fails or GEMINI_API_KEY isn't set, error if neither is available.
 */
export async function callLLM(prompt) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    throw new Error('No LLM provider configured — set GEMINI_API_KEY and/or GROQ_API_KEY.');
  }

  if (geminiKey) {
    try {
      return await callGemini(prompt, geminiKey);
    } catch (err) {
      console.warn(`[llm] Gemini failed (${err.message}), falling back to Groq...`);
    }
  }

  if (groqKey) {
    return await callGroq(prompt, groqKey);
  }

  throw new Error('Gemini failed and no GROQ_API_KEY is set to fall back to.');
}

/**
 * Call the LLM expecting a strict-JSON response (used for the carousel
 * slide breakdown). Strips markdown code fences if the model added them,
 * then parses. Throws with the raw text included if parsing fails, so
 * failures are debuggable rather than silently producing garbage content.
 */
export async function callLLMForJSON(prompt) {
  const raw = await callLLM(prompt);
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`LLM did not return valid JSON. Raw response:\n${raw.slice(0, 500)}`);
  }
}
