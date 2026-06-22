import { supabase } from './supabase';
import { addXP } from './xp';

export type BadgeDef = {
  name: string;
  icon: string;
  description: string;
  // Auto-evaluated badges return whether the user currently qualifies.
  // "Streamer" is manual-only, so it always returns false here.
  check: (userId: string) => Promise<boolean>;
};

export const BADGES: BadgeDef[] = [
  {
    name: 'Early Bird',
    icon: '🐦',
    description: 'Registriert vor Juni 2025.',
    check: async (userId) => {
      const { data } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .single();
      if (!data?.created_at) return false;
      return new Date(data.created_at).getTime() < new Date('2025-06-01T00:00:00Z').getTime();
    },
  },
  {
    name: 'Social Legend',
    icon: '💬',
    description: '100+ Nachrichten (DM + Global Chat).',
    check: async (userId) => {
      const [{ count: dm }, { count: chat }] = await Promise.all([
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender_id', userId),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);
      return (dm ?? 0) + (chat ?? 0) >= 100;
    },
  },
  {
    name: 'Game Master',
    icon: '🎮',
    description: '10+ verschiedene Spiele gespielt.',
    check: async (userId) => {
      const { count } = await supabase
        .from('user_game_statistics')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      return (count ?? 0) >= 10;
    },
  },
  {
    name: 'Speedrunner',
    icon: '⚡',
    description: '7 Tage in Folge mindestens 2× online.',
    check: async (userId) => {
      const { data } = await supabase
        .from('activity_events')
        .select('created_at')
        .eq('user_id', userId)
        .eq('type', 'login');
      if (!data) return false;
      const perDay = new Map<string, number>();
      for (const e of data) {
        const day = (e.created_at as string).slice(0, 10);
        perDay.set(day, (perDay.get(day) ?? 0) + 1);
      }
      const qualifying = [...perDay.entries()].filter(([, c]) => c >= 2).map(([d]) => d);
      return hasConsecutiveRun(qualifying, 7);
    },
  },
  {
    name: 'Achievement Hunter',
    icon: '🏆',
    description: 'Alle Achievements freigeschaltet.',
    check: async (userId) => {
      const [{ count: total }, { count: mine }] = await Promise.all([
        supabase.from('achievements').select('id', { count: 'exact', head: true }),
        supabase.from('user_achievements').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);
      return (total ?? 0) > 0 && (mine ?? 0) >= (total ?? 0);
    },
  },
  {
    name: 'Streamer',
    icon: '🎬',
    description: 'Manuell vergeben (z. B. mit Discord verlinkt).',
    check: async () => false,
  },
];

// Earns any newly-qualifying badges. Analogous to checkAndUnlockAchievements.
export async function checkAndUnlockBadges(userId: string): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('user_badges')
      .select('badge_name')
      .eq('user_id', userId);

    const earned = new Set((existing ?? []).map((b) => b.badge_name as string));
    const candidates = BADGES.filter((b) => !earned.has(b.name));
    if (!candidates.length) return;

    const toInsert: { user_id: string; badge_name: string; icon: string }[] = [];
    for (const badge of candidates) {
      if (await badge.check(userId)) {
        toInsert.push({ user_id: userId, badge_name: badge.name, icon: badge.icon });
      }
    }

    if (toInsert.length) {
      await supabase.from('user_badges').insert(toInsert);
      addXP(userId, 50 * toInsert.length);
    }
  } catch {
    // best-effort
  }
}

// True if `days` (YYYY-MM-DD) contains `runLength` consecutive calendar days.
function hasConsecutiveRun(days: string[], runLength: number): boolean {
  const set = new Set(days);
  for (const start of days) {
    let count = 1;
    let cur = start;
    while (count < runLength) {
      cur = nextDay(cur);
      if (set.has(cur)) count += 1;
      else break;
    }
    if (count >= runLength) return true;
  }
  return false;
}

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
