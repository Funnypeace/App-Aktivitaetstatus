import { supabase, DailyQuest, UserDailyQuest } from './supabase';
import { addXP } from './xp';

export async function getDailyQuests(): Promise<DailyQuest[]> {
  const { data } = await supabase.from('daily_quests').select('*');
  return (data ?? []) as DailyQuest[];
}

export async function getUserDailyProgress(userId: string): Promise<UserDailyQuest[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('user_daily_quests')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today);
  return (data ?? []) as UserDailyQuest[];
}

export async function ensureDailyQuestProgress(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const [quests, progress] = await Promise.all([
    getDailyQuests(),
    getUserDailyProgress(userId),
  ]);
  const existingIds = new Set(progress.map((p) => p.quest_id));
  const toInsert = quests
    .filter((q) => !existingIds.has(q.id))
    .map((q) => ({
      user_id: userId,
      quest_id: q.id,
      date: today,
      progress: 0,
      completed: false,
      claimed: false,
    }));
  if (toInsert.length) {
    await supabase.from('user_daily_quests').insert(toInsert);
  }
}

export async function updateQuestProgress(userId: string, condition: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: quests } = await supabase
      .from('daily_quests')
      .select('id, target')
      .eq('condition', condition);
    if (!quests?.length) return;

    for (const quest of quests as { id: string; target: number }[]) {
      const { data: existing } = await supabase
        .from('user_daily_quests')
        .select('id, progress, completed')
        .eq('user_id', userId)
        .eq('quest_id', quest.id)
        .eq('date', today)
        .single();

      if (!existing || existing.completed) continue;

      const newProgress = (existing.progress as number) + 1;
      const completed = newProgress >= quest.target;
      await supabase
        .from('user_daily_quests')
        .update({
          progress: newProgress,
          completed,
          ...(completed ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq('id', existing.id);
    }
  } catch {
    // best-effort
  }
}

export async function claimQuestReward(userId: string, userQuestId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_daily_quests')
      .select('quest_id, completed, claimed')
      .eq('id', userQuestId)
      .eq('user_id', userId)
      .single();

    const row = data as { quest_id: string; completed: boolean; claimed: boolean } | null;
    if (!row || !row.completed || row.claimed) return false;

    const { data: quest } = await supabase
      .from('daily_quests')
      .select('xp_reward')
      .eq('id', row.quest_id)
      .single();

    await supabase
      .from('user_daily_quests')
      .update({ claimed: true })
      .eq('id', userQuestId);

    if (quest) await addXP(userId, (quest as { xp_reward: number }).xp_reward);
    return true;
  } catch {
    return false;
  }
}
