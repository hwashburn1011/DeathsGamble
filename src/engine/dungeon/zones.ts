// Story-mode zone layout — chain of "rooms" the player walks through east-to-east.
// Each zone triggers a fixed enemy wave on first entry; raid completes when
// every zone is cleared. Boss + infinite + cavern-endless raids skip this and
// keep the open-arena Vampire-Survivors flow.

export interface Zone {
  /** World-space center. */
  cx: number;
  cy: number;
  /** Half-extents (rectangular footprint). */
  hw: number;
  hh: number;
  /** Number of enemies to spawn in this zone's wave. */
  spawnCount: number;
  /** Tier cap for this zone's spawns. Higher index = tougher enemies. */
  maxTier: number;
  /** True after wave is fully spawned. */
  triggered: boolean;
  /** True after every spawned enemy is dead. */
  cleared: boolean;
  /** Number of enemies tracked alive in this zone (decrement on kill). */
  aliveCount: number;
  /** Tint applied to the zone's floor patch (multiplicative). */
  tint: number;
  /** Display label for HUD ("Room 1", "Mini-Boss", etc.). */
  label: string;
}

/**
 * Build the zone chain for a story raid.
 * Raid 1 = 3 rooms, raid 2 = 4 rooms, raid 3+ = 5 rooms (boss raid handled
 * separately and won't call this).
 *
 * Layout: zones placed left-to-right starting at x=0 (player spawn) with
 * spacing = zone width + corridor. Player walks east through them.
 */
export function buildZones(raid: number, totalRaids: number): Zone[] {
  const isLateStory = raid >= totalRaids - 1;       // last non-boss raid
  const baseRoomCount = raid <= 1 ? 3 : raid === 2 ? 4 : 5;
  const ZONE_HW = 380;                              // half-width in world px
  const ZONE_HH = 280;                              // half-height
  const CORRIDOR = 360;                             // gap between zones
  const SPACING = ZONE_HW * 2 + CORRIDOR;

  const zones: Zone[] = [];
  for (let i = 0; i < baseRoomCount; i++) {
    const isLast = i === baseRoomCount - 1;
    const isMiniBoss = isLateStory && i === baseRoomCount - 2;
    const tier = isLast ? 4 : isMiniBoss ? 4 : Math.min(3, 1 + Math.floor(i * 0.7));
    // Wave size grows with raid + zone index. Final room is the biggest.
    const baseSpawn = isLast ? 14 : isMiniBoss ? 10 : 6 + i * 2;
    zones.push({
      cx: i * SPACING,
      cy: 0,
      hw: ZONE_HW,
      hh: ZONE_HH,
      spawnCount: baseSpawn,
      maxTier: tier,
      triggered: false,
      cleared: false,
      aliveCount: 0,
      // Cycle through subtle tints so adjacent rooms read as distinct.
      tint: [0xc8b890, 0x90a0c8, 0xb098a8, 0xa0c098][i % 4],
      label: isLast
        ? `Final Room`
        : isMiniBoss
          ? `Mini-Boss`
          : `Room ${i + 1}`,
    });
  }
  return zones;
}

/** True if the player is inside a zone's rectangular footprint. */
export function isPlayerInZone(playerX: number, playerY: number, z: Zone): boolean {
  return (
    Math.abs(playerX - z.cx) <= z.hw &&
    Math.abs(playerY - z.cy) <= z.hh
  );
}
