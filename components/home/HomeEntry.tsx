'use client';

import Link from 'next/link';
import { useState } from 'react';
import { APP_NAME } from '../../config/app';
import { t } from '../../lib/home/messages';
import type { EventOption } from '../../lib/server/home/listEvents';

type Props = { events: EventOption[] };

function Card({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center rounded-2xl border border-white/5 bg-white/5 p-8 text-center text-lg font-medium text-[#F5F5F0] transition hover:brightness-110"
    >
      {label}
    </Link>
  );
}

export default function HomeEntry({ events }: Props) {
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const qs = eventId ? `?event=${encodeURIComponent(eventId)}` : '';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <span className="text-sm font-medium text-[#F5F5F0]/50">{APP_NAME}</span>

      <label className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[.12em] text-white/60">{t('picker.label')}</span>
        {events.length ? (
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-[#F5F5F0] outline-none focus:border-[#C9A961]"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} · {ev.venueName}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-[#F5F5F0]/50">{t('picker.empty')}</span>
        )}
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card href={`/console${qs}`} label={t('cards.organiser')} />
        <Card href="/owner/venue" label={t('cards.venue_owner')} />
        <Card href={`/v${qs}`} label={t('cards.visitor')} />
      </div>
    </main>
  );
}
