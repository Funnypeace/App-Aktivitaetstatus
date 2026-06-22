import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';

// Common emojis offered in the reaction picker.
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '🎉', '🤔', '👌'];

export type ReactionRow = {
  id: string;
  target: string;
  user_id: string;
  emoji: string;
};

type ReactionTable = 'message_reactions' | 'chat_reactions';
type TargetColumn = 'message_id' | 'chat_message_id';

// Loads every reaction for the given table once, keeps it live via Realtime, and
// exposes an optimistic toggle. Shared by direct messages and the global chat.
export function useReactions(
  table: ReactionTable,
  targetColumn: TargetColumn,
  userId: string
) {
  const [rows, setRows] = useState<ReactionRow[]>([]);

  useEffect(() => {
    let active = true;
    const cols = `id, ${targetColumn}, user_id, emoji`;

    (async () => {
      const { data } = await supabase.from(table).select(cols);
      if (!active) return;
      setRows(
        ((data ?? []) as unknown as Record<string, string>[]).map((row) => ({
          id: row.id,
          target: row[targetColumn],
          user_id: row.user_id,
          emoji: row.emoji,
        }))
      );
    })();

    const channel = supabase
      .channel(`reactions:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new as Record<string, string>;
          setRows((prev) =>
            prev.some((x) => x.id === r.id)
              ? prev
              : [...prev, { id: r.id, target: r[targetColumn], user_id: r.user_id, emoji: r.emoji }]
          );
        } else if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string }).id;
          setRows((prev) => prev.filter((x) => x.id !== oldId));
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [table, targetColumn]);

  const toggle = useCallback(
    async (targetId: string, emoji: string) => {
      const existing = rows.find(
        (r) => r.target === targetId && r.user_id === userId && r.emoji === emoji
      );

      if (existing) {
        // Optimistically remove, then delete.
        setRows((prev) => prev.filter((r) => r.id !== existing.id));
        if (!existing.id.startsWith('temp-')) {
          await supabase.from(table).delete().eq('id', existing.id);
        }
        return;
      }

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      setRows((prev) => [...prev, { id: tempId, target: targetId, user_id: userId, emoji }]);

      const { data, error } = await supabase
        .from(table)
        .insert({ [targetColumn]: targetId, user_id: userId, emoji })
        .select(`id, ${targetColumn}, user_id, emoji`)
        .single();

      if (error || !data) {
        setRows((prev) => prev.filter((r) => r.id !== tempId));
        return;
      }
      const row = data as unknown as Record<string, string>;
      setRows((prev) =>
        prev.map((r) =>
          r.id === tempId
            ? { id: row.id, target: row[targetColumn], user_id: row.user_id, emoji: row.emoji }
            : r
        )
      );
    },
    [rows, table, targetColumn, userId]
  );

  return { rows, toggle };
}
