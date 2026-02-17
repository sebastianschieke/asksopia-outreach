import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import type { Recipient, LetterTemplate } from './types';

const BASE_URL = process.env.BASE_URL || 'https://example.com';
const LETTER_VERSION = 'v1.0';

interface TextSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

interface ParagraphBlock {
  type: 'text' | 'qr' | 'gap';
  spans?: TextSpan[];
  isBullet?: boolean;
}

/**
 * Decode HTML entities
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014');
}

/**
 * Parse HTML to text blocks with formatting info
 */
function parseHtmlToBlocks(html: string): ParagraphBlock[] {
  const blocks: ParagraphBlock[] = [];

  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\r\n/g, '\n');

  const chunks = normalized.split(/<\/?p[^>]*>/gi);

  for (const part of chunks) {
    if (part.trim() === '') {
      continue;
    }

    if (part.includes('<ul') || part.includes('<UL')) {
      const segments = part.split(/<ul[^>]*>/i);
      if (segments[0]?.trim()) {
        blocks.push({ type: 'text', spans: parseInlineFormatting(segments[0].trim()) });
      }
      const liMatches = part.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (liMatches) {
        for (const li of liMatches) {
          const liContent = li.replace(/<\/?li[^>]*>/gi, '').trim();
          blocks.push({ type: 'text', spans: parseInlineFormatting(liContent), isBullet: true });
        }
      }
      const afterUl = part.split(/<\/ul>/i);
      if (afterUl.length > 1 && afterUl[afterUl.length - 1]?.trim()) {
        blocks.push({ type: 'text', spans: parseInlineFormatting(afterUl[afterUl.length - 1].trim()) });
      }
      continue;
    }

    const trimmed = part.trim();

    if (trimmed === '{{qr_code}}') {
      blocks.push({ type: 'qr' });
      continue;
    }

    if (trimmed.includes('{{qr_code}}')) {
      const qrParts = trimmed.split('{{qr_code}}');
      if (qrParts[0]?.trim()) {
        blocks.push({ type: 'text', spans: parseInlineFormatting(qrParts[0].trim()) });
      }
      blocks.push({ type: 'qr' });
      if (qrParts[1]?.trim()) {
        blocks.push({ type: 'text', spans: parseInlineFormatting(qrParts[1].trim()) });
      }
      continue;
    }

    blocks.push({ type: 'text', spans: parseInlineFormatting(trimmed) });
  }

  return blocks;
}

/**
 * Parse inline formatting (bold, italic) from HTML
 */
function parseInlineFormatting(html: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let bold = false;
  let italic = false;
  let pos = 0;
  let currentText = '';

  const flushText = () => {
    if (currentText) {
      spans.push({ text: decodeEntities(currentText), bold, italic });
      currentText = '';
    }
  };

  const tagPattern = /<\/?(?:strong|b|em|i)(?:\s[^>]*)?>/gi;
  let m;
  let lastIndex = 0;

  const tags: { index: number; tag: string }[] = [];
  while ((m = tagPattern.exec(html)) !== null) {
    tags.push({ index: m.index, tag: m[0] });
  }

  for (const t of tags) {
    if (t.index > lastIndex) {
      const text = html.substring(lastIndex, t.index).replace(/<[^>]+>/g, '');
      if (text) {
        currentText += text;
      }
    }

    const isClose = t.tag.startsWith('</');
    const tagNameMatch = t.tag.match(/<\/?(\w+)/);
    const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : '';

    if (tagName === 'strong' || tagName === 'b') {
      flushText();
      bold = !isClose;
    } else if (tagName === 'em' || tagName === 'i') {
      flushText();
      italic = !isClose;
    }

    lastIndex = t.index + t.tag.length;
  }

  if (lastIndex < html.length) {
    const rest = html.substring(lastIndex).replace(/<[^>]+>/g, '');
    if (rest) {
      currentText += rest;
    }
  }

  flushText();

  if (spans.length === 0) {
    const plain = html.replace(/<[^>]+>/g, '');
    if (plain) spans.push({ text: decodeEntities(plain), bold: false, italic: false });
  }

  return spans;
}

