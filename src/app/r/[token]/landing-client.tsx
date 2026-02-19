'use client';

import { useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';
import type { Recipient, LandingPageTemplate } from '@/lib/types';

declare global {
  interface Window {
    Vimeo: {
      Player: new (element: HTMLElement, options?: Record<string, unknown>) => VimeoPlayer;
    };
  }
}

interface VimeoPlayer {
  on(event: string, callback: (data?: { percent?: number }) => void): void;
  off(event: string): void;
  destroy(): void;
}

interface LandingClientProps {
  token: string;
  recipient: Recipient;
  vimeoVideoId: string;
  bookingUrl: string;
  landingTemplate: LandingPageTemplate | null;
}

const NAVY = '#1a1a2e';
const BLUE = '#3b82f6';

function getSessionId(): string {
  let sessionId = typeof window !== 'undefined' ? localStorage.getItem('qr_session_id') : null;
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qr_session_id', sessionId);
    }
  }
  return sessionId;
}

// Strip characters outside ISO-8859-1 range to prevent Chrome's
// "String contains non ISO-8859-1 code point" fetch error on non-Latin locales.
const toLatin1 = (s: string | null | undefined): string | null =>
  s ? s.replace(/[^\x00-\xFF]/g, '') : null;

async function trackEvent(token: string, eventType: string, eventValue?: string, percent?: number) {
  const sessionId = getSessionId();
  try {
    await fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        session_id: sessionId,
        event_type: eventType,
        event_value: eventValue ?? null,
        percent: percent ?? null,
        url_path: typeof window !== 'undefined' ? window.location.pathname : null,
        referrer: toLatin1(typeof window !== 'undefined' ? document.referrer || null : null),
        user_agent: toLatin1(typeof window !== 'undefined' ? navigator.userAgent : null),
      }),
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

const risks = [
  {
    number: '01',
    title: 'Schlüsselpersonen werden zu Engpässen',
    text: 'Kritisches Wissen konzentriert sich auf wenige Personen. Fehlt eine davon, stockt die Lieferfähigkeit. Das ist kein Personalrisiko – es ist ein strukturelles.',
  },
  {
    number: '02',
    title: 'Teams erfinden Lösungen neu',
    text: 'Bereits gelöste Probleme werden neu bearbeitet, weil das Wissen darüber nirgendwo verfügbar ist. Das kostet Marge, nicht nur Zeit.',
  },
  {
    number: '03',
    title: 'Entscheidungen sind nicht nachvollziehbar',
    text: 'Wenn Entscheidungsgrundlagen fehlen, entstehen Nacharbeit und vermeidbare Fehler auf der Führungsebene. Vertrauen in interne Prozesse leidet.',
  },
];

