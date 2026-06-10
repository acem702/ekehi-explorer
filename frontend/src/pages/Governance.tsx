import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Proposal } from '../api/client';
import Badge from '../components/Badge';
import { SkTable } from '../components/Skeleton';

function VoteBar({ votesFor, votesAgainst }: { votesFor?: string; votesAgainst?: string }) {
  let forPct = 0;
  try {
    const f = Number(BigInt(votesFor ?? '0'));
    const a = Number(BigInt(votesAgainst ?? '0'));
    const t = f + a;
    if (t === 0) return <div className="text-xs text-muted mt-2">No votes yet</div>;
    forPct = Math.round((f / t) * 100);
  } catch { return null; }

  return (
    <div className="mt-3">
      <div className="flex text-xs mb-1.5">
        <span className="text-success">{forPct}% For</span>
        <span className="ml-auto text-danger">{100 - forPct}% Against</span>
      </div>
      <div className="h-2 bg-s3 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-success to-success/80 rounded-full transition-all"
          style={{ width: `${forPct}%` }} />
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status?: string }) {
  const icons: Record<string, string> = {
    ACTIVE:  '●', PASSED: '✓', FAILED: '✗', PENDING: '◌', EXECUTED: '⚡',
  };
  return <span>{icons[status ?? 'PENDING'] ?? '◌'}</span>;
}

export default function Governance() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter]       = useState<string>('ALL');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.proposals()
      .then(res => setProposals(Array.isArray(res) ? res : (res.data ?? [])))
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, []);

  const statuses = ['ALL', 'ACTIVE', 'PASSED', 'FAILED', 'PENDING'];
  const visible  = filter === 'ALL'
    ? proposals
    : proposals.filter(p => (p.status ?? 'PENDING') === filter);

  const counts = {
    active:  proposals.filter(p => p.status === 'ACTIVE').length,
    passed:  proposals.filter(p => p.status === 'PASSED').length,
    failed:  proposals.filter(p => p.status === 'FAILED').length,
  };

  return (
    <div className="animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Governance</h1>
        <p className="text-muted text-sm">
          On-chain proposals · Conviction voting · 7-day timelock ·{' '}
          <span className="text-success">{counts.active} active</span> ·{' '}
          <span className="text-success">{counts.passed} passed</span> ·{' '}
          <span className="text-danger">{counts.failed} failed</span>
        </p>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filter === s
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-s2 text-muted border-border hover:text-white'
            }`}>
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? <SkTable rows={4} cols={1} /> : visible.length === 0 ? (
        <div className="card p-16 text-center text-muted">
          <div className="text-5xl mb-4 text-primary/20">⚖</div>
          <div className="font-semibold text-white mb-1">No proposals yet</div>
          <div className="text-xs">Any EKH holder can submit a governance proposal.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(p => (
            <div key={p.id} className="card p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-muted text-xs font-mono">#{p.id}</span>
                    <Badge value={p.status ?? 'PENDING'} />
                  </div>
                  <h3 className="font-semibold text-white text-base">
                    {p.title ?? `Proposal #${p.id}`}
                  </h3>
                  {p.description && (
                    <p className="text-muted text-sm mt-1 line-clamp-2 leading-relaxed">{p.description}</p>
                  )}
                </div>
                <Link to={`/governance/${p.id}`}
                  className="shrink-0 btn-ghost text-xs">
                  Details →
                </Link>
              </div>

              <VoteBar votesFor={p.votesFor} votesAgainst={p.votesAgainst} />

              <div className="flex items-center gap-4 mt-3 text-xs text-muted">
                {p.proposer && (
                  <span>By <span className="font-mono">{p.proposer.slice(0, 10)}…</span></span>
                )}
                {p.startBlock && <span>Start #{p.startBlock.toLocaleString()}</span>}
                {p.endBlock   && <span>End #{p.endBlock.toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
