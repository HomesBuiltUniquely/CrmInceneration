'use client';

import { useEffect, useState } from 'react';
import BookingCelebration from './BookingCelebration';

function hallwayBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000';
  }
  const configured = process.env.NEXT_PUBLIC_HALLWAY_URL?.trim();
  return (configured || 'https://hallway-liart.vercel.app').replace(/\/$/, '');
}

/** Corner celebration for people already signed into CRM. */
export default function BookingCelebrationHost() {
  const [viewer, setViewer] = useState<{
    key: string;
    name: string;
    aliases: string[];
  } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    const name = (localStorage.getItem('crm_user_name') || '').trim();
    const username = (localStorage.getItem('crm_login_username') || '').trim();
    const userId = (localStorage.getItem('crm_user_id') || '').trim();
    const key = (username || userId || name).trim();
    if (token && key) {
      setViewer({
        key,
        name: name || key,
        aliases: [username, userId, name, userId ? `uid:${userId}` : ''].filter(Boolean),
      });
    }
  }, []);

  if (!viewer) return null;
  return (
    <BookingCelebration
      apiBase={hallwayBase()}
      placement="corner"
      viewerKey={viewer.key}
      viewerAliases={viewer.aliases}
      viewerName={viewer.name}
    />
  );
}
