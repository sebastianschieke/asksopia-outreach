import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

/**
 * Generate the full personalized letter body using Claude.
 * Claude uses the template as a reference/guide and adapts it
 * based on the signal — writing the entire letter as one coherent piece.
 *
 * The greeting (Anrede) is NOT included — it's added manually.
 * The {{qr_code}} placeholder must be preserved for PDF rendering.
 */
export async function generateFullLetter(
  recipientFirstName: string,
  recipientLastName: string,
  recipientCompany: string | null,
  signalCategory: string | null,
  signalDescription: string | null,
  templateReference: string
): Promise<string> {
  const signal = signalDescription || signalCategory || 'general interest in consulting optimization';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1200,
    system: `Du bist Sebastian Schieke, Gründer von askSOPia. Du schreibst persönliche Geschäftsbriefe an Führungskräfte von Beratungsunternehmen im DACH-Raum.

askSOPia ist eine KI-gestützte Wissensplattform für Beratungsunternehmen. Sie hilft, Projektwissen systematisch zu erfassen und wiederzufinden — damit Wissen nicht in einzelnen Köpfen steckt, sondern für alle nutzbar wird.

Dein Hintergrund: Nach 30 Jahren als Berater kennst du das Problem aus eigener Erfahrung. Du hast askSOPia gebaut, weil du dir genau so eine Lösung selbst gewünscht hättest.

Dein Stil:
- Direkt, persönlich, kein Corporate-Sprech
- Kurze, kraftvolle Sätze. Manchmal nur ein kurzer Satz als eigener Absatz.
- Du schreibst aus Erfahrung, wie ein Kollege — nicht wie ein Verkäufer
- Der Brief soll sich lesen wie eine persönliche Nachricht, nicht wie ein Werbebrief
- WICHTIG: Der Ton bleibt durchgehend konsistent. Wenn du positiv anknüpfst (z.B. Wachstum), drehe nicht abrupt ins Negative. Baue stattdessen eine natürliche Brücke.

REFERENZ-BRIEF (als Vorlage für Struktur und Ton — nicht 1:1 kopieren, sondern adaptieren):
${templateReference}

REGELN:
1. Schreibe den KOMPLETTEN Brieftext — OHNE Anrede/Begrüßung. Der erste Satz ist SOFORT der inhaltliche Einstieg. KEIN "Sehr geehrter", KEIN "Lieber", KEIN "Guten Tag". Die Anrede wird separat handschriftlich hinzugefügt.
2. Beginne mit einer persönlichen Anknüpfung basierend auf dem Signal
3. Führe NATÜRLICH über zum Thema Beratungswissen/Wissensmanagement
4. Verwende 3-5 Bullet-Points für konkrete Symptome/Probleme (als HTML <ul><li>)
5. Dann die Lösung: QR-Code scannen, 2-Minuten-Video
6. WICHTIG: Schreibe {{qr_code}} genau dort, wo der QR-Code erscheinen soll (als eigener Absatz)
7. Schließe mit "Herzliche Grüße" + "Sebastian Schieke"
8. Füge ein P.S. hinzu (kurz, zum QR-Code)
9. Formatiere als HTML mit <p> Tags für Absätze, <ul><li> für Bullets, <strong> für Betonungen
10. Der gesamte Brief sollte auf EINE A4-Seite passen (ca. 250-350 Wörter)
11. Erwähne NIEMALS, dass du eine KI bist
12. Passe die Bullet-Points an das Signal/die Situation an — sie müssen nicht identisch mit der Vorlage sein
13. Verwende IMMER den echten Firmennamen des Empfängers — NIEMALS Platzhalter wie [Firma] oder ähnliches`,
    messages: [
      {
        role: 'user',
        content: `Schreibe einen persönlichen Brief an ${recipientFirstName} ${recipientLastName}${recipientCompany ? ` von ${recipientCompany}` : ''}.

Signal/Anlass für den Brief: ${signal}

WICHTIG: Beginne den Brief DIREKT mit dem ersten inhaltlichen Satz. KEINE Anrede ("Sehr geehrter...", "Lieber...", etc.) — diese wird separat manuell hinzugefügt. Erster Satz = sofort der persönliche Einstieg basierend auf dem Signal.

Schreibe den kompletten Brieftext als HTML mit {{qr_code}} als Platzhalter für den QR-Code.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  return '';
}

