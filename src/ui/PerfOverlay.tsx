import { useEffect, useState } from 'react';
import './perf-overlay.css';

/** Minimal frame-rate HUD. Toggle with Shift+P. */
export function PerfOverlay() {
  const [visible, setVisible] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'P' && e.shiftKey) setVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let last = performance.now();
    let raf = 0;
    let frames = 0;
    let acc = 0;
    let maxFrame = 0;
    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      frames++;
      acc += dt;
      maxFrame = Math.max(maxFrame, dt);
      if (acc >= 500) {
        setFps(Math.round((frames * 1000) / acc));
        setFrameMs(Number(maxFrame.toFixed(1)));
        frames = 0;
        acc = 0;
        maxFrame = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;
  const dg = (window as unknown as { __DG?: Record<string, unknown> }).__DG;
  const ents = (dg?.entityCounts as { enemies: number; particles: number; projectiles: number } | undefined);

  return (
    <div className="perf-overlay" aria-hidden="true">
      <div className="perf-row"><span>FPS</span><b className={fps < 50 ? 'perf-warn' : ''}>{fps}</b></div>
      <div className="perf-row"><span>Worst frame</span><b>{frameMs}ms</b></div>
      {ents && (
        <>
          <div className="perf-row"><span>Enemies</span><b>{ents.enemies}</b></div>
          <div className="perf-row"><span>Particles</span><b>{ents.particles}</b></div>
          <div className="perf-row"><span>Projectiles</span><b>{ents.projectiles}</b></div>
        </>
      )}
      <div className="perf-hint">Shift+P to hide</div>
    </div>
  );
}
