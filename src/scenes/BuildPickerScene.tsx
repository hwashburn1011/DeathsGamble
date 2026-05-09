import { useMemo, useEffect, useRef } from 'react';
import { GlassPanel } from '../ui/GlassPanel';
import { GlassButton } from '../ui/GlassButton';
import { useGameStore } from '../state/gameStore';
import { BUILDS } from '../data/builds';
import { WEAPONS_BY_ID } from '../data/weapons';
import { SPELLS_BY_ID } from '../data/spells';
import type { BuildDef } from '../types';
import { drawCharacter } from '../engine/charSprites';
import './buildpicker.css';

function rollBuilds(): BuildDef[] {
  const pool = [...BUILDS];
  const picks: BuildDef[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

export function BuildPickerScene() {
  const pickBuild = useGameStore((s) => s.pickBuild);
  const showScene = useGameStore((s) => s.showScene);
  const builds = useMemo(() => rollBuilds(), []);

  return (
    <div className="scene buildpicker-scene">
      <h2 className="display buildpicker-heading">Choose Your Build</h2>
      <p className="subtitle buildpicker-sub">Death has dealt three. Pick one.</p>

      <div className="build-options">
        {builds.map((b) => (
          <BuildCard key={b.id} build={b} onPick={() => pickBuild(b, WEAPONS_BY_ID[b.weapon])} />
        ))}
      </div>

      <div className="buildpicker-actions">
        <GlassButton variant="ghost" size="sm" onClick={() => showScene('modeselect')}>
          Back
        </GlassButton>
      </div>
    </div>
  );
}

interface BuildCardProps {
  build: BuildDef;
  onPick: () => void;
}

function BuildCard({ build, onPick }: BuildCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const w = WEAPONS_BY_ID[build.weapon];
  const spellList = build.spells.map((id) => SPELLS_BY_ID[id]?.name ?? id).join(', ') || 'None';

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 100;
    const H = 130;
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    drawCharacter(ctx, W / 2, 80, 3.5, build);
  }, [build]);

  return (
    <GlassPanel padding="md" hoverable onClick={onPick} className="build-card">
      <div className="build-portrait">
        <canvas ref={canvasRef} />
      </div>
      <h3 className="build-name">{build.name}</h3>
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
        <span className="weapon-row">{w.icon} {w.name}</span>
        <span className="spell-row">✦ {spellList}</span>
      </div>
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
