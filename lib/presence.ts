import { supabase } from './supabase';
import type { Profile } from './supabase';

// A user counts as "actively present" if they flagged the app as foregrounded
// and their last_seen is within this window.
export const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export type Presence = 'active' | 'online' | 'offline';

type PresenceInput = Pick<Profile, 'is_online' | 'is_active' | 'last_seen'>;

export function isActiveNow(p: PresenceInput): boolean {
  if (!p.is_active || !p.last_seen) return false;
  const ts = new Date(p.last_seen).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < ACTIVE_WINDOW_MS;
}

// Three-state presence: actively in the app, manually online, or offline.
export function presenceOf(p: PresenceInput): Presence {
  if (isActiveNow(p)) return 'active';
  if (p.is_online) return 'online';
  return 'offline';
}

// Mark the user's app as foregrounded/backgrounded. Keeps last_seen fresh.
export async function setActive(userId: string, active: boolean): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ is_active: active, last_seen: new Date().toISOString() })
      .eq('id', userId);
  } catch {
    // best-effort
  }
}
