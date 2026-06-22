import { supabase } from './supabase';
import { logActivity } from './activity';

// XP required to reach a given level. L1=0, L2=100, L3=250, L4=450, …
export function xpNeededForLevel(level: number): number {
  return 25 * (level - 1) * (level + 2);
}

export function calculateLevel(xp: number): { level: number; xp_to_next_level: number } {
  let level = 1;
  while (xpNeededForLevel(level + 1) <= xp) {
    level++;
  }
  return { level, xp_to_next_level: xpNeededForLevel(level + 1) };
}

export async function addXP(userId: string, amount: number): Promise<void> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('xp, level')
      .eq('id', userId)
      .single();
    if (!data) return;

    const newXp = (data.xp as number) + amount;
    const oldLevel = data.level as number;
    const { level, xp_to_next_level } = calculateLevel(newXp);

    await supabase
      .from('profiles')
      .update({ xp: newXp, level, xp_to_next_level })
      .eq('id', userId);

    if (level > oldLevel) {
      logActivity(userId, 'level_up', `Level Up! 🎉 Level ${level}`);
    }
  } catch {
    // best-effort
  }
}
