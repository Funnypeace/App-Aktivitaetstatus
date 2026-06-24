import { supabase, UserStreak } from './supabase';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function checkAndUpdateStreak(userId: string): Promise<void> {
  try {
    const today = todayStr();
    const yesterday = yesterdayStr();

    const { data } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) {
      await supabase.from('user_streaks').insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
      });
      return;
    }

    const streak = data as UserStreak;
    if (streak.last_activity_date === today) return;

    const newCurrent =
      streak.last_activity_date === yesterday ? streak.current_streak + 1 : 1;
    const newLongest = Math.max(streak.longest_streak, newCurrent);

    await supabase
      .from('user_streaks')
      .update({
        current_streak: newCurrent,
        longest_streak: newLongest,
        last_activity_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } catch {
    // best-effort
  }
}

export async function getUserStreak(userId: string): Promise<UserStreak | null> {
  const { data } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single();
  return (data as UserStreak) ?? null;
}

export async function getActivityHeatmap(
  userId: string,
  weeks = 12
): Promise<Record<string, number>> {
  const from = new Date();
  from.setDate(from.getDate() - weeks * 7);

  const { data } = await supabase
    .from('activity_events')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', from.toISOString());

  const map: Record<string, number> = {};
  for (const row of (data ?? []) as { created_at: string }[]) {
    const day = row.created_at.slice(0, 10);
    map[day] = (map[day] ?? 0) + 1;
  }
  return map;
}
