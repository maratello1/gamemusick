import { TrackItem, VibeStateConfig, VibeStateId } from '@/types/vibe';

export type GenrePackId = 'mix' | 'rap-phonk' | 'rock-metal' | 'electronic';

export interface GenrePackConfig {
  id: GenrePackId;
  label: string;
  artistsSummary: string;
  seedsByVibe: Record<VibeStateId, string[]>;
}

export const VIBE_STATES: Record<VibeStateId, VibeStateConfig> = {
  EXPLORE: {
    id: 'EXPLORE',
    label: 'Спокойная сцена',
    shortLabel: 'Спокойно',
    description: 'Исследование мира, меню, спокойная поездка или диалоги',
    accentHex: '#10B981',
    defaultSearchQuery: 'Deftones Entombed Kavinsky Nightcall Скриптонит Положение',
  },
  STEALTH: {
    id: 'STEALTH',
    label: 'Напряжение / Ночь',
    shortLabel: 'Напряжение',
    description: 'Темная локация, скрытность, ожидание контакта',
    accentHex: '#38BDF8',
    defaultSearchQuery: 'BONES HDMI Crystal Castles Kerosene Gesaffelstein',
  },
  COMBAT: {
    id: 'COMBAT',
    label: 'Экшен / Перестрелка',
    shortLabel: 'Экшен',
    description: 'Активное движение на экране, бой, погоня',
    accentHex: '#FF6A00',
    defaultSearchQuery: 'Travis Scott FEIN DVRST Close Eyes The Prodigy Omen',
  },
  BOSSFIGHT: {
    id: 'BOSSFIGHT',
    label: 'Максимальный замес / Клатч',
    shortLabel: 'Пик боя',
    description: 'Критический накал, вспышки урона, боссфайт или клатч',
    accentHex: '#EF4444',
    defaultSearchQuery: 'Deftones My Own Summer Linkin Park Faint Rammstein Sonne',
  },
  VICTORY: {
    id: 'VICTORY',
    label: 'Остывание после боя',
    shortLabel: 'После боя',
    description: 'Завершение схватки, чистый мелодичный вайб',
    accentHex: '#F59E0B',
    defaultSearchQuery: 'Deftones Change Кино Группа крови Kanye West Flashing Lights',
  },
};

export const GENRE_PACKS: Record<GenrePackId, GenrePackConfig> = {
  mix: {
    id: 'mix',
    label: 'Все лучшее (Рок + Рэп + Электроника)',
    artistsSummary: 'Deftones, Travis Scott, Linkin Park, Скриптонит, Rammstein, Кино, The Prodigy',
    seedsByVibe: {
      EXPLORE: [
        'Deftones - Entombed',
        'Kavinsky - Nightcall',
        'Скриптонит - Положение',
        'Кино - Спокойная ночь',
        'Arctic Monkeys - Do I Wanna Know',
        'Radiohead - Everything In Its Right Place',
      ],
      STEALTH: [
        'BONES - HDMI',
        'Crystal Castles - Kerosene',
        'Gesaffelstein - Aleph',
        'Massive Attack - Angel',
        'DVRST - Close Eyes',
        'PHARAOH - Black Siemens',
      ],
      COMBAT: [
        'Travis Scott - FE!N',
        'The Prodigy - Omen',
        'Denzel Curry - ULTIMATE',
        'Pendulum - Propane Nightmares',
        'Big Baby Tape & kizaru - 99 Problems',
        'Playboi Carti - Sky',
      ],
      BOSSFIGHT: [
        'Deftones - My Own Summer (Shove It)',
        'Linkin Park - Faint',
        'Rammstein - Sonne',
        'Slipknot - Duality',
        'Bring Me The Horizon - Kingslayer',
        'System Of A Down - Chop Suey!',
      ],
      VICTORY: [
        'Deftones - Change (In the House of Flies)',
        'Кино - Группа крови',
        'Kanye West - Flashing Lights',
        'Linkin Park - In the End',
        'Gorillaz - Feel Good Inc',
      ],
    },
  },
  'rap-phonk': {
    id: 'rap-phonk',
    label: 'Рэп, Трэп и Фонк',
    artistsSummary: 'Travis Scott, Playboi Carti, Скриптонит, BONES, $uicideboy$, Denzel Curry, DVRST, Miyagi',
    seedsByVibe: {
      EXPLORE: [
        'Скриптонит - Положение',
        'A$AP Rocky - Sundress',
        'Miyagi & Эндшпиль - Silhouette',
        'Kanye West - Flashing Lights',
        'Travis Scott - SDP Interlude',
        'SALUKI - ОГНЕЙ',
      ],
      STEALTH: [
        'BONES - HDMI',
        '$uicideboy$ - Paris',
        'DVRST - Close Eyes',
        'INTERWORLD - METAMORPHOSIS',
        'PHARAOH - Black Siemens',
        '21 Savage - redrum',
      ],
      COMBAT: [
        'Travis Scott - FE!N',
        'Playboi Carti - Sky',
        'Denzel Curry - ULTIMATE',
        'Big Baby Tape & kizaru - 99 Problems',
        'Future & Metro Boomin - Like That',
        'Yeat - If We Being Rëal',
      ],
      BOSSFIGHT: [
        'Playboi Carti - Stop Breathing',
        'Travis Scott - HYAENA',
        'Ghostemane - Mercury: Retrograde',
        'Denzel Curry - Sumo',
        'BONES - RestInPeace',
        'XXXTENTACION - Look At Me!',
      ],
      VICTORY: [
        'Kanye West - Stronger',
        'A$AP Rocky - Praise The Lord',
        'Miyagi & Эндшпиль - I Got Love',
        'Travis Scott - Goosebumps',
      ],
    },
  },
  'rock-metal': {
    id: 'rock-metal',
    label: 'Рок, Альтернатива и Метал',
    artistsSummary: 'Deftones, Linkin Park, Rammstein, Slipknot, System Of A Down, Metallica, Nirvana, Кино',
    seedsByVibe: {
      EXPLORE: [
        'Deftones - Sextape',
        'Кино - Спокойная ночь',
        'Arctic Monkeys - 505',
        'Radiohead - Karma Police',
        'Nirvana - Come As You Are',
        'Три дня дождя - Отпускай',
      ],
      STEALTH: [
        'Deftones - Change (In the House of Flies)',
        'Muse - Supermassive Black Hole',
        'Rammstein - Mein Herz Brennt',
        'Linkin Park - Somewhere I Belong',
        'Король и Шут - Кукла колдуна',
      ],
      COMBAT: [
        'Linkin Park - Faint',
        'Deftones - Be Quiet and Drive (Far Away)',
        'Bring Me The Horizon - Throne',
        'Nirvana - Smells Like Teen Spirit',
        'Muse - Hysteria',
        'Кино - Группа крови',
      ],
      BOSSFIGHT: [
        'Deftones - My Own Summer (Shove It)',
        'Rammstein - Sonne',
        'Slipknot - Duality',
        'System Of A Down - Chop Suey!',
        'Metallica - Master of Puppets',
        'Bring Me The Horizon - Kingslayer',
      ],
      VICTORY: [
        'Linkin Park - In the End',
        'Deftones - Rosemary',
        'System Of A Down - Aerials',
        'Король и Шут - Лесник',
      ],
    },
  },
  electronic: {
    id: 'electronic',
    label: 'Электроника, Синт и Драм-н-бейс',
    artistsSummary: 'The Prodigy, Pendulum, Kavinsky, Crystal Castles, Gesaffelstein, Daft Punk',
    seedsByVibe: {
      EXPLORE: [
        'Kavinsky - Nightcall',
        'Daft Punk - Veridis Quo',
        'M83 - Midnight City',
        'Aphex Twin - Xtal',
        'Burial - Archangel',
      ],
      STEALTH: [
        'Crystal Castles - Kerosene',
        'Gesaffelstein - Aleph',
        'Massive Attack - Angel',
        'Portishead - Roads',
        'Skeler - Tel Aviv',
      ],
      COMBAT: [
        'The Prodigy - Omen',
        'Pendulum - Propane Nightmares',
        'Gesaffelstein - Pursuit',
        'Justice - Stress',
        'The Prodigy - Invaders Must Die',
      ],
      BOSSFIGHT: [
        'The Prodigy - Breathe',
        'Pendulum - Watercolour',
        'The Chemical Brothers - Block Rockin Beats',
        'Carpenter Brut - Turbo Killer',
        'Perturbator - Future Club',
      ],
      VICTORY: [
        'Daft Punk - Instant Crush',
        'Gorillaz - Feel Good Inc',
        'The Weeknd - Blinding Lights',
      ],
    },
  },
};

