import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

/**
 * Translate a raw ClickUp signal description (usually English tags/notes)
 * into a short, factual German phrase suitable for the landing page subheadline.
 * Uses Haiku for speed and cost efficiency.
 * Returns the original value unchanged if translation fails.
 */
export async function translateSignalToGerman(raw: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [
        {
          role: 'user',
          content: `Formuliere diesen Unternehmenssignal als kurze deutsche Verbalphrase (max. 6 Wörter), die natürlich nach "Das Unternehmen wächst" oder "Das Unternehmen verändert sich" passt. Keine Daten, keine Datumsangaben, keine Klammern, kein "+" Zeichen, keine Aufzählung. Nur eine fließende Beobachtung. Beispiel-Input: "4 neue Mitarbeiter + Direktor eingestellt (Jan 26)" → Beispiel-Output: "und baut die Führungsebene aus". Input: "${raw}"`,
        },
      ],
    });
    const content = response.content[0];
    return content.type === 'text' ? content.text.trim().replace(/^"|"$/g, '') : raw;
  } catch {
    return raw;
  }
}

/**
 * Generate the full personalized letter body using Claude.
 * Uses the master prompt for signal-based CEO letters.
 * Returns complete letter HTML: salutation + body + closing.
 */
export async function generateFullLetter(
  recipientFirstName: string,
  recipientLastName: string,
  recipientCompany: string | null,
  industry: string | null,
  signalCategory: string | null,
  signalDescription: string | null,
  anrede: string | null
): Promise<string> {
  const signal = signalDescription || signalCategory || 'general interest';
  const signalType = signalCategory === 'Growth' ? 'growth' : signalCategory === 'Decline' ? 'decline' : (signalCategory?.toLowerCase() ?? 'growth');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 600,
    system: `You are a senior B2B direct-response copywriter writing short physical letters to CEOs of 50–500 employee companies in Germany.
The goal is to maximize QR-code scans by creating relevance and CEO-level risk awareness around Wissensverlust, Schlüsselpersonen-Abhängigkeit und Marge.
This is not a sales letter. It is a relevance + curiosity wedge to trigger a QR scan.

Non-Negotiable Writing Rules:
- German language only
- Max 120 words
- Short paragraphs (1–2 lines)
- No buzzwords (KI, Innovation, Transformation, Plattform, Lösung)
- No product features
- No product name
- No hype
- No emojis
- No exclamation marks
- No links in the text (QR code exists separately)
- Must sound like a calm, competent human writing to a peer
- Must integrate the concrete signal naturally in the first 1–2 sentences
- Must translate the signal into a knowledge-related business risk
- Must frame consequences in CEO terms: Marge, Delivery, Engpässe, Abhängigkeit von Einzelpersonen
- One clear CTA: scan the QR code

Structure (exact order):
1. Signal reference (1–2 sentences, specific to the company)
2. Translate signal → Wissensrisiko (why this phase creates knowledge strain or loss)
3. CEO-level consequence (Marge, Delivery-Qualität, Engpässe, strukturelle Verwundbarkeit)
4. One-sentence CTA — use exactly one of these (adapt grammar only):
   - "Scannen Sie den Code, um die 3 Wissensrisiken zu sehen, die CEOs häufig unterschätzen (2 Minuten)."
   - "Scannen Sie den Code, um zu sehen, was Wissensverlust Unternehmen Ihrer Größe typischerweise kostet."
   - "Scannen Sie den Code, um zu sehen, was zuerst bricht, wenn Wissen in Köpfen statt in Strukturen lebt."

Output format:
- Return only the letter body (no salutation, no closing)
- Format as HTML: <p> tags for paragraphs
- No explanations, no headers, no analysis`,
    messages: [
      {
        role: 'user',
        content: `CEO name: ${recipientFirstName} ${recipientLastName}
Company: ${recipientCompany || 'unknown'}
Industry: ${industry || 'Consulting'}
Signal type: ${signalType}
Signal: ${signal}

Write the letter body only (no salutation, no closing). HTML format with <p> tags.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') return '';

  // Append QR placeholder so it renders inline (centered) after the CTA
  return content.text.trim() + '\n<p>{{qr_code}}</p>';
}

