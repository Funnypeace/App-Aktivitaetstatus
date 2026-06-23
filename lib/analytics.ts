import { supabase } from './supabase';

// The app owner. The Analytics screen and the analytics_events SELECT RLS
// policy are both gated on this address.
export const OWNER_EMAIL = 'funnypeace89@googlemail.com';

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === OWNER_EMAIL.toLowerCase();
}

// ── Event types ────────────────────────────────────────────────────────
export type AnalyticsEventType =
  | 'app_open'
  | 'app_close'
  | 'tab_switch'
  | 'message_send'
  | 'dm_send'
  | 'session_create'
  | 'session_join'
  | 'squad_create'
  | 'squad_join'
  | 'game_selected'
  | 'status_changed'
  | 'reaction'
  | 'review_submitted';

export type AnalyticsEvent = {
  id: string;
  user_id: string | null;
  event_type: string;
  data: Record<string, unknown> | null;
  session_id: string | null;
  created_at: string;
};

// Human-readable labels for the dashboard.
export const EVENT_LABELS: Record<string, string> = {
  app_open: 'App geöffnet',
  app_close: 'App geschlossen',
  tab_switch: 'Tab gewechselt',
  message_send: 'Global-Chat Nachricht',
  dm_send: 'Direktnachricht',
  session_create: 'Session erstellt',
  session_join: 'Session beigetreten',
  squad_create: 'Squad erstellt',
  squad_join: 'Squad beigetreten',
  game_selected: 'Spiel ausgewählt',
  status_changed: 'Status geändert',
  reaction: 'Reaktion',
  review_submitted: 'Review abgegeben',
};

// ── Session tracking ───────────────────────────────────────────────────
// One id per app load so events can be grouped into sessions and durations
// computed (last event timestamp − first event timestamp per session_id).
function generateUuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // RFC4122-ish fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const SESSION_ID = generateUuid();

// Cached current user id so trackEvent stays synchronous-feeling and never
// blocks on an auth round-trip. Set from Main on login.
let currentUserId: string | null = null;
export function setAnalyticsUser(userId: string | null): void {
  currentUserId = userId;
}

// Fire-and-forget event logging. Never throws; analytics must not break the app.
export async function trackEvent(
  eventType: AnalyticsEventType,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('analytics_events').insert({
      user_id: currentUserId,
      event_type: eventType,
      data: data ?? null,
      session_id: SESSION_ID,
    });
  } catch {
    // best-effort: swallow errors
  }
}

// ── Aggregation ────────────────────────────────────────────────────────
export type FeatureUsage = { type: string; label: string; count: number; pct: number };
export type DayBucket = { date: string; label: string; count: number };

export type AnalyticsSummary = {
  uniqueVisitors7d: number;
  totalEvents: number;
  mostUsedFeature: string | null;
  avgSessionMinutes: number;
  activeUsersToday: number;
  eventsPerDay: DayBucket[]; // last 14 days, oldest → newest
  featureUsage: FeatureUsage[]; // top 10 by count, desc
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Owner-only: RLS prevents non-owners from reading any rows, so a non-owner
// caller simply gets empty aggregates.
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const { data } = await supabase
    .from('analytics_events')
    .select('user_id, event_type, session_id, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });

  const rows = (data ?? []) as Pick<
    AnalyticsEvent,
    'user_id' | 'event_type' | 'session_id' | 'created_at'
  >[];

  const now = new Date();
  const todayKey = dayKey(now);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Unique visitors (last 7d): distinct user_id, anon sessions counted by session_id.
  const visitors7d = new Set<string>();
  const usersToday = new Set<string>();
  const featureCounts = new Map<string, number>();
  // session_id → { first, last }
  const sessionSpans = new Map<string, { first: number; last: number }>();

  for (const r of rows) {
    const t = new Date(r.created_at);
    const visitorKey = r.user_id ?? (r.session_id ? `anon:${r.session_id}` : null);

    if (t >= sevenDaysAgo && visitorKey) visitors7d.add(visitorKey);
    if (dayKey(t) === todayKey && visitorKey) usersToday.add(visitorKey);

    featureCounts.set(r.event_type, (featureCounts.get(r.event_type) ?? 0) + 1);

    if (r.session_id) {
      const span = sessionSpans.get(r.session_id);
      const ms = t.getTime();
      if (!span) sessionSpans.set(r.session_id, { first: ms, last: ms });
      else { if (ms < span.first) span.first = ms; if (ms > span.last) span.last = ms; }
    }
  }

  const totalEvents = rows.length;

  // Most used feature
  let mostUsedFeature: string | null = null;
  let topCount = -1;
  for (const [type, count] of featureCounts) {
    if (count > topCount) { topCount = count; mostUsedFeature = type; }
  }

  // Average session duration (minutes), only sessions with ≥2 events.
  let durSum = 0;
  let durCount = 0;
  for (const span of sessionSpans.values()) {
    if (span.last > span.first) { durSum += span.last - span.first; durCount += 1; }
  }
  const avgSessionMinutes = durCount > 0 ? durSum / durCount / 60000 : 0;

  // Events per day for the last 14 days (oldest → newest).
  const eventsPerDay: DayBucket[] = [];
  const perDayCounts = new Map<string, number>();
  for (const r of rows) perDayCounts.set(dayKey(new Date(r.created_at)), (perDayCounts.get(dayKey(new Date(r.created_at))) ?? 0) + 1);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    eventsPerDay.push({
      date: key,
      label: `${d.getDate()}.${d.getMonth() + 1}`,
      count: perDayCounts.get(key) ?? 0,
    });
  }

  // Feature usage: top 10 by count with percentage of total.
  const featureUsage: FeatureUsage[] = [...featureCounts.entries()]
    .map(([type, count]) => ({
      type,
      label: EVENT_LABELS[type] ?? type,
      count,
      pct: totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    uniqueVisitors7d: visitors7d.size,
    totalEvents,
    mostUsedFeature: mostUsedFeature ? (EVENT_LABELS[mostUsedFeature] ?? mostUsedFeature) : null,
    avgSessionMinutes,
    activeUsersToday: usersToday.size,
    eventsPerDay,
    featureUsage,
  };
}