/**
 * Format German salutation (Anrede)
 */
function formatAnrede(anrede: string | null | undefined, firstName: string, lastName: string): string {
  if (!anrede) return '';

  switch (anrede.toLowerCase()) {
    case 'herr':
      return `Sehr geehrter Herr ${lastName},`;
    case 'frau':
      return `Sehr geehrte Frau ${lastName},`;
    case 'dear':
      return `Dear ${firstName},`;
    default:
      return '';
  }
}

/**
 * Replace placeholders in text
 */
function replacePlaceholders(
  text: string,
  recipient: Recipient,
  personalizedIntro?: string,
  anrede?: string | null
): string {
  const firstName = recipient.first_name || '';
  const lastName = recipient.last_name || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';
  const formattedAnrede = formatAnrede(anrede, firstName, lastName);

  return text
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{last_name\}\}/g, lastName)
    .replace(/\{\{full_name\}\}/g, fullName)
    .replace(/\{\{company\}\}/g, recipient.company || '')
    .replace(/\{\{industry\}\}/g, recipient.industry || '')
    .replace(/\{\{anrede\}\}/g, formattedAnrede)
    .replace(/\{\{personalized_intro\}\}/g, personalizedIntro || '');
}

/**
 * Generate a PDF letter as a Buffer (serverless-safe)
 * Adapted from Asset-Manager/server/pdf.ts for serverless environments
 */
