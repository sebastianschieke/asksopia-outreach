import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

/**
 * Generate a personalized German business letter opening
 * Connects the signal to askSOPia's value proposition
 */
export async function generatePersonalizedIntro(
  recipientFirstName: string,
  recipientCompany: string | null,
  signalCategory: string | null,
  signalDescription: string | null
): Promise<string> {
  const context = signalDescription || signalCategory || 'general interest';

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300,
    system: `Du bist ein professioneller Texter für deutsche Geschäftsbriefe. Deine Aufgabe ist es, einen persönlichen, aber professionellen Einleitungsabsatz zu erstellen.

Regeln:
- Schreibe auf Deutsch in einem freundlichen, aber professionellen Ton
- Der Absatz sollte 2-3 Sätze lang sein
- Beginne mit einer persönlichen Anknüpfung basierend auf dem Signal
- Vermeide Floskeln wie "Ich hoffe, diese Nachricht erreicht Sie wohlauf"
- Sei konkret und authentisch
- Erwähne niemals, dass du ein KI bist oder dass der Text generiert wurde
- Erwähne askSOPia als Lösung für Beratungseffizienz`,
    messages: [
      {
        role: 'user',
        content: `Erstelle einen persönlichen Einleitungsabsatz für einen Brief an ${recipientFirstName}${recipientCompany ? ` von ${recipientCompany}` : ''}.

Signal/Grund für Kontakt: ${context}

Der Absatz soll als persönliche Einleitung vor dem Hauptinhalt des Briefes stehen und eine Brücke zwischen dem Signal und dem Mehrwert von askSOPia schlagen.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return content.text;
  }

  return '';
}
