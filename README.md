# App-Aktivitätsstatus

Cross-Platform-App (Web + Android) mit **Login** und **manuellem Online-Status**.
Eine gemeinsame Codebasis mit **Expo / React Native**, Backend über **Supabase**
(Auth + Postgres), Web-Deployment über **Vercel**, native APK über **EAS Build**.

## Features

- **Auth**: Registrierung & Login per E-Mail + Passwort (Supabase Auth).
- **Manueller Status**: Toggle-Button setzt den eigenen Status auf *Online* oder
  *Offline*. Kein automatisches Presence-Tracking.
- **Anzeige**: Eigener Status mit farbigem Punkt (🟢 grün = online, ⚪ grau = offline).
- **Spiele-Auswahl**: Nutzer:innen können 1–3 Spiele aus einer kuratierten Liste
  (~80 populäre Titel: Claudios Favoriten + aktuelle Steam-Topliste + Award-
  Gewinner 2024–2026) auswählen. Auswahl per Such- und Checkbox-Dialog, Anzeige
  als Chips.
- **Nutzerliste**: Unter dem eigenen Status alle anderen registrierten Nutzer mit
  Name, Status und gerade gespielten Spielen (z. B. „🟢 Claudio (WoW, ETS2)“);
  per Pull-to-Refresh aktualisierbar und **live** über Supabase Realtime
  (Status- und Spiele-Änderungen anderer erscheinen sofort ohne Neuladen).
- **Last-Seen / Aktivitäts-Log**: `last_seen` wird bei jeder Aktivität
  (Status-Toggle, Spiel-Änderung, Nachricht, Login) aktualisiert. Offline-Nutzer
  in der Liste zeigen „zuletzt vor 3 Stunden“; im Account- und Profil-Screen gibt
  es ein Aktivitäts-Log der letzten 10 Events.
- **Dark / Light Mode**: Theme-Umschalter im Einstellungen-Screen, persistiert in
  `profiles.theme` und beim App-Start geladen. Globaler Theme-Context, konsistent
  auf Web und Native.
- **Profil-Seite**: Klick auf einen Namen (Nutzerliste, Chat, Nachrichten) öffnet
  ein Profil-Modal: Username, „Mitglied seit …“, Online-Status, Spiele-Chips,
  Last-Seen, Achievements/Stats (Platzhalter), Aktivitäts-Log und
  „Nachricht senden“.
- **Direktnachrichten**: Konversationsliste (ungelesene oben, sonst alphabetisch)
  mit Unread-Badge, Chat-Ansicht, „Mark as read“ beim Öffnen, Live über Realtime.
- **Global Chat**: öffentlicher Chat für alle Angemeldeten, Lazy-Load der letzten
  50 Nachrichten, Live über Realtime.
- **Custom Status**: Status-Emoji + kurzer Status-Text (z. B. „🎮 Playing WoW“),
  editierbar in den Einstellungen, angezeigt in Nutzerliste, Account- und Profil-
  Screen, live über Realtime.
- **Bio / Über mich**: Freitext (max. 200 Zeichen) in den Einstellungen,
  angezeigt im Profil-Modal und Account-Screen.
- **Presence / Live-Indikator**: dreistufig — pulsierender grüner Punkt = gerade
  aktiv (`is_active` + `last_seen` < 5 Min), statisch grün = online, grau =
  offline. App-Foreground/Background wird via Visibility/AppState getrackt.
- **Emoji-Reactions**: Reaktionen (👍 ❤️ 😂 🔥 …) auf jede DM- und Global-Chat-
  Nachricht, optimistisch, live über Realtime; Klick toggelt die eigene Reaction.
- **Badges / Titel**: automatisch vergebene Auszeichnungen (Early Bird 🐦, Social
  Legend 💬, Game Master 🎮, Speedrunner ⚡, Achievement Hunter 🏆, Streamer 🎬).
  Anzeige im Profil-Modal, Account-Screen und (Top-Badges) in der Nutzerliste.
