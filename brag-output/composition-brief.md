# Hyperframes Composition Brief: GamerCoPlay

## Objective
Create a ~20s Twitch/Discord-style hype reel for GamerCoPlay (gamercoplay.de) that quick-cuts through the real app UI.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: ~20 seconds (7 scenes)

## Source Material
- Project root: C:\Users\funny\Desktop\Claude\gamercoplay.de
- Primary files read: web/landing.html, lib/theme.tsx, components/HomeScreen.tsx, components/GlobalChat.tsx, components/TabBar.tsx, components/PresenceDot.tsx, app.json
- Product name: GamerCoPlay
- Tagline / strongest claim: "Finde deine Zocker-Crew. Spiel zusammen, nicht allein." / "niemand zockt mehr allein."
- Key UI to recreate: dark landing hero; profile card (Level 3 + purple XP bar); activity feed + status toggle; "Andere Nutzer" realtime presence list; Global Chat bubbles; feature grid; logo outro
- Copy that must appear verbatim:
  - "Finde deine Zocker-Crew."
  - "Spiel zusammen, nicht allein."
  - "Kostenlos & Open Community"
  - "Hallo, Funnypeace 👋"
  - "Level 3", "340 / 450 XP"
  - "Auf Online setzen" → "Online"
  - "Meine Aktivität", "Andere Nutzer"
  - "💬 Global Chat", "Herzlich Willkommen ;-)"
  - "Alles für deine Gaming-Community"
  - "GamerCoPlay", "gamercoplay.de"

## Creative Direction
- Tone preset: chaotic pacing + app-store cleanliness
- Creative direction: hype Discord/Twitch gaming community reel — neon glow, energetic, beat-synced quick cuts
- Interpretation: 7 fast cuts snapped to the beat; energy from motion/glow/tight cuts, never from flashing text. App panels stay clean and readable.
- Angle: walk through the real app waking up — hero → profile → go Online → community lights up → chat → features → logo slam.
- Hook: dark hero, green-neon "Spiel zusammen, nicht allein." slams in on the first beat.
- Outro / punchline: 🎮 GamerCoPlay logo slams in with neon glow on the 17.52s strong cue, "gamercoplay.de", fade to black.
- Avoid: generic SaaS language, abstract filler visuals, redesigning the UI, strobing, unreadable fast text.

## Visual Identity
- Background / canvas: #0f1117 (surfaces #161922, #1b1f2a, border #262b38)
- Text: #f3f5f8 on dark; #111827 on light app cards; muted #9aa4b2 / #6b7280
- Accent neon green: #639922 → #7fbf2e; online dot #4ade80 (landing) / #22c55e (app)
- In-app purple/indigo: #4f46e5 (XP bar, chat bubbles); chips #eef2ff bg / #4338ca text
- Display + body font: Inter (load from Google Fonts; weights 400-900)
- Visual references: dark hero w/ radial green glow + pulse badge; white rounded app cards glowing on dark; green status dots; purple XP bar; purple chat bubbles with emoji reaction chips; 4-up feature grid

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook / Landing hero — 3.0s — "Finde deine Zocker-Crew." + neon "Spiel zusammen, nicht allein." + pulse badge
2. Profile card — 3.0s — "Hallo, Funnypeace 👋", Level 3, purple XP bar fills 340→450, Streak/Quests
3. Activity + status toggle — 3.0s — "Meine Aktivität" feed; cursor taps "Auf Online setzen" → green "Online"
4. Andere Nutzer (realtime) — 3.0s — list where "max" flips Offline→Online, green dot pops in
5. Global Chat — 3.0s — purple bubbles pop in one by one with 👍/❤️ reactions
6. Feature grid — 2.5s — 4 cards (Live-Status, Direkt chatten, Squads & LFG, XP & Quests) stagger in
7. Outro / logo — 2.5s — 🎮 GamerCoPlay logo slam + neon glow + gamercoplay.de, fade to black

## Audio
- Audio role: dense rhythmic upbeat bed
- Audio arc: energetic bed from 0s, beat-locked cuts throughout, quick fade under the final logo
- Music: happy-beats-business-moves-vol-1-by-ende-dot-app.mp3 (120.19 BPM), volume 0.34
- Music treatment: start 0s, steady 0.34, fade to ~0 over the last ~0.4s under the logo
- Music cue guidance: bundled preset — copy `assets/music/cues/...vol-1....music-cues.json`. Scene cuts on beats 3.02 / 6.03 / 9.02 / 12.02 / 15.02 / 17.52. Lock outro logo to 17.52s strong cue (strength 1.00). Toggle flip ~7.52, max-online flip ~10.52, chat bubbles ~12.52 / 13.51.
- Audio-reactive treatment: subtle — a neon glow layer behind the active panel pulses on the beat grid (GSAP-driven, no waveform/EQ). If a per-frame RMS extraction helper ships with the hyperframes audio-reactive workflow, prefer it; otherwise beat-grid glow pulses are the documented substitute.
- Audio-coupled moments:
  - Scene 1 headline slam — soft impact
  - Scene 3 status tap — UI click + soft success pop
  - Scene 4 max flips Online — soft drop/pop
  - Scene 5 chat bubbles — card-slide per bubble
  - Scene 6 feature cards — drop per card
  - Scene 7 logo — impact bell
- SFX selection guidance: moderate density (~5-6 cues). interface/click for the tap, interface/drop for pops/cards, impact/impactBell_heavy_000 for the logo. Match each sound to the visible motion start.
- SFX analysis guidance: read `~/.claude/skills/brag/assets/sfx/sfx-analysis.md`; prefer low high-frequency-risk files for repeated drops.
- Exact SFX choice: Hyperframes picks filenames/timestamps/volume from the implemented animation.
- Audio files: copy chosen music + SFX into `brag-output/composition/assets/`.

## Hyperframes Instructions
- Single composition `index.html`, data-composition-id "main", 1920x1080, ~20s, one GSAP timeline on window.__timelines["main"], paused.
- Each scene is a `.clip` with data-start/data-duration/data-track-index; build the app panels as real HTML/CSS (Inter, exact colors above), shown glowing on the dark canvas — never simplified isolated cards stripped of context.
- Show at least one real UI/copy element from the project (we show many).
- Keep all text readable (≥0.8s settled for short labels, ≥1.2s for sentences); beats bias timing but readability wins.
- Include the music + SFX layer; music on a low track-index, each overlapping SFX on its own ascending track-index.
- Lock 1 major tween (logo) to the 17.52 strong cue (±0.15s); snap scene cuts to the beat grid (±0.10s). Mark with `// beat-locked` / `// beat-grid`.
- At least one visual element subtly reacts to the music (beat-grid glow pulse); document if RMS extraction unavailable.
- Use local asset paths relative to composition/ (never absolute).
- Run `npx hyperframes lint` (zero errors), validate, inspect, then render to ../brag.mp4.
