/**
 * Token generation utilities
 * Ported from Asset-Manager/server/db.ts
 */

/**
 * Generate a random token of specified length
 */
function randomToken(length: number = 8): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/**
 * Slugify text by removing special characters and converting to lowercase
 * Handles German umlauts
 */
export function slugify(text: string): string {
  const charMap: Record<string, string> = {
    ä: 'ae',
    ö: 'oe',
    ü: 'ue',
    ß: 'ss',
    Ä: 'Ae',
    Ö: 'Oe',
    Ü: 'Ue',
    é: 'e',
    è: 'e',
    ê: 'e',
    ë: 'e',
    á: 'a',
    à: 'a',
    â: 'a',
    ó: 'o',
    ò: 'o',
    ô: 'o',
    ú: 'u',
    ù: 'u',
    û: 'u',
    í: 'i',
    ì: 'i',
    î: 'i',
    ñ: 'n',
    ç: 'c',
  };

  return text
    .split('')
    .map((c) => charMap[c] || c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Generate a unique token preferring company name, then full name, then random
 */
export function generateToken(company?: string | null, firstName?: string | null, lastName?: string | null): string {
  if (company && company.trim().length > 0) {
    const slug = slugify(company);
    if (slug.length > 0) return slug;
  }

  const nameParts = [firstName, lastName].filter(Boolean).join(' ');
  if (nameParts.length > 0) {
    const slug = slugify(nameParts);
    if (slug.length > 0) return slug;
  }

  return randomToken(10);
}
