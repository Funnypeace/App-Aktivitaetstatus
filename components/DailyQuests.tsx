import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DailyQuest, UserDailyQuest } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import {
  getDailyQuests,
  getUserDailyProgress,
  ensureDailyQuestProgress,
  claimQuestReward,
} from '../lib/quests';

type QuestWithProgress = DailyQuest & { userQuest?: UserDailyQuest };

export default function DailyQuests({
  userId,
  visible,
  onClose,
}: {
  userId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [quests, setQuests] = useState<QuestWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    await ensureDailyQuestProgress(userId);
    const [allQuests, progress] = await Promise.all([
      getDailyQuests(),
      getUserDailyProgress(userId),
    ]);
    const byQuestId = Object.fromEntries(progress.map((p) => [p.quest_id, p]));
    setQuests(allQuests.map((q) => ({ ...q, userQuest: byQuestId[q.id] })));
    setLoading(false);
  }

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  async function claim(userQuestId: string) {
    setClaiming(userQuestId);
    await claimQuestReward(userId, userQuestId);
    await load();
    setClaiming(null);
  }

  const claimed = quests.filter((q) => q.userQuest?.claimed).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>📋 Tägliche Quests</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {claimed}/{quests.length} abgeschlossen
            </Text>
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {quests.map((quest) => {
                const uq = quest.userQuest;
                const progress = uq?.progress ?? 0;
                const pct = Math.min(Math.round((progress / quest.target) * 100), 100);
                const isDone = uq?.completed ?? false;
                const isClaimed = uq?.claimed ?? false;

                return (
                  <View
                    key={quest.id}
                    style={[
                      styles.questRow,
                      { backgroundColor: colors.cardAlt },
                      isClaimed && { opacity: 0.55 },
                    ]}
                  >
                    <Text style={styles.questIcon}>{quest.icon}</Text>
                    <View style={styles.questInfo}>
                      <View style={styles.questTitleRow}>
                        <Text style={[styles.questName, { color: colors.text }]}>{quest.name}</Text>
                        <Text style={[styles.questXp, { color: colors.primary }]}>
                          +{quest.xp_reward} XP
                        </Text>
                      </View>
                      <Text style={[styles.questDesc, { color: colors.textMuted }]} numberOfLines={2}>
                        {quest.description}
                      </Text>
                      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              backgroundColor: colors.primary,
                              width: `${pct}%` as `${number}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressText, { color: colors.textMuted }]}>
                        {progress}/{quest.target}
                      </Text>
                    </View>
                    <View style={styles.questAction}>
                      {isClaimed ? (
                        <Text style={styles.claimedMark}>✅</Text>
                      ) : isDone ? (
                        <Pressable
                          style={[styles.claimBtn, { backgroundColor: colors.primary }]}
                          disabled={claiming === uq?.id}
                          onPress={() => uq && claim(uq.id)}
                        >
                          <Text style={[styles.claimText, { color: colors.primaryText }]}>
                            {claiming === uq?.id ? '…' : 'Claim'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>Schließen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 480, maxHeight: '85%', borderRadius: 16, overflow: 'hidden' },
  header: { padding: 20, paddingBottom: 12, gap: 2 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13 },
  loader: { padding: 40, alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  questRow: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  questIcon: { fontSize: 22, marginTop: 2 },
  questInfo: { flex: 1, gap: 4 },
  questTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questName: { fontSize: 14, fontWeight: '700', flex: 1 },
  questXp: { fontSize: 12, fontWeight: '700' },
  questDesc: { fontSize: 12, lineHeight: 17 },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 11, marginTop: 2 },
  questAction: { alignItems: 'center', justifyContent: 'center', minWidth: 50 },
  claimedMark: { fontSize: 20 },
  claimBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  claimText: { fontSize: 12, fontWeight: '700' },
  closeBtn: { alignItems: 'center', paddingVertical: 14 },
  closeText: { fontSize: 14, fontWeight: '500' },
});
