import { useEffect } from 'react';
import { GlassPanel } from './GlassPanel';
import { GlassButton } from './GlassButton';
import { useStatsStore, favoriteBuildId } from '../state/statsStore';
import { BUILDS_BY_ID } from '../data/builds';
import './stats-modal.css';

interface Props {
  onClose: () => void;
}

export function StatsModal({ onClose }: Props) {
  const stats = useStatsStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const favId = favoriteBuildId(stats);
  const favName = favId ? (BUILDS_BY_ID[favId]?.name ?? favId) : '—';
  const winRate = stats.totalRuns > 0 ? Math.round((stats.wins / stats.totalRuns) * 100) : 0;

  return (
    <div className="stats-backdrop" onClick={onClose}>
      <div className="stats-card-wrap" onClick={(e) => e.stopPropagation()}>
        <GlassPanel padding="lg" className="stats-card">
          <h2 className="display stats-title">Lifetime Stats</h2>

          <div className="stats-grid">
            <Row label="Runs" value={stats.totalRuns} />
            <Row label="Wins" value={stats.wins} />
            <Row label="Deaths" value={stats.deaths} />
            <Row label="Win Rate" value={`${winRate}%`} />
            <Row label="Total Kills" value={stats.totalKills} />
            <Row label="Total Cash" value={`$${stats.totalCash}`} />
            <Row label="Best Endless" value={stats.bestEndlessRound > 0 ? `Round ${stats.bestEndlessRound}` : '—'} />
            <Row label="Jackpots" value={stats.jackpots} />
            <Row label="Favorite Build" value={favName} />
          </div>

          <div className="stats-actions">
            <GlassButton variant="gold" size="sm" onClick={onClose}>
              Close
            </GlassButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stats-row">
      <span className="stats-label">{label}</span>
      <span className="stats-value">{value}</span>
    </div>
  );
}