export function LandingClient({
  token,
  recipient,
  vimeoVideoId,
  bookingUrl,
  landingTemplate,
}: LandingClientProps) {
  const playerRef = useRef<VimeoPlayer | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const trackedEventsRef = useRef<Set<string>>(new Set());
  const videoStartedRef = useRef(false);

  // Track page view on mount
  useEffect(() => {
    trackEvent(token, 'page_view');
  }, [token]);

  // Initialize Vimeo player
  useEffect(() => {
    if (!vimeoVideoId || !playerContainerRef.current) return;

    if (!window.Vimeo) {
      const script = document.createElement('script');
      script.src = 'https://player.vimeo.com/api/player.js';
      script.async = true;
      script.onload = initPlayer;
      document.body.appendChild(script);
    } else {
      initPlayer();
    }

    function initPlayer() {
      if (!playerContainerRef.current || !vimeoVideoId) return;
      const player = new window.Vimeo.Player(playerContainerRef.current, {
        id: parseInt(vimeoVideoId),
        width: '100%',
        responsive: true,
      });
      playerRef.current = player;

      player.on('play', () => {
        if (!videoStartedRef.current && token) {
          videoStartedRef.current = true;
          trackEvent(token, 'video_start');
        }
      });

      player.on('timeupdate', (data: { percent?: number } | undefined) => {
        if (!data?.percent || !token) return;
        const percent = data.percent;
        const quartiles = [
          { threshold: 0.25, event: 'video_25' },
          { threshold: 0.5, event: 'video_50' },
          { threshold: 0.75, event: 'video_75' },
          { threshold: 1.0, event: 'video_complete' },
        ];
        for (const q of quartiles) {
          if (percent >= q.threshold && !trackedEventsRef.current.has(q.event)) {
            trackedEventsRef.current.add(q.event);
            trackEvent(token, q.event, undefined, percent);
          }
        }
      });

      player.on('ended', () => {
        if (token && !trackedEventsRef.current.has('video_complete')) {
          trackedEventsRef.current.add('video_complete');
          trackEvent(token, 'video_complete', undefined, 1);
        }
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [vimeoVideoId, token]);

  const handleBookCall = () => {
    trackEvent(token, 'cta_click', 'book');
    if (bookingUrl) window.open(bookingUrl, '_blank');
  };

  const getSubheadline = (): string => {
    const company = recipient.company || 'Ihr Unternehmen';

    // Strip full-sentence prefixes the model sometimes adds, and trailing dots.
    const rawSignal = recipient.signal_description?.trim() || null;
    const signal = rawSignal
      ? rawSignal
          .replace(/^Das Unternehmen wächst[\s,]*/i, '')
          .replace(/^Das Unternehmen verändert sich[\s,]*/i, '')
          .replace(/\.+$/, '')
          .trim() || null
      : null;

    if (recipient.signal_category === 'Growth') {
      const opener = signal ? `${company} wächst ${signal}.` : `${company} wächst.`;
      return `${opener} In solchen Phasen entstehen Wissenssilos, bevor Strukturen mithalten können – einzelne Personen werden zum Engpass, oft bevor es jemand bemerkt.`;
    }

    if (recipient.signal_category === 'Decline') {
      const opener = signal ? `${company} verändert sich ${signal}.` : `${company} steht vor Veränderungen.`;
      return `${opener} Genau jetzt ist das Risiko am höchsten, kritisches Wissen zu verlieren, bevor Gegenmaßnahmen greifen.`;
    }

    return 'Viele CEOs unterschätzen, wie direkt Wissensrisiken operative Lieferfähigkeit und Margen beeinflussen.';
  };

  const replacePlaceholders = (text: string | null): string => {
    if (!text) return '';
    const formatAnrede = (anrede: string | null): string => {
      if (!anrede) return '';
      switch (anrede?.toLowerCase()) {
        case 'herr': return `Sehr geehrter Herr ${recipient.last_name || ''}`;
        case 'frau': return `Sehr geehrte Frau ${recipient.last_name || ''}`;
        case 'dear': return `Dear ${recipient.first_name || ''}`;
        default: return '';
      }
    };
    return text
      .replace(/\{\{first_name\}\}/g, recipient.first_name || '')
      .replace(/\{\{last_name\}\}/g, recipient.last_name || '')
      .replace(/\{\{company\}\}/g, recipient.company || '')
      .replace(/\{\{anrede\}\}/g, formatAnrede(recipient.anrede));
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#f8f8fa', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <header
        className="sticky top-0 z-[9999]"
        style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e5e5ea' }}
      >
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center">
          <img src="/ask_sopia.png" alt="askSOPia" className="h-8" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5">

        {/* Hero */}
        <section className="pt-10 pb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4" style={{ color: NAVY }}>
            Die 3 Wissensrisiken, die CEOs häufig unterschätzen
          </h1>
          <p className="text-base sm:text-lg leading-relaxed" style={{ color: '#4b5563' }}>
            {getSubheadline()}
          </p>
        </section>

        {/* Video */}
        <section className="pb-8">
          <div
            className="rounded-lg overflow-hidden"
            style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <div
              ref={playerContainerRef}
              className="aspect-video"
              style={{ backgroundColor: NAVY }}
            />
          </div>
        </section>

        {/* 3 Risks */}
        <section className="pb-8">
          <div className="flex flex-col gap-4">
            {risks.map((risk) => (
              <div
                key={risk.number}
                className="rounded-lg p-5"
                style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5ea' }}
              >
                <div className="flex items-start gap-4">
                  <span
                    className="text-xs font-bold tabular-nums mt-0.5 shrink-0"
                    style={{ color: BLUE }}
                  >
                    {risk.number}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: NAVY }}>
                      {risk.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
                      {risk.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bridge + CTA */}
        <section className="pb-6">
          <div className="max-w-md mx-auto">
            <p className="text-sm text-center mb-4" style={{ color: '#4b5563' }}>
              Prüfen Sie in 15 Minuten, welche dieser Risiken in Ihrem Unternehmen bereits aktiv sind.
            </p>
            <button
              onClick={handleBookCall}
              className="flex items-center justify-center gap-3 w-full h-12 rounded-md text-base font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: BLUE, color: '#ffffff' }}
            >
              <Calendar className="h-5 w-5" />
              15-minütigen Austausch buchen
            </button>
          </div>
        </section>

        {/* Trust */}
        <section className="pb-10 text-center">
          <p className="text-sm" style={{ color: '#9ca3af' }}>
            Kein Newsletter. Kein Sales-Funnel.
          </p>
        </section>

        {/* Optional template body */}
        {landingTemplate?.body_html && (
          <section className="pb-10">
            <div
              className="rounded-lg p-6"
              style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5ea' }}
              dangerouslySetInnerHTML={{ __html: replacePlaceholders(landingTemplate.body_html) }}
            />
          </section>
        )}

      </main>

      <footer style={{ borderTop: '1px solid #e5e5ea' }}>
        <div className="max-w-2xl mx-auto px-5 py-8">
          <div className="flex flex-col items-center text-center">
            <img src="/ask_sopia.png" alt="askSOPia" className="h-7 mb-4" />
            <div className="text-sm space-y-1" style={{ color: '#6b7280' }}>
              <p className="font-medium" style={{ color: NAVY }}>
                Sebastian Schieke
              </p>
              <p>askSOPia.com ist eine Marke der NOVELDO AI GmbH</p>
            </div>
            <div
              className="mt-6 pt-6 w-full text-xs space-y-2"
              style={{ borderTop: '1px solid #e5e5ea', color: '#9ca3af' }}
            >
              <p>&copy; {new Date().getFullYear()} NOVELDO AI GmbH. Alle Rechte vorbehalten.</p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="https://asksopia.com/imprint"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: BLUE }}
                >
                  Impressum
                </a>
                <a
                  href="https://asksopia.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: BLUE }}
                >
                  Datenschutz
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
