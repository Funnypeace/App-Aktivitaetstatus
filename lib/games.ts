// Fest codierte Liste populärer Spiele für die Spiele-Auswahl.
//
// Zusammengesetzt aus:
//  - Claudios Favoriten (oben angepinnt),
//  - den aktuell meistgespielten Spielen auf Steam (SteamCharts/SteamDB, Top 50,
//    Juni 2026 – ohne reine Tools wie Wallpaper Engine, Bongo Cat, Crosshair X),
//  - sowie kritisch gefeierten "Best Games 2024–2026" (The Game Awards: u. a.
//    Clair Obscur: Expedition 33, Astro Bot, Balatro, Black Myth: Wukong,
//    Metaphor: ReFantazio, Final Fantasy VII Rebirth, Helldivers 2).
//
// Duplikate wurden entfernt. Die hier gespeicherten Strings sind zugleich die
// Anzeigenamen (kurz gehalten, z. B. "WoW", "ETS2"), die in der Nutzerliste
// erscheinen, etwa: "🟢 Claudio (WoW, ETS2)".

// Claudios Favoriten – stehen bewusst oben in der Liste.
export const FAVORITE_GAMES: string[] = [
  'WoW',
  'ETS2',
  'Rocket League',
  'Forza Horizon',
  'Palworld',
  'Valheim',
  'RuneScape',
  'ASKA',
  'Subnautica 2',
];

// Weitere populäre Spiele (Steam-Topliste + Award-Gewinner), alphabetisch.
const MORE_GAMES: string[] = [
  '7 Days to Die',
  'Among Us',
  'Apex Legends',
  'ARC Raiders',
  'Astro Bot',
  'Baldur’s Gate 3',
  'Balatro',
  'Battlefield 6',
  'Black Myth: Wukong',
  'Call of Duty: Black Ops 6',
  'Civilization VI',
  'Clair Obscur: Expedition 33',
  'Counter-Strike 2',
  'Cyberpunk 2077',
  'Dave the Diver',
  'DayZ',
  'Dead by Daylight',
  'Deep Rock Galactic',
  'Delta Force',
  'Destiny 2',
  'Diablo IV',
  'Don’t Starve Together',
  'Dota 2',
  'EA SPORTS FC 26',
  'Elden Ring',
  'Enshrouded',
  'Factorio',
  'Fall Guys',
  'Final Fantasy VII Rebirth',
  'Fortnite',
  'Genshin Impact',
  'Grand Theft Auto V',
  'Hades II',
  'Hearts of Iron IV',
  'Helldivers 2',
  'Hogwarts Legacy',
  'League of Legends',
  'Lethal Company',
  'Limbus Company',
  'Marvel Rivals',
  'Metaphor: ReFantazio',
  'Minecraft',
  'Monster Hunter Wilds',
  'Monster Hunter: World',
  'NARAKA: BLADEPOINT',
  'NBA 2K26',
  'No Man’s Sky',
  'Once Human',
  'Overwatch 2',
  'Path of Exile 2',
  'PAYDAY 2',
  'Phasmophobia',
  'PUBG: BATTLEGROUNDS',
  'R.E.P.O.',
  'Red Dead Redemption 2',
  'RimWorld',
  'Rust',
  'Satisfactory',
  'Sea of Thieves',
  'Slay the Spire 2',
  'Stardew Valley',
  'Subnautica',
  'Team Fortress 2',
  'Terraria',
  'The Finals',
  'The Witcher 3',
  'Rainbow Six Siege',
  'Valorant',
  'VRChat',
  'War Thunder',
  'Warframe',
];

// Finale Liste: Favoriten zuerst, danach der Rest (Duplikate entfernt).
export const GAMES: string[] = [
  ...FAVORITE_GAMES,
  ...MORE_GAMES.filter((g) => !FAVORITE_GAMES.includes(g)),
];

// Wie viele Spiele gleichzeitig ausgewählt werden dürfen.
export const MAX_GAMES = 3;
