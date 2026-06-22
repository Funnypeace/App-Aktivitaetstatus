import { Platform, Vibration } from 'react-native';

// All notification kinds the app can raise. Each maps to display metadata and
// a preference "category" used for per-user opt-out.
export type NotificationType =
  | 'level_up'
  | 'quest_complete'
  | 'achievement_unlocked'
  | 'badge_earned'
  | 'friend_online'
  | 'new_message'
  | 'chat'
  | 'session_joined'
  | 'squad';

export type NotificationCategory = 'levelup' | 'quests' | 'messages' | 'social';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actionLink?: string;
  actionLabel?: string;
};

export type NotificationMeta = {
  icon: string;
  // Accent colour for the toast's left edge / icon. Picked to read well in
  // both light and dark themes.
  accent: string;
  defaultTitle: string;
  category: NotificationCategory;
};

export const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  level_up:             { icon: '🎉', accent: '#F59E0B', defaultTitle: 'Level Up!',          category: 'levelup' },
  quest_complete:       { icon: '✅', accent: '#10B981', defaultTitle: 'Quest abgeschlossen', category: 'quests' },
  achievement_unlocked: { icon: '🏆', accent: '#8B5CF6', defaultTitle: 'Achievement',         category: 'quests' },
  badge_earned:         { icon: '🎖️', accent: '#8B5CF6', defaultTitle: 'Badge erhalten',      category: 'quests' },
  friend_online:        { icon: '👋', accent: '#22C55E', defaultTitle: 'Jetzt online',        category: 'social' },
  new_message:          { icon: '💬', accent: '#3B82F6', defaultTitle: 'Neue Nachricht',      category: 'messages' },
  chat:                 { icon: '🌐', accent: '#3B82F6', defaultTitle: 'Global Chat',         category: 'messages' },
  session_joined:       { icon: '🎮', accent: '#06B6D4', defaultTitle: 'Session',             category: 'social' },
  squad:                { icon: '👥', accent: '#EC4899', defaultTitle: 'Squad',               category: 'social' },
};

// --- Lightweight event bus -------------------------------------------------
// Plain modules (lib/xp.ts, lib/achievements.ts, …) can't use React hooks, so
// they push notifications through this module-level emitter. The
// NotificationProvider is the single subscriber that renders them.

type Listener = (n: AppNotification) => void;
const listeners = new Set<Listener>();

export function subscribeToNotifications(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `notif-${Date.now()}-${counter}`;
}

// Raise a notification from anywhere in the app (hook or plain function).
export function showNotification(
  type: NotificationType,
  message: string,
  opts?: { title?: string; actionLink?: string; actionLabel?: string }
): void {
  const meta = NOTIFICATION_META[type];
  const notification: AppNotification = {
    id: nextId(),
    type,
    title: opts?.title ?? meta.defaultTitle,
    message,
    actionLink: opts?.actionLink,
    actionLabel: opts?.actionLabel,
  };
  for (const fn of listeners) fn(notification);
}

// --- Sound / vibration -----------------------------------------------------

// Short blip via the Web Audio API on web; no-op (best-effort) elsewhere since
// no audio asset is bundled.
export function playNotificationSound(): void {
  try {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const Ctx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch {
    // best-effort
  }
}

export function vibrateDevice(): void {
  try {
    if (Platform.OS === 'web') {
      (navigator as unknown as { vibrate?: (ms: number) => void }).vibrate?.(60);
    } else {
      Vibration.vibrate(60);
    }
  } catch {
    // best-effort
  }
}
