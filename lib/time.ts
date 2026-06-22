// Small date helpers for relative timestamps and "member since" labels.

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'unbekannt';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unbekannt';

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) return 'gerade eben';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months} ${months === 1 ? 'Monat' : 'Monaten'}`;

  const years = Math.floor(months / 12);
  return `vor ${years} ${years === 1 ? 'Jahr' : 'Jahren'}`;
}

const MONTHS_DE = [
  'Jan', 'Feb', 'März', 'Apr', 'Mai', 'Juni',
  'Juli', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
];

// e.g. "Mitglied seit Juni 2026"
export function memberSince(iso: string | null | undefined): string {
  if (!iso) return 'Mitglied';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Mitglied';
  return `Mitglied seit ${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
}

// e.g. "14:32"
export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