export async function generateLetterPdf(
  recipient: Recipient,
  template: LetterTemplate,
  personalizedIntro?: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([595.28, 841.89]);

  const { StandardFonts } = await import('pdf-lib');
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Use standard fonts as fallback (serverless doesn't have filesystem access)
  const regularFont = helvetica;

  const { height, width } = page.getSize();
  const margin = 56;

  const topReservedSpace = 160;
  let y = height - margin - topReservedSpace;

  const textColor = rgb(0.1, 0.1, 0.1);
  const primaryColor = rgb(0.22, 0.51, 0.84);

  const bodyFontSize = 10.5;
  const lineHeight = 15;
  const paragraphGap = 7;
  const bulletIndent = 14;

  const bodyHtml = template.body_html || '';
  const processedBody = replacePlaceholders(
    bodyHtml,
    recipient,
    personalizedIntro,
    recipient.anrede
  );

  const landingUrl = `${BASE_URL}/r/${recipient.token}`;
  const qrDataUrl = await QRCode.toDataURL(landingUrl, {
    width: 150,
    margin: 1,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });
  const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  const qrSize = 85;

  let qrRenderedInline = false;

  const blocks = parseHtmlToBlocks(processedBody);
  const maxTextWidth = width - margin * 2;

  function getFontForSpan(span: TextSpan) {
    if (span.bold) return helveticaBold;
    if (span.italic) return helveticaOblique;
    return regularFont;
  }

  function drawSpanLine(spans: TextSpan[], xStart: number, yPos: number, fontSize: number) {
    let x = xStart;
    for (const span of spans) {
      const f = getFontForSpan(span);
      page.drawText(span.text, { x, y: yPos, size: fontSize, font: f, color: textColor });
      x += f.widthOfTextAtSize(span.text, fontSize);
    }
  }

  function measureSpans(spans: TextSpan[], fontSize: number): number {
    let w = 0;
    for (const span of spans) {
      const f = getFontForSpan(span);
      w += f.widthOfTextAtSize(span.text, fontSize);
    }
    return w;
  }

  function drawFormattedParagraph(spans: TextSpan[], isBullet: boolean = false) {
    const xStart = isBullet ? margin + bulletIndent : margin;
    const availableWidth = isBullet ? maxTextWidth - bulletIndent : maxTextWidth;

    if (isBullet) {
      page.drawText('\u2022', {
        x: margin,
        y,
        size: bodyFontSize,
        font: helvetica,
        color: textColor,
      });
    }

    const allText = spans.map((s) => s.text).join('');
    const lines = allText.split('\n');

    for (const lineText of lines) {
      if (!lineText.trim()) {
        y -= lineHeight;
        continue;
      }

      const words = lineText.split(' ');
      let currentLineSpans: TextSpan[] = [];
      let currentLineWidth = 0;

      let charOffset = 0;

      const getSpanAtPosition = (pos: number): { bold: boolean; italic: boolean } => {
        let cumLen = 0;
        for (const span of spans) {
          const cleanText = span.text.replace(/\n/g, '');
          if (pos < cumLen + cleanText.length) {
            return { bold: span.bold, italic: span.italic };
          }
          cumLen += cleanText.length;
        }
        return { bold: false, italic: false };
      };

      for (const word of words) {
        const spanInfo = getSpanAtPosition(charOffset);
        const testSpan: TextSpan = { text: word, bold: spanInfo.bold, italic: spanInfo.italic };
        const f = getFontForSpan(testSpan);
        const wordWidth = f.widthOfTextAtSize(word, bodyFontSize);
        const spaceWidth = f.widthOfTextAtSize(' ', bodyFontSize);

        const addWidth = currentLineSpans.length > 0 ? spaceWidth + wordWidth : wordWidth;

        if (currentLineWidth + addWidth > availableWidth && currentLineSpans.length > 0) {
          drawSpanLine(currentLineSpans, xStart, y, bodyFontSize);
          y -= lineHeight;
          currentLineSpans = [{ text: word, bold: spanInfo.bold, italic: spanInfo.italic }];
          currentLineWidth = wordWidth;
        } else {
          if (currentLineSpans.length > 0) {
            const lastSpan = currentLineSpans[currentLineSpans.length - 1];
            if (lastSpan.bold === spanInfo.bold && lastSpan.italic === spanInfo.italic) {
              lastSpan.text += ' ' + word;
            } else {
              currentLineSpans.push({ text: ' ' + word, bold: spanInfo.bold, italic: spanInfo.italic });
            }
          } else {
            currentLineSpans.push({ text: word, bold: spanInfo.bold, italic: spanInfo.italic });
          }
          currentLineWidth += addWidth;
        }

        charOffset += word.length + 1;
      }

      if (currentLineSpans.length > 0) {
        drawSpanLine(currentLineSpans, xStart, y, bodyFontSize);
        y -= lineHeight;
      }
    }
  }

  function drawInlineQr() {
    y -= paragraphGap;
    const qrX = (width - qrSize) / 2;
    page.drawImage(qrImage, { x: qrX, y: y - qrSize, width: qrSize, height: qrSize });
    const urlWidth = helvetica.widthOfTextAtSize(landingUrl, 7);
    page.drawText(landingUrl, {
      x: (width - urlWidth) / 2,
      y: y - qrSize - 10,
      size: 7,
      font: helvetica,
      color: primaryColor,
    });
    y -= qrSize + 36;
    qrRenderedInline = true;
  }

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (block.type === 'qr') {
      drawInlineQr();
      continue;
    }

    if (block.type === 'text' && block.spans) {
      const blockText = block.spans.map((s) => s.text).join('').toLowerCase();
      const isPS = blockText.startsWith('p.s.') || blockText.startsWith('ps:') || blockText.startsWith('p.s:');
      const isClosing =
        blockText.includes('herzliche gr') ||
        blockText.includes('mit freundlichen') ||
        blockText.includes('beste gr');

      if (isPS) {
        const smallerSize = bodyFontSize - 1.5;
        const smallerLineHeight = lineHeight - 2;
        const xStart = margin;
        const availableWidth = maxTextWidth;
        const allText = block.spans.map((s) => s.text).join('');
        const words = allText.split(' ');
        let currentLineSpans: TextSpan[] = [];
        let currentLineWidth = 0;
        let charOffset = 0;

        const getSpanAtPos = (pos: number): { bold: boolean; italic: boolean } => {
          let cumLen = 0;
          for (const span of block.spans!) {
            if (pos < cumLen + span.text.length) return { bold: span.bold, italic: span.italic };
            cumLen += span.text.length;
          }
          return { bold: false, italic: false };
        };

        for (const word of words) {
          const spanInfo = getSpanAtPos(charOffset);
          const testSpan: TextSpan = { text: word, ...spanInfo };
          const f = getFontForSpan(testSpan);
          const wordWidth = f.widthOfTextAtSize(word, smallerSize);
          const spaceWidth = f.widthOfTextAtSize(' ', smallerSize);
          const addWidth = currentLineSpans.length > 0 ? spaceWidth + wordWidth : wordWidth;

          if (currentLineWidth + addWidth > availableWidth && currentLineSpans.length > 0) {
            drawSpanLine(currentLineSpans, xStart, y, smallerSize);
            y -= smallerLineHeight;
            currentLineSpans = [{ text: word, ...spanInfo }];
            currentLineWidth = wordWidth;
          } else {
            if (currentLineSpans.length > 0) {
              const last = currentLineSpans[currentLineSpans.length - 1];
              if (last.bold === spanInfo.bold && last.italic === spanInfo.italic) {
                last.text += ' ' + word;
              } else {
                currentLineSpans.push({ text: ' ' + word, ...spanInfo });
              }
            } else {
              currentLineSpans.push({ text: word, ...spanInfo });
            }
            currentLineWidth += addWidth;
          }
          charOffset += word.length + 1;
        }
        if (currentLineSpans.length > 0) {
          drawSpanLine(currentLineSpans, xStart, y, smallerSize);
          y -= smallerLineHeight;
        }
        y -= paragraphGap;
      } else {
        drawFormattedParagraph(block.spans, block.isBullet);
        if (!block.isBullet) {
          y -= paragraphGap;
        }
        if (isClosing) {
          y -= 30;
        }
      }
    }
  }

  if (!qrRenderedInline) {
    const qrX = width - margin - qrSize;
    const qrY = margin + 15;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
    page.drawText(landingUrl, {
      x: qrX,
      y: qrY - 12,
      size: 7,
      font: helvetica,
      color: primaryColor,
    });
  }

  const footerFontSize = 7;
  const footerLineHeight = 10;
  const footerX = margin;
  let footerY = margin + 50;
  const footerColor = rgb(0.4, 0.4, 0.4);

  const footerLines = [
    'askSOPia.com ist eine Marke der NOVELDO AI GmbH – Am Salzhaus 2 – 60311 Frankfurt am Main',
    'contact@asksopia.com – www.asksopia.com',
    '',
    'Der QR-Code dient ausschließlich der technischen Zuordnung und statistischen Auswertung.',
    'Wenn Sie keine weiteren Informationen wünschen, genügt eine kurze Mitteilung.',
  ];

  for (const footerLine of footerLines) {
    if (footerLine) {
      page.drawText(footerLine, {
        x: footerX,
        y: footerY,
        size: footerFontSize,
        font: helvetica,
        color: footerColor,
      });
    }
    footerY -= footerLineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes) as Buffer;
}

/**
 * Sanitize filename for use in downloads
 */
export function sanitizeFilename(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\u00E4\u00F6\u00FC\u00C4\u00D6\u00DC\u00DF_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Generate a filename for a letter PDF
 */
export function getLetterFilename(recipient: Recipient): string {
  const lastName = sanitizeFilename(recipient.last_name || 'Unknown');
  const company = sanitizeFilename(recipient.company || 'Company');
  const token = recipient.token;
  return `${lastName}_${company}_${token}.pdf`;
}