- **Gaming-Stats, Achievements & Ranking**: Top-Spiele als Balkendiagramm,
  8 freischaltbare Achievements und eine 5-fach-Rangliste (Aktivität,
  Achievements, Spiele, Social, Älteste Mitglieder).
- **Row Level Security**: Jede:r Nutzer:in darf nur den **eigenen** Status/Profil
  ändern; Status/Profile/Chat sind lesbar für alle Angemeldeten; DMs nur für
  Sender/Empfänger.
- **Session-Persistenz**: AsyncStorage auf Mobile, localStorage im Web.

## Tech-Stack

| Bereich        | Technologie                                   |
| -------------- | --------------------------------------------- |
| App-Framework  | Expo SDK 51 / React Native (Web + Android)    |
| Backend        | Supabase (Auth + Postgres + RLS)              |
| Web-Hosting    | Vercel (`expo export --platform web` → `dist`)|
| Android-Build  | EAS Build (APK über `preview`-Profil)         |

## Projektstruktur

```
App.tsx                       # Einstiegspunkt: Auth, Theme/Profil-Load, dann Main
components/Main.tsx           # Tab-Navigation, Profil-Modal, Unread-Badge, Nav-Context
components/Auth.tsx           # Login / Registrierung
components/Account.tsx        # Status-Toggle + Spiele + Nutzerliste + Aktivitäts-Log
components/Messages.tsx       # Direktnachrichten (Konversationsliste + Chat-Ansicht)
components/GlobalChat.tsx     # Öffentlicher Global-Chat
components/Settings.tsx       # Status & Bio + Theme-Toggle + Abmelden
components/ProfileModal.tsx   # Profil-Details (Status, Bio, Stats, Achievements, Badges)
components/ActivityLog.tsx    # Wiederverwendbare Liste der letzten 10 Events
components/GameStats.tsx      # Top-5-Spiele als Balkendiagramm
components/AchievementList.tsx# Achievement-Raster (freigeschaltet/gesperrt)
components/Leaderboard.tsx    # 5-fach-Rangliste
components/Reactions.tsx      # Emoji-Reaction-Leiste pro Nachricht
components/BadgeList.tsx      # Verdiente Badges eines Nutzers
components/PresenceDot.tsx    # Presence-Punkt (pulsierend = aktiv)
components/TabBar.tsx         # Untere Tab-Leiste
lib/supabase.ts              # Supabase-Client + Typen (Profile, Message, …)
lib/theme.tsx                # Theme-Context, Light-/Dark-Paletten, useTheme()
lib/nav.tsx                  # In-App-Navigation (openProfile / openConversation)
lib/activity.ts              # logActivity() + touchLastSeen()
lib/presence.ts              # Presence-Logik (presenceOf, setActive)
lib/stats.ts                 # Gaming-Stats (updateGameStats, fetchGameStats)
lib/achievements.ts          # checkAndUnlockAchievements()
lib/badges.ts                # Badge-Definitionen + checkAndUnlockBadges()
lib/reactions.ts             # useReactions() Hook (Realtime + optimistisch)
lib/time.ts                  # timeAgo() / memberSince() / clockTime()
lib/games.ts                 # kuratierte Spiele-Liste
supabase/migrations/*.sql    # Tabellen + RLS-Policies + Trigger + Realtime
eas.json                      # EAS-Build-Profile (preview => APK)
vercel.json                   # Vercel-Build-Konfiguration
.env.example                  # EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY
```

## Lokale Entwicklung

```bash
npm install               # .env mit den öffentlichen Keys ist bereits im Repo
npm run web               # Web im Browser
npm run android           # Android (Emulator/Gerät, Expo Go oder Dev-Build)
```

## Umgebungsvariablen

Beide Plattformen lesen dieselben `EXPO_PUBLIC_*`-Variablen (zur Build-Zeit eingebettet):

| Variable                        | Wert                                         |
| ------------------------------- | -------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | `https://mnrtjrksfgfygzmzifyy.supabase.co`   |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | öffentlicher Anon-Key (siehe `.env.example`) |

> Der Anon-Key ist absichtlich öffentlich – der Datenzugriff wird durch RLS
> geschützt. Im Supabase-Dashboard jederzeit rotierbar.

