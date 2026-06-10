import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Proposal, formatEKH } from '../api/client';
import CopyHash from '../components/CopyHash';
import Badge from '../components/Badge';
import { SkDetail } from '../components/Skeleton';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <div className="field-value">{children}</div>
    </div>
  );
}

export default function GovernanceDetail() {
  const { id } = useParams<{ id: string }>();
  const [p,       setP]       = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.proposal(id)
      .then(setP)
      .catch(() => setError('Proposal not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SkDetail />;
  if (error || !p) return (
    <div className="text-center py-20 text-muted">{error || 'Proposal not found'}</div>
  );

  const votesFor     = BigInt(p.votesFor     ?? '0');
  const votesAgainst = BigInt(p.votesAgainst ?? '0');
  const total        = votesFor + votesAgainst;
  const forPct       = total > 0n ? Number((votesFor * 100n) / total) : 0;
  const status       = p.status ?? 'PENDING';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link to="/governance" className="text-muted hover:text-white text-sm transition-colors">← Governance</Link>
        <span className="text-border">/</span>
        <span className="text-white text-sm font-medium">Proposal #{p.id}</span>
        <Badge value={status} />
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">{p.title ?? `Proposal #${p.id}`}</h1>
        {p.proposer && (
          <div className="mt-1 text-muted text-sm">
            By <CopyHash hash={p.proposer} type="address" pre={8} suf={4} className="text-xs" />
          </div>
        )}
      </div>

      {/* Description */}
      {p.description && (
        <div className="card p-6">
          <h2 className="font-semibold text-muted text-xs uppercase tracking-wider mb-3">Description</h2>
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{p.description}</p>
        </div>
      )}

      {/* Vote visualization */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-5">Vote Breakdown</h2>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-success/5 border border-success/20 rounded-xl p-5 text-center">
            <div className="text-4xl font-bold text-success mb-1">{forPct}%</div>
            <div className="text-muted text-xs mb-2">For</div>
            <div className="text-white text-sm font-medium">{formatEKH(votesFor.toString(), 0)}</div>
          </div>
          <div className="bg-danger/5 border border-danger/20 rounded-xl p-5 text-center">
            <div className="text-4xl font-bold text-danger mb-1">{100 - forPct}%</div>
            <div className="text-muted text-xs mb-2">Against</div>
            <div className="text-white text-sm font-medium">{formatEKH(votesAgainst.toString(), 0)}</div>
          </div>
        </div>

        <div className="h-3 bg-s3 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-success to-success/70 rounded-full transition-all duration-700"
            style={{ width: `${forPct}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-xs text-muted">
          <span>Total participation: {formatEKH(total.toString(), 0)}</span>
          {total > 0n && <span>{forPct >= 50 ? '✓ Majority for' : '✗ Majority against'}</span>}
        </div>
      </div>

      {/* Metadata */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4">Details</h2>
        <Field label="Proposal ID">
          <span className="text-primary font-semibold">#{p.id}</span>
        </Field>
        <Field label="Status">
          <Badge value={status} />
        </Field>
        {p.proposer && (
          <Field label="Proposer">
            <CopyHash hash={p.proposer} type="address" full className="font-mono text-xs" />
          </Field>
        )}
        <Field label="Start Block">
          {p.startBlock != null
            ? <Link to={`/block/${p.startBlock}`} className="link">#{p.startBlock.toLocaleString()}</Link>
            : <span className="text-muted">—</span>}
        </Field>
        <Field label="End Block">
          {p.endBlock != null
            ? <Link to={`/block/${p.endBlock}`} className="link">#{p.endBlock.toLocaleString()}</Link>
            : <span className="text-muted">—</span>}
        </Field>
      </div>
    </div>
  );
}
