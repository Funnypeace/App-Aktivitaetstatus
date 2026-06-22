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
- **Row Level Security**: Jede:r Nutzer:in darf nur den **eigenen** Status ändern;
  alle angemeldeten Nutzer:innen dürfen Status lesen.
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
App.tsx                       # Einstiegspunkt, Session-Routing (Auth <-> Account)
components/Auth.tsx           # Login / Registrierung
components/Account.tsx        # Status-Toggle + Anzeige + Abmelden
lib/supabase.ts              # Supabase-Client (plattformabhängiges Storage)
supabase/migrations/*.sql    # Tabelle profiles + RLS-Policies + Trigger
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
| `updated_at` | `timestamptz` | letzte Änderung                   |

RLS-Policies: SELECT für alle Angemeldeten, INSERT/UPDATE nur für die eigene Zeile
(`auth.uid() = id`). Ein Trigger `on_auth_user_created` legt bei der Registrierung
automatisch eine Profilzeile an. Die Migration liegt unter
`supabase/migrations/` und ist bereits auf das Projekt angewendet.

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