export const INITIAL_ARTIST_SEEDS = GENRE_PACKS.mix.seedsByVibe;
export const INITIAL_GAME_PROFILES = [];

export const FALLBACK_REAL_TRACKS: TrackItem[] = [
  {
    id: 'deftones-entombed',
    videoId: 'sTPn4Jlrjb0',
    title: 'Entombed',
    artist: 'Deftones',
    album: 'Koi No Yokan',
    duration: '04:59',
    thumbnail: 'https://i.ytimg.com/vi/sTPn4Jlrjb0/hqdefault.jpg',
    vibe: 'EXPLORE',
    genreTag: 'Alternative',
  },
  {
    id: 'kavinsky-nightcall',
    videoId: 'MV_3Dpw-BRY',
    title: 'Nightcall',
    artist: 'Kavinsky',
    album: 'OutRun',
    duration: '04:18',
    thumbnail: 'https://i.ytimg.com/vi/MV_3Dpw-BRY/hqdefault.jpg',
    vibe: 'EXPLORE',
    genreTag: 'Electronic',
  },
  {
    id: 'travis-fein',
    videoId: 'B9synWjqBn8',
    title: 'FE!N (feat. Playboi Carti)',
    artist: 'Travis Scott',
    album: 'UTOPIA',
    duration: '03:11',
    thumbnail: 'https://i.ytimg.com/vi/B9synWjqBn8/hqdefault.jpg',
    vibe: 'COMBAT',
    genreTag: 'Hip-Hop/Rap',
  },
  {
    id: 'deftones-summer',
    videoId: 'XOzs1FehYOA',
    title: 'My Own Summer (Shove It)',
    artist: 'Deftones',
    album: 'Around the Fur',
    duration: '03:35',
    thumbnail: 'https://i.ytimg.com/vi/XOzs1FehYOA/hqdefault.jpg',
    vibe: 'BOSSFIGHT',
    genreTag: 'Alt Metal',
  },
  {
    id: 'linkin-faint',
    videoId: 'LYU-8IFcDPw',
    title: 'Faint',
    artist: 'Linkin Park',
    album: 'Meteora',
    duration: '02:42',
    thumbnail: 'https://i.ytimg.com/vi/LYU-8IFcDPw/hqdefault.jpg',
    vibe: 'BOSSFIGHT',
    genreTag: 'Rock',
  },
];
