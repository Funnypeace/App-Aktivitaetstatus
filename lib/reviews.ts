import { supabase, GameReview } from './supabase';
import { logActivity } from './activity';

export async function submitReview(
  userId: string,
  gameName: string,
  rating: number,
  reviewText?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('game_reviews')
      .upsert(
        {
          user_id: userId,
          game_name: gameName,
          rating,
          review_text: reviewText ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,game_name' }
      );
    if (error) return false;
    const stars = '⭐'.repeat(rating);
    logActivity(userId, 'review', `${gameName} bewertet (${stars})`);
    return true;
  } catch {
    return false;
  }
}

export async function getGameReviews(
  gameName: string
): Promise<(GameReview & { username: string | null })[]> {
  const { data } = await supabase
    .from('game_reviews')
    .select('*, profiles(username)')
    .eq('game_name', gameName)
    .order('created_at', { ascending: false });

  return (
    (data ?? []) as unknown as (GameReview & {
      profiles: { username: string | null } | null;
    })[]
  ).map((r) => ({ ...r, username: r.profiles?.username ?? null }));
}

export async function getTopRatedGames(
  limit = 10
): Promise<{ game_name: string; avg: number; count: number }[]> {
  const { data } = await supabase
    .from('game_reviews')
    .select('game_name, rating');
  if (!data) return [];

  const byGame = new Map<string, number[]>();
  for (const row of data as { game_name: string; rating: number }[]) {
    const arr = byGame.get(row.game_name) ?? [];
    arr.push(row.rating);
    byGame.set(row.game_name, arr);
  }

  return Array.from(byGame.entries())
    .filter(([, ratings]) => ratings.length >= 3)
    .map(([game_name, ratings]) => ({
      game_name,
      avg: ratings.reduce((s, r) => s + r, 0) / ratings.length,
      count: ratings.length,
    }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, limit);
}

export async function getMyReview(
  userId: string,
  gameName: string
): Promise<GameReview | null> {
  const { data } = await supabase
    .from('game_reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('game_name', gameName)
    .single();
  return (data as GameReview) ?? null;
}
