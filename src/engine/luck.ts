// Luck-biased segment selection + magnitude scaling (endless rounds + difficulty).

import type { GameMode, Difficulty, WheelSegment } from '../types';
import { DIFFICULTY } from '../data/difficulty';

/**
 * Pick a segment index using weighted random selection.
 * `luck = 0` is uniform random; higher luck biases toward segments
 * with higher `luckScore` (player-favorable: bigger boons / milder curses).
 *   weight = 1 + luck * (luckScore / maxScore)
 */
export function pickSegmentWithLuck(segments: WheelSegment[], luck: number): number {
  const scores = segments.map((s) => s.luckScore || 5);
  const maxScore = Math.max(...scores);
  const weights = scores.map((s) => 1 + luck * (s / maxScore));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < segments.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return segments.length - 1;
}

/**
 * Magnitude multiplier applied to a spin's segment effect at resolve time.
 * - Difficulty: only curses are scaled (easy 0.5×, hard 1.4×)
 * - Endless mode: both wheels grow 1.1^endlessRound (compounding)
 */
export function spinMagnitude(
  side: 'buff' | 'curse',
  mode: GameMode,
  difficulty: Difficulty,
  endlessRound: number
): number {
  const roundMult = mode === 'infinite' ? Math.pow(1.1, endlessRound) : 1.0;
  const diffMult = side === 'curse' ? DIFFICULTY[difficulty].curseMult : 1.0;
  return roundMult * diffMult;
}
