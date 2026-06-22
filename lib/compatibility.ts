import { supabase } from './supabase';

export type CompatibilityResult = {
  score: number;
  sharedGames: string[];
};

// Async version: fetches games from DB (use when profiles aren't already loaded)
export async function getCompatibilityScore(
  userAId: string,
  userBId: string
): Promise<CompatibilityResult> {
  const { data } = await supabase
    .from('profiles')
    .select('id, games')
    .in('id', [userAId, userBId]);

  if (!data || data.length < 2) return { score: 0, sharedGames: [] };

  const rows = data as { id: string; games: string[] }[];
  const a = rows.find((p) => p.id === userAId);
  const b = rows.find((p) => p.id === userBId);
  return calcCompatibility(
    Array.isArray(a?.games) ? a!.games : [],
    Array.isArray(b?.games) ? b!.games : []
  );
}

// Sync version: use when both game arrays are already available (e.g. user list)
export function calcCompatibility(gamesA: string[], gamesB: string[]): CompatibilityResult {
  const maxLen = Math.max(gamesA.length, gamesB.length);
  if (maxLen === 0) return { score: 0, sharedGames: [] };
  const sharedGames = gamesA.filter((g) => gamesB.includes(g));
  return { score: Math.round((sharedGames.length / maxLen) * 100), sharedGames };
}
