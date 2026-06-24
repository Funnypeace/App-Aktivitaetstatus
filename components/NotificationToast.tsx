import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import {
  AppNotification,
  NOTIFICATION_META,
  NotificationType,
  playNotificationSound,
  showNotification as emitNotification,
  subscribeToNotifications,
  vibrateDevice,
} from '../lib/notifications';

const TOAST_DURATION = 3000;

type Prefs = {
  notifications_enabled: boolean;
  notif_levelup: boolean;
  notif_quests: boolean;
  notif_messages: boolean;
  notif_sound: boolean;
  notif_vibration: boolean;
};

const DEFAULT_PREFS: Prefs = {
  notifications_enabled: true,
  notif_levelup: true,
  notif_quests: true,
  notif_messages: true,
  notif_sound: true,
  notif_vibration: true,
};

type NotificationContextValue = {
  showNotification: typeof emitNotification;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within a NotificationProvider');
  return ctx;
}

function categoryAllowed(prefs: Prefs, type: NotificationType): boolean {
  if (!prefs.notifications_enabled) return false;
  const category = NOTIFICATION_META[type].category;
  switch (category) {
    case 'levelup':
      return prefs.notif_levelup;
    case 'quests':
      return prefs.notif_quests;
    case 'messages':
      return prefs.notif_messages;
    default:
      return true;
  }
}

export function NotificationProvider({
  userId,
  onAction,
  children,
}: {
  userId: string;
  onAction?: (n: AppNotification) => void;
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const prefsRef = useRef<Prefs>(DEFAULT_PREFS);

  // Load preferences once and keep them fresh when Settings changes them.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'notifications_enabled, notif_levelup, notif_quests, notif_messages, notif_sound, notif_vibration'
        )
        .eq('id', userId)
        .single();
      if (active && data) prefsRef.current = data as Prefs;
    })();

    const channel = supabase
      .channel(`notif-prefs:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Partial<Prefs>;
          prefsRef.current = { ...prefsRef.current, ...row };
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((n) => {
      const prefs = prefsRef.current;
      if (!categoryAllowed(prefs, n.type)) return;

      setToasts((prev) => [...prev, n]);
      if (prefs.notif_sound) playNotificationSound();
      if (prefs.notif_vibration) vibrateDevice();

      // Best-effort archive for the Notification Center.
      supabase
        .from('user_notifications')
        .insert({
          user_id: userId,
          type: n.type,
          title: n.title,
          message: n.message,
          action_link: n.actionLink ?? null,
        })
        .then(() => {});
    });
    return unsubscribe;
  }, [userId]);

  const value: NotificationContextValue = { showNotification: emitNotification };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <View style={styles.host} pointerEvents="box-none">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            notification={t}
            onDismiss={() => dismiss(t.id)}
            onAction={onAction}
          />
        ))}
      </View>
    </NotificationContext.Provider>
  );
}

function Toast({
  notification,
  onDismiss,
  onAction,
}: {
  notification: AppNotification;
  onDismiss: () => void;
  onAction?: (n: AppNotification) => void;
}) {
  const { colors } = useTheme();
  const meta = NOTIFICATION_META[notification.type];
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 220, useNativeDriver: true }),
      ]).start(() => onDismiss());
    }, TOAST_DURATION);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.card,
          borderLeftColor: meta.accent,
          shadowColor: '#000',
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={styles.icon}>{meta.icon}</Text>
      <Pressable style={styles.body} onPress={onDismiss}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={[styles.message, { color: colors.textMuted }]} numberOfLines={2}>
          {notification.message}
        </Text>
      </Pressable>
      {notification.actionLabel ? (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: meta.accent }]}
          onPress={() => {
            onAction?.(notification);
            onDismiss();
          }}
        >
          <Text style={styles.actionText}>{notification.actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 12 : 44,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    zIndex: 1000,
  },
  toast: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  icon: { fontSize: 22 },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 13, marginTop: 1 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  actionText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
