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
  const [viewer, setViewer] = useState<{ key: string; name: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    const name = (localStorage.getItem('crm_user_name') || '').trim();
    const key = (
      localStorage.getItem('crm_login_username') ||
      localStorage.getItem('crm_user_id') ||
      name
    ).trim();
    if (token && key) setViewer({ key, name: name || key });
  }, []);

  if (!viewer) return null;
  return (
    <BookingCelebration
      apiBase={hallwayBase()}
      placement="corner"
      viewerKey={viewer.key}
      viewerName={viewer.name}
    />
  );
}
