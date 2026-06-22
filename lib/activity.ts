import { supabase } from './supabase';

export type ActivityType = 'status' | 'games' | 'message' | 'chat' | 'login';

// Update the user's last_seen marker. Called on any meaningful activity.
export async function touchLastSeen(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', userId);
}

// Record an activity event and refresh last_seen in one go. Fire-and-forget:
// failures here must never block the user-facing action.
export async function logActivity(
  userId: string,
  type: ActivityType,
  details: string
): Promise<void> {
  try {
    await Promise.all([
      supabase.from('activity_events').insert({ user_id: userId, type, details }),
      touchLastSeen(userId),
    ]);
  } catch {
    // ignore – activity logging is best-effort
  }
}

// Logs a login event at most once per 30-minute window to prevent duplicates
// from React Strict Mode double-invocation or rapid re-mounts. Still updates
// last_seen even when the dedup kicks in.
export async function logLogin(userId: string): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'login')
      .gte('created_at', cutoff);

    if (!count) {
      await logActivity(userId, 'login', 'App geöffnet');
    } else {
      // Don't add a log row, but keep last_seen fresh.
      await touchLastSeen(userId);
    }
  } catch {
    // best-effort
  }
}

// German labels for event types, used in the activity log UI.
export function activityTypeLabel(type: string): string {
  switch (type) {
    case 'status':
      return 'Status geändert';
    case 'games':
      return 'Spiele geändert';
    case 'message':
      return 'Nachricht gesendet';
    case 'chat':
      return 'Chat-Nachricht';
    case 'login':
      return 'Angemeldet';
    default:
      return type;
  }
}
