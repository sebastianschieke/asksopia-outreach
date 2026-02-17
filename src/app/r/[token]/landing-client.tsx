'use client';

import { useEffect, useState, useRef } from 'react';
import { Calendar, Mail, XCircle, CheckCircle2 } from 'lucide-react';
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
        event_value: eventValue,
        percent,
        url_path: typeof window !== 'undefined' ? window.location.pathname : null,
        referrer: typeof window !== 'undefined' ? document.referrer || null : null,
        user_agent: typeof window !== 'undefined' ? navigator.userAgent : null,
      }),
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

export function LandingClient({
  token,
  recipient,
  vimeoVideoId,
  bookingUrl,
  landingTemplate,
}: LandingClientProps) {
  const [noInterestConfirmed, setNoInterestConfirmed] = useState(false);
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

  const handleEmailInfo = () => {
    trackEvent(token, 'cta_click', 'email');
    window.location.href = 'mailto:contact@asksopia.com?subject=Informationsanfrage';
  };

  const handleNoInterest = () => {
    trackEvent(token, 'cta_click', 'no_interest');
    setNoInterestConfirmed(true);
  };

  const replacePlaceholders = (text: string | null): string => {
    if (!text) return '';
    return text
      .replace(/\{\{first_name\}\}/g, recipient.first_name || '')
      .replace(/\{\{last_name\}\}/g, recipient.last_name || '')
      .replace(/\{\{company\}\}/g, recipient.company || '')
      .replace(/\{\{anrede\}\}/g, formatAnrede(recipient.anrede));
  };

  const formatAnredeGreeting = (anrede: string | null): string => {
    if (!anrede) return recipient.first_name || '';
    switch (anrede) {
      case 'herr':
        return `Herr ${recipient.last_name || ''}`;
      case 'frau':
        return `Frau ${recipient.last_name || ''}`;
      case 'dear':
        return recipient.first_name || '';
      default:
        return recipient.first_name || '';
    }
  };

  const formatAnrede = (anrede: string | null): string => {
    if (!anrede) return '';
    switch (anrede) {
      case 'herr':
        return `Sehr geehrter Herr ${recipient.last_name || ''}`;
      case 'frau':
        return `Sehr geehrte Frau ${recipient.last_name || ''}`;
      case 'dear':
        return `Dear ${recipient.first_name || ''}`;
      default:
        return '';
    }
  };

  const greeting = landingTemplate?.headline
    ? replacePlaceholders(landingTemplate.headline)
    : `Hallo ${formatAnredeGreeting(recipient.anrede)}`;

  const subheadline = landingTemplate?.subheadline
    ? replacePlaceholders(landingTemplate.subheadline)
    : 'Entdecken Sie, wie askSOPia.com Ihre Beratung effizienter macht.';

  const ctaButtonText = landingTemplate?.cta_button_text || 'Termin vereinbaren';

  if (noInterestConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f8fa' }}>
        <div
          className="w-full max-w-sm text-center p-8 rounded-lg"
          style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5ea' }}
        >
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: '#22c55e' }} />
          <h1 className="text-xl font-bold mb-2" style={{ color: NAVY }}>
            Vielen Dank!
          </h1>
          <p className="text-sm" style={{ color: '#6b7280' }}>
            Wir haben Ihre Rückmeldung erhalten. Falls Sie später Interesse haben, können Sie jederzeit zurückkommen.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f8fa', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header
        className="sticky top-0 z-[9999]"
        style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e5e5ea' }}
      >
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center">
          <div className="text-lg font-bold" style={{ color: BLUE }}>
            askSOPia
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5">
        <section className="pt-10 pb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3" style={{ color: NAVY }}>
            {greeting}
          </h1>
          <p className="text-base sm:text-lg leading-relaxed" style={{ color: '#4b5563' }}>
            {subheadline}
          </p>
          {recipient.company && (
            <p className="mt-3 text-sm font-medium" style={{ color: BLUE }}>
              Speziell für {recipient.company}
            </p>
          )}
        </section>

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

        <section className="pb-10">
          <div className="flex flex-col gap-3 max-w-md mx-auto">
            <button
              onClick={handleBookCall}
              className="flex items-center justify-center gap-3 w-full h-12 rounded-md text-base font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: BLUE, color: '#ffffff' }}
            >
              <Calendar className="h-5 w-5" />
              {ctaButtonText}
            </button>

            <button
              onClick={handleEmailInfo}
              className="flex items-center justify-center gap-3 w-full h-12 rounded-md text-base font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#ffffff', color: NAVY, border: `1px solid ${NAVY}20` }}
            >
              <Mail className="h-5 w-5" />
              Infos per E-Mail
            </button>

            <button
              onClick={handleNoInterest}
              className="w-full h-10 text-sm transition-opacity hover:opacity-70"
              style={{ color: '#9ca3af' }}
            >
              Aktuell kein Bedarf
            </button>
          </div>
        </section>

        {landingTemplate?.body_html && (
          <section className="pb-10">
            <div
              className="rounded-lg p-6"
              style={{ backgroundColor: '#ffffff', border: '1px solid #e5e5ea' }}
              dangerouslySetInnerHTML={{ __html: replacePlaceholders(landingTemplate.body_html) }}
            />
          </section>
        )}

        <section className="pb-10">
          <div className="rounded-lg p-8 text-center" style={{ backgroundColor: NAVY }}>
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#ffffff' }}>
              Bereit für den nächsten Schritt?
            </h2>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Lassen Sie uns gemeinsam Ihre Potenziale entdecken.
            </p>
            <button
              onClick={handleBookCall}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: BLUE, color: '#ffffff' }}
            >
              <Calendar className="h-4 w-4" />
              {ctaButtonText}
            </button>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid #e5e5ea' }}>
        <div className="max-w-2xl mx-auto px-5 py-8">
          <div className="flex flex-col items-center text-center">
            <div className="text-lg font-bold mb-4" style={{ color: BLUE }}>
              askSOPia
            </div>
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
                  href="https://noveldo.com/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: BLUE }}
                >
                  Impressum
                </a>
                <a
                  href="https://noveldo.com/privacy-policy"
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
