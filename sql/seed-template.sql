-- Run these commands in Neon SQL Editor

-- 1. Add column for storing edited personalized intro (if not already done)
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS letter_personalized_intro TEXT;

-- 2. Delete old template if it exists
DELETE FROM letter_templates WHERE name = 'DACH Consulting Default';

-- 3. Insert reference letter template
-- This is used as a REFERENCE for Claude AI to write the full letter.
-- Claude adapts structure and tone based on the signal, not fill-in-the-blank.
-- Only {{qr_code}} is a functional placeholder (for PDF QR code rendering).
INSERT INTO letter_templates (name, industry, subject_line, body_html, is_default, created_at, updated_at)
VALUES (
  'DACH Consulting Default',
  NULL,
  'Persönliche Einladung',
  '<p>Ich habe gesehen, dass Ihr Team in den letzten Monaten gewachsen ist. Vier neue Kolleginnen und Kollegen – das ist ein starkes Signal.</p>
<p>Doch mit jedem neuen Teammitglied stellt sich dieselbe Frage: Wie kommt das Wissen, das in den Köpfen Ihrer erfahrenen Berater steckt, schnell und strukturiert bei den Neuen an?</p>
<p>Nach 30 Jahren als Berater kenne ich das Problem. Wissen wächst – aber es skaliert nicht mit.</p>
<p>Das zeigt sich jeden Tag:</p>
<ul>
<li>Teams erfinden Lösungen neu, die anderswo im Haus längst existieren</li>
<li>Neue Berater brauchen Monate bis zur vollen Produktivität</li>
<li>Qualität hängt von Personen ab, nicht von Systemen</li>
<li>Wenn Schlüsselpersonen gehen, geht Know-how – und Marge – mit</li>
</ul>
<p>Deshalb habe ich eine Lösung gebaut, die ich mir damals selbst gewünscht hätte.</p>
<p><strong>In 2 Minuten:</strong></p>
<p>Scannen Sie den QR-Code. Ich zeige Ihnen, wie drei einfache Karten-Typen Ihr gesamtes Beratungs-Know-how strukturieren – ohne Handbuch-Monster zu bauen.</p>
<p>{{qr_code}}</p>
<p>In 2 Minuten wissen Sie, ob das für Ihr Beratungshaus relevant ist – oder nicht.</p>
<p>Herzliche Grüße</p>
<p>Sebastian Schieke</p>
<p>P.S. Der QR-Code führt Sie direkt zu einer persönlichen Seite mit einem 2-Minuten-Video. Kein Login, kein Aufwand – einfach scannen.</p>',
  TRUE,
  NOW(),
  NOW()
);
