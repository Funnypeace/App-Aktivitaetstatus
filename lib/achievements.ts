import { supabase } from './supabase';
import { addXP } from './xp';
import { showNotification } from './notifications';

export type AchievementTrigger = 'login' | 'games' | 'message' | 'chat';

const triggerConditions: Record<AchievementTrigger, string[]> = {
  login:   ['first_login', 'login_7_days', 'login_30_days'],
  games:   ['first_game', 'five_games'],
  message: ['first_message', 'messages_50'],
  chat:    ['first_chat'],
};

export async function checkAndUnlockAchievements(
  userId: string,
  trigger: AchievementTrigger
): Promise<void> {
  try {
    const conditions = triggerConditions[trigger];

    const { data: achs } = await supabase
      .from('achievements')
      .select('id, condition, name')
      .in('condition', conditions);
    if (!achs?.length) return;

    const { data: ua } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .in('achievement_id', achs.map((a) => a.id));

    const unlockedIds = new Set((ua ?? []).map((u) => u.achievement_id as string));
    const toCheck = achs.filter((a) => !unlockedIds.has(a.id));
    if (!toCheck.length) return;

    const toUnlock: string[] = [];
    for (const ach of toCheck) {
      if (await conditionMet(userId, ach.condition)) {
        toUnlock.push(ach.id);
      }
    }

    if (toUnlock.length) {
      await supabase
        .from('user_achievements')
        .insert(toUnlock.map((achievement_id) => ({ user_id: userId, achievement_id })));
      addXP(userId, 50 * toUnlock.length);
      const nameById = new Map(achs.map((a) => [a.id, a.name as string]));
      for (const id of toUnlock) {
        showNotification('achievement_unlocked', `New Achievement: ${nameById.get(id) ?? ''}!`);
      }
    }
  } catch {
    // best-effort
  }
}

async function conditionMet(userId: string, condition: string): Promise<boolean> {
  switch (condition) {
    case 'first_login': {
      const { count } = await supabase
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'login');
      return (count ?? 0) >= 1;
    }
    case 'login_7_days':
      return (await distinctLoginDays(userId)) >= 7;
    case 'login_30_days':
      return (await distinctLoginDays(userId)) >= 30;
    case 'first_game': {
      const { count } = await supabase
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', 'games');
      return (count ?? 0) >= 1;
    }
    case 'five_games': {
      const { count } = await supabase
        .from('user_game_statistics')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      return (count ?? 0) >= 5;
    }
    case 'first_message': {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId);
      return (count ?? 0) >= 1;
    }
    case 'messages_50': {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId);
      return (count ?? 0) >= 50;
    }
    case 'first_chat': {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      return (count ?? 0) >= 1;
    }
    default:
      return false;
  }
}

async function distinctLoginDays(userId: string): Promise<number> {
  const { data } = await supabase
    .from('activity_events')
    .select('created_at')
    .eq('user_id', userId)
    .eq('type', 'login');
  if (!data) return 0;
  return new Set(data.map((e) => (e.created_at as string).slice(0, 10))).size;
}
