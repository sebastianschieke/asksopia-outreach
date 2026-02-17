-- Run these two commands in Neon SQL Editor

-- 1. Add column for storing edited personalized intro
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS letter_personalized_intro TEXT;

-- 2. Insert default letter template (matching the Michailov letter)
INSERT INTO letter_templates (name, industry, subject_line, body_html, is_default, created_at, updated_at)
VALUES (
  'DACH Consulting Default',
  NULL,
  'Persönliche Einladung',
  '<p>{{anrede}}</p>
<p>{{personalized_intro}}</p>
<p>Sie lesen diesen Brief – ohne LinkedIn-Spam, ohne Cold Calls.</p>
<p>So direkt sollte auch kritisches Wissen in Ihrem Beratungshaus verfügbar sein, wenn es gebraucht wird.</p>
<p>Nach 30 Jahren als Berater kenne ich das Problem: Ihr wertvollstes Asset – Projekt-Know-how, Methodenkompetenz, Client Intelligence – steckt in den Köpfen einzelner Senior-Berater.</p>
<p>Sie wachsen.</p>
<p>Aber Ihr Wissen skaliert nicht mit.</p>
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