## Datenbank

Tabelle `public.profiles`:

| Spalte       | Typ           | Beschreibung                      |
| ------------ | ------------- | --------------------------------- |
| `id`         | `uuid` (PK)   | FK → `auth.users(id)`             |
| `username`   | `text`        | Anzeigename                       |
| `is_online`  | `boolean`     | manueller Status (default `false`)|
| `games`      | `jsonb`       | gewählte Spiele als JSON-Array (default `[]`) |
| `theme`      | `text`        | `'light'` \| `'dark'` (default `'light'`) |
| `last_seen`  | `timestamptz` | letzte Aktivität                  |
| `created_at` | `timestamptz` | Registrierungsdatum (für „Mitglied seit …“) |
| `updated_at` | `timestamptz` | letzte Änderung                   |
| `status_emoji` | `text`      | Custom-Status-Emoji (nullable)    |
| `status_text`  | `text`      | Custom-Status-Text, max. 30 Z. (nullable) |
| `bio`          | `text`      | Über-mich-Text, max. 200 Z. (nullable) |
| `is_active`    | `boolean`   | App gerade im Foreground (default `false`) |

Weitere Tabellen (alle mit RLS + Realtime):

- `public.activity_events` (`id`, `user_id`, `type`, `details`, `created_at`) –
  Aktivitäts-Log. SELECT für alle Angemeldeten, INSERT nur eigene Zeilen.
- `public.messages` (`id`, `sender_id`, `recipient_id`, `content`, `read`,
  `created_at`) – Direktnachrichten. SELECT nur als Sender/Empfänger, INSERT nur
  als Sender, UPDATE (read-Flag) nur als Empfänger.
- `public.chat_messages` (`id`, `user_id`, `username`, `content`, `created_at`) –
  Global-Chat. SELECT für alle Angemeldeten, INSERT nur als man selbst.
- `public.user_game_statistics` / `public.achievements` /
  `public.user_achievements` – Gaming-Stats & Achievements (Phase 2).
- `public.message_reactions` (`id`, `message_id`, `user_id`, `emoji`,
  `created_at`) & `public.chat_reactions` (`id`, `chat_message_id`, `user_id`,
  `emoji`, `created_at`) – Emoji-Reactions. SELECT für alle Angemeldeten,
  INSERT/DELETE nur eigene Reactions. Unique je (Nachricht, Nutzer, Emoji).
- `public.user_badges` (`id`, `user_id`, `badge_name`, `icon`, `earned_at`) –
  verdiente Badges. SELECT für alle Angemeldeten, INSERT nur eigene Zeilen.

RLS-Policies für `profiles`: SELECT für alle Angemeldeten, INSERT/UPDATE nur für
die eigene Zeile (`auth.uid() = id`). Ein Trigger `on_auth_user_created` legt bei
der Registrierung automatisch eine Profilzeile an. Die Migrationen liegen unter
`supabase/migrations/` und sind bereits auf das Projekt angewendet.

## Web-Deployment (Vercel)

`vercel.json` ist konfiguriert:

- Build: `npx expo export --platform web`
- Output: `dist`

Die öffentlichen `EXPO_PUBLIC_*`-Werte stehen in der committeten `.env`, die Expo
beim `expo export` automatisch lädt – so läuft der Build ohne weitere Konfiguration.
Alternativ können die Werte als Environment Variables im Vercel-Projekt hinterlegt
werden. (Hinweis: Vercel begrenzt `buildCommand` auf 256 Zeichen, daher werden die
Keys nicht inline im Befehl übergeben.)

## Android-APK (EAS Build)

Das `preview`-Profil ist auf **APK** (statt AAB) gestellt:

```jsonc
"preview": { "android": { "buildType": "apk" } }
```

Build starten:

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Beim ersten Lauf verknüpft EAS das Projekt (legt eine `projectId` an). Das
Ergebnis ist eine direkt installierbare `.apk`. Das `production`-Profil liefert
ein `app-bundle` (`.aab`) für den Play Store.
