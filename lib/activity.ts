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
