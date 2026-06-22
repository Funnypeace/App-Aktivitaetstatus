import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GameReview } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { submitReview, getGameReviews, getMyReview } from '../lib/reviews';
import { addXP } from '../lib/xp';

function Stars({
  rating,
  size = 16,
  interactive = false,
  onRate,
}: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRate?: (n: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onRate?.(n)} disabled={!interactive}>
          <Text style={{ fontSize: size, opacity: n <= rating ? 1 : 0.25 }}>⭐</Text>
        </Pressable>
      ))}
    </View>
  );
}

type ReviewWithUsername = GameReview & { username: string | null };

export default function GameReviews({
  userId,
  gameName,
  visible,
  onClose,
}: {
  userId: string;
  gameName: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [reviews, setReviews] = useState<ReviewWithUsername[]>([]);
  const [myReview, setMyReview] = useState<GameReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!gameName) return;
    setLoading(true);
    const [allRevs, mine] = await Promise.all([
      getGameReviews(gameName),
      getMyReview(userId, gameName),
    ]);
    setReviews(allRevs);
    setMyReview(mine);
    setMyRating(mine?.rating ?? 0);
    setMyText(mine?.review_text ?? '');
    setLoading(false);
  }

  useEffect(() => {
    if (visible && gameName) load();
  }, [visible, gameName]);

  async function handleSave() {
    if (!gameName || myRating === 0) return;
    setSaving(true);
    const isNew = !myReview;
    const ok = await submitReview(userId, gameName, myRating, myText.trim() || undefined);
    if (ok && isNew) addXP(userId, 15);
    await load();
    setSaving(false);
  }

  const avgRating =
    reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              🎮 {gameName}
            </Text>
            {reviews.length > 0 ? (
              <View style={styles.avgRow}>
                <Stars rating={Math.round(avgRating)} size={14} />
                <Text style={[styles.avgText, { color: colors.textMuted }]}>
                  {avgRating.toFixed(1)} · {reviews.length} Bewertung
                  {reviews.length !== 1 ? 'en' : ''}
                </Text>
              </View>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.ownSection, { backgroundColor: colors.cardAlt }]}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  Deine Bewertung
                </Text>
                <Stars rating={myRating} size={28} interactive onRate={setMyRating} />
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.card,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Deine Meinung (optional, max. 500 Zeichen)…"
                  placeholderTextColor={colors.textMuted}
                  value={myText}
                  onChangeText={setMyText}
                  multiline
                  maxLength={500}
                />
                <Pressable
                  style={[
                    styles.saveBtn,
                    { backgroundColor: colors.primary },
                    (myRating === 0 || saving) && { opacity: 0.5 },
                  ]}
                  disabled={myRating === 0 || saving}
                  onPress={handleSave}
                >
                  <Text style={[styles.saveBtnText, { color: colors.primaryText }]}>
                    {saving ? 'Speichern…' : myReview ? 'Aktualisieren' : 'Bewerten (+15 XP)'}
                  </Text>
                </Pressable>
              </View>

              {reviews.length > 0 ? (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                    Alle Bewertungen
                  </Text>
                  {reviews.map((r) => (
                    <View key={r.id} style={[styles.reviewRow, { backgroundColor: colors.cardAlt }]}>
                      <View style={styles.reviewHeader}>
                        <Text style={[styles.reviewUser, { color: colors.text }]}>
                          {r.username ?? 'Unbenannt'}
                          {r.user_id === userId ? ' (Du)' : ''}
                        </Text>
                        <Stars rating={r.rating} size={12} />
                      </View>
                      {r.review_text ? (
                        <Text style={[styles.reviewText, { color: colors.textMuted }]}>
                          {r.review_text}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </>
              ) : (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  Noch keine Bewertungen. Sei der Erste!
                </Text>
              )}
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
  card: { width: '100%', maxWidth: 480, maxHeight: '88%', borderRadius: 16, overflow: 'hidden' },
  header: { padding: 20, paddingBottom: 12, gap: 6 },
  title: { fontSize: 20, fontWeight: '700' },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avgText: { fontSize: 13 },
  loader: { padding: 40, alignItems: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  ownSection: { borderRadius: 12, padding: 14, gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { fontWeight: '700', fontSize: 15 },
  reviewRow: { borderRadius: 10, padding: 12, gap: 6 },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewUser: { fontSize: 14, fontWeight: '600', flex: 1 },
  reviewText: { fontSize: 13, lineHeight: 19 },
  empty: { textAlign: 'center', fontSize: 14, paddingVertical: 24 },
  closeBtn: { alignItems: 'center', paddingVertical: 14 },
  closeText: { fontSize: 14, fontWeight: '500' },
});
