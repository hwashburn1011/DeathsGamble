// Master attribution list — kept in sync with public/assets/SOURCES.md.
// Rendered by the in-game CreditsScene.

export interface AssetCredit {
  name: string;
  author: string;
  license: string;
  url: string;
  category: 'tiles' | 'characters' | 'enemies' | 'ui' | 'icons' | 'audio' | 'fonts' | 'code';
  shipped: boolean; // true = currently bundled, false = recommended source
}

export const CREDITS: AssetCredit[] = [
  // ===== Tiles =====
  {
    name: 'Tiny Dungeon',
    author: 'Kenney',
    license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/tiny-dungeon',
    category: 'tiles',
    shipped: true,
  },
  {
    name: 'Dungeon Crawl 32×32 Tiles',
    author: 'Crawl Tiles project (various)',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    category: 'tiles',
    shipped: true,
  },

  // ===== UI =====
  {
    name: 'UI Pack',
    author: 'Kenney',
    license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/ui-pack',
    category: 'ui',
    shipped: true,
  },

  // ===== SFX =====
  {
    name: 'Impact Sounds',
    author: 'Kenney',
    license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/impact-sounds',
    category: 'audio',
    shipped: true,
  },

  // ===== Fonts =====
  {
    name: 'Cinzel (display)',
    author: 'Natanael Gama',
    license: 'OFL',
    url: 'https://fonts.google.com/specimen/Cinzel',
    category: 'fonts',
    shipped: true,
  },
  {
    name: 'Crimson Pro (body)',
    author: 'Sebastian Kosch',
    license: 'OFL',
    url: 'https://fonts.google.com/specimen/Crimson+Pro',
    category: 'fonts',
    shipped: true,
  },

  // ===== Code / engines =====
  {
    name: 'PixiJS',
    author: 'PixiJS team',
    license: 'MIT',
    url: 'https://pixijs.com',
    category: 'code',
    shipped: true,
  },
  {
    name: 'React',
    author: 'Meta + community',
    license: 'MIT',
    url: 'https://react.dev',
    category: 'code',
    shipped: true,
  },
  {
    name: 'Vite',
    author: 'Evan You + Vite contributors',
    license: 'MIT',
    url: 'https://vitejs.dev',
    category: 'code',
    shipped: true,
  },
  {
    name: 'Zustand',
    author: 'Poimandres',
    license: 'MIT',
    url: 'https://github.com/pmndrs/zustand',
    category: 'code',
    shipped: true,
  },

  // ===== Recommended (not yet shipped) =====
  {
    name: 'LPC Medieval Fantasy Character Sprites',
    author: 'Wulax + LPC contributors',
    license: 'CC-BY-SA 3.0',
    url: 'https://opengameart.org/content/lpc-medieval-fantasy-character-sprites',
    category: 'characters',
    shipped: false,
  },
  {
    name: '0x72 — DungeonTileset II',
    author: '0x72',
    license: 'CC0 1.0',
    url: 'https://0x72.itch.io/dungeontileset-ii',
    category: 'tiles',
    shipped: false,
  },
  {
    name: 'Reaper (Animated Pixel Art)',
    author: 'SamuelLee',
    license: 'Free use',
    url: 'https://samuellee.itch.io/reaper-animated-pixel-art',
    category: 'characters',
    shipped: false,
  },
  {
    name: 'Game-Icons.net',
    author: 'Lorc, Delapouite, et al.',
    license: 'CC-BY 3.0',
    url: 'https://game-icons.net',
    category: 'icons',
    shipped: false,
  },
  {
    name: 'Casino Audio',
    author: 'Kenney',
    license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/casino-audio',
    category: 'audio',
    shipped: false,
  },
  {
    name: 'Dark Ambience Soundscapes',
    author: 'yewbic',
    license: 'CC-BY-SA 3.0',
    url: 'https://opengameart.org/content/dark-ambience-soundscapes',
    category: 'audio',
    shipped: false,
  },
  {
    name: 'Soundimage.org music library',
    author: 'Eric Matyas',
    license: 'CC-BY 4.0',
    url: 'https://soundimage.org',
    category: 'audio',
    shipped: false,
  },
];

export const CATEGORY_LABEL: Record<AssetCredit['category'], string> = {
  characters: 'Character Sprites',
  enemies: 'Enemy Sprites',
  tiles: 'Tilesets',
  ui: 'UI Elements',
  icons: 'Iconography',
  audio: 'Audio',
  fonts: 'Typography',
  code: 'Engines & Libraries',
};
