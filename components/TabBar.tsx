import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../lib/theme';

export type TabKey = 'home' | 'messages' | 'chat' | 'settings';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home', label: 'Status', icon: '🏠' },
  { key: 'messages', label: 'Nachrichten', icon: '💬' },
  { key: 'chat', label: 'Global', icon: '🌐' },
  { key: 'settings', label: 'Einstellungen', icon: '⚙️' },
];

export default function TabBar({
  active,
  onChange,
  unread,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  unread: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.tabBar, borderTopColor: colors.border }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const showBadge = tab.key === 'messages' && unread > 0;
        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => onChange(tab.key)}>
            <View>
              <Text style={[styles.icon, { opacity: isActive ? 1 : 0.55 }]}>{tab.icon}</Text>
              {showBadge ? (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.primary : colors.tabInactive },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 22 },
  label: { fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
});
