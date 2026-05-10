import { useMemo, useState } from 'react';
import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import { useSoulsStore } from '../state/soulsStore';
import { UnlocksModal } from '../ui/UnlocksModal';
import { BUILDS } from '../data/builds';
import { WEAPONS, WEAPONS_BY_ID } from '../data/weapons';
import { SPELLS_BY_ID } from '../data/spells';
import { isBuildUnlocked, UNLOCKS } from '../data/unlocks';
import { PLAYER_SPRITE_BY_BUILD, WEAPON_ICON_SPRITE } from '../engine/pixi/manifest';
import type { BuildDef, WeaponDef } from '../types';
import './buildpicker.css';

export function BuildPickerScene() {
  const pickBuild = useGameStore((s) => s.pickBuild);
  const showScene = useGameStore((s) => s.showScene);
  const [showUnlocks, setShowUnlocks] = useState(false);
  // Show all 8 builds — locked ones render as silhouettes (#172) with a
  // souls cost. Sort unlocked builds first so the player's pickable options
  // sit at the top of the grid.
  const purchased = useSoulsStore((s) => s.unlocked);
  const builds = useMemo(() => {
    return [...BUILDS].sort((a, b) => {
      const au = isBuildUnlocked(a.id, purchased);
      const bu = isBuildUnlocked(b.id, purchased);
      if (au === bu) return 0;
      return au ? -1 : 1;
    });
  }, [purchased]);

  return (
    <div className="scene buildpicker-scene">
      <h2 className="display buildpicker-heading">Choose Your Build</h2>
      <p className="subtitle buildpicker-sub">Pick a build. Each carries a unique weapon and spell.</p>

      <div className="build-options">
        {builds.map((b) => {
          const unlocked = isBuildUnlocked(b.id, purchased);
          const cost = UNLOCKS.find((u) => u.refId === b.id)?.cost;
          return (
            <BuildCard
              key={b.id}
              build={b}
              locked={!unlocked}
              cost={cost}
              onPick={(weapon) => pickBuild(b, weapon)}
            />
          );
        })}
      </div>

      <div className="buildpicker-actions">
        <GlassButton variant="ghost" size="sm" onClick={() => showScene('modeselect')}>
          Back
        </GlassButton>
        <GlassButton variant="ghost" size="sm" onClick={() => setShowUnlocks(true)}>
          Souls / Unlocks
        </GlassButton>
      </div>
      {showUnlocks && <UnlocksModal onClose={() => setShowUnlocks(false)} />}
    </div>
  );
}

interface BuildCardProps {
  build: BuildDef;
  onPick: (weapon: WeaponDef) => void;
  /** Locked builds (#172) render as silhouettes with a cost badge — clicking
   *  routes to the unlocks modal instead of selecting. */
  locked?: boolean;
  cost?: number;
}

function BuildCard({ build, onPick, locked = false, cost }: BuildCardProps) {
  const defaultWeapon = WEAPONS_BY_ID[build.weapon];
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponDef>(defaultWeapon);
  const [picking, setPicking] = useState(false);
  const spellList = build.spells.map((id) => SPELLS_BY_ID[id]?.name ?? id).join(', ') || 'None';
  const portraitUrl = PLAYER_SPRITE_BY_BUILD[build.id] ?? PLAYER_SPRITE_BY_BUILD['gambler'];

  return (
    <GlassPanel
      padding="md"
      hoverable={!picking && !locked}
      onClick={locked || picking ? undefined : () => onPick(selectedWeapon)}
      className={`build-card ${locked ? 'build-card--locked' : ''}`}
    >
      {locked && (
        <div className="build-locked-overlay">
          <div className="build-locked-icon">🔒</div>
          <div className="build-locked-cost">{cost ?? '—'} souls</div>
          <div className="build-locked-hint">Unlock from title screen</div>
        </div>
      )}
      <div className="build-portrait">
        <img src={portraitUrl} alt={build.name} className="build-portrait-img" />
      </div>
      <h3 className="build-name">{build.name}</h3>
      <p className="build-hook">{build.mechanicalHook}</p>
      <p className="build-desc">{build.desc}</p>
      <div className="build-stats">
        <Stat label="HP" value={String(build.baseHp)} />
        <Stat label="SPD" value={build.baseSpd.toFixed(1)} />
        <Stat label="DEF" value={String(build.baseDef)} />
        {build.baseLuck > 0 && (
          <Stat label="LUCK" value={build.baseLuck.toFixed(1)} highlight />
        )}
      </div>
      <div className="build-loadout">
        <span className="weapon-row">{selectedWeapon.icon} {selectedWeapon.name}</span>
        <span className="spell-row">✦ {spellList}</span>
        <button
          type="button"
          className="weapon-swap-btn"
          onClick={(e) => {
            e.stopPropagation();
            setPicking((p) => !p);
          }}
        >
          {picking ? 'Close ✕' : 'Swap weapon ⇄'}
        </button>
      </div>

      {picking && (
        <div className="weapon-grid" onClick={(e) => e.stopPropagation()}>
          {WEAPONS.map((w) => {
            const spriteUrl = WEAPON_ICON_SPRITE[w.id];
            return (
              <button
                key={w.id}
                type="button"
                className={`weapon-chip ${w.id === selectedWeapon.id ? 'weapon-chip--active' : ''}`}
                onClick={() => {
                  setSelectedWeapon(w);
                  setPicking(false);
                }}
                title={`${w.name} · ${w.dmg} DMG · ${w.atkspd.toFixed(1)} ATK · ${w.range} RNG`}
              >
                {spriteUrl ? (
                  <img src={spriteUrl} alt="" className="weapon-chip-sprite" />
                ) : (
                  <span className="weapon-chip-icon">{w.icon}</span>
                )}
                <span className="weapon-chip-name">{w.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}

interface StatProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function Stat({ label, value, highlight = false }: StatProps) {
  return (
    <div className="build-stat">
      <span className="build-stat-label">{label}</span>
      <span className={`build-stat-value ${highlight ? 'build-stat-value--gold' : ''}`}>
        {value}
      </span>
    </div>
  );
}
