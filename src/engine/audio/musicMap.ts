// Scene → music URL map. All tracks by Eric Matyas / soundimage.org,
// CC-BY 4.0 (attribution in CreditsScene). Files live in
// public/assets/audio/music/.

import type { SceneName } from '../../types';

const BASE = import.meta.env.BASE_URL;
const M = (file: string) => `${BASE}assets/audio/music/${file}`;

export const MUSIC_BY_SCENE: Record<SceneName, string | null> = {
  title:       M('dark-fantasy-open.mp3'),
  intro:       M('dark-fantasy-open.mp3'),     // shares title music for continuity
  modeselect:  M('castle-lost.mp3'),
  buildpicker: M('secret-spells.mp3'),
  wheels:      M('chilly-whispers.mp3'),
  dungeon:     M('ghostly-enchantment.mp3'),  // overridden by boss raid (see App.tsx)
  shop:        M('castle-lost.mp3'),
  gameover:    null,                           // let it breathe
  win:         M('dark-fantasy-open.mp3'),
  credits:     M('castle-lost.mp3'),
};

/** Special-case: boss raid swaps the dungeon track. */
export const BOSS_MUSIC = M('attic-of-secrets.mp3');
