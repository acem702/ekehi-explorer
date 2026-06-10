import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Validator, Block, formatEKH, timeAgo } from '../api/client';
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

export default function ValidatorDetail() {
  const { addr } = useParams<{ addr: string }>();
  const [v,       setV]       = useState<Validator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!addr) return;
    setLoading(true);
    api.validator(addr)
      .then(setV)
      .catch(() => setError('Validator not found'))
      .finally(() => setLoading(false));
  }, [addr]);

  if (loading) return <SkDetail />;
  if (error || !v) return (
    <div className="text-center py-20 text-muted">{error || 'Validator not found'}</div>
  );

  const selfStake = BigInt(v.stake || '0');
  const delStake  = BigInt(v.delegated_stake || '0');
  const totStake  = selfStake + delStake;
  const selfPct   = totStake > 0n ? Number((selfStake * 100n) / totStake) : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/validators" className="text-muted hover:text-white text-sm transition-colors">← Validators</Link>
        <span className="text-border">/</span>
        <h1 className="text-xl font-bold text-white">Validator</h1>
        <Badge value={v.status} />
      </div>

      <CopyHash hash={addr!} full className="font-mono text-xs text-primary" />

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Self Stake',    val: formatEKH(v.stake,           0), hi: true },
          { label: 'Delegated',     val: formatEKH(v.delegated_stake, 0), hi: false },
          { label: 'Total Stake',   val: formatEKH(v.total_stake,     0), hi: true },
          { label: 'Commission',    val: `${v.commission_pct}%`,          hi: false },
          { label: 'Uptime',        val: `${v.uptime}%`,                  hi: v.uptime > 95 },
          { label: 'Slashes',       val: v.slash_count.toString(),        hi: false },
        ].map(({ label, val, hi }) => (
          <div key={label} className="card p-5">
            <div className="text-muted text-xs mb-1">{label}</div>
            <div className={`font-bold text-xl ${hi ? 'text-primary' : 'text-white'}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Stake composition bar */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Stake Composition</h2>
        <div className="h-3 bg-s3 rounded-full overflow-hidden flex">
          <div className="h-full bg-primary rounded-l-full transition-all" style={{ width: `${selfPct}%` }} />
          <div className="h-full bg-primary/30 flex-1" />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted">
          <span><span className="text-primary">■</span> Self {selfPct}%</span>
          <span><span className="text-primary/30">■</span> Delegated {100 - selfPct}%</span>
        </div>
      </div>

      {/* Details */}
      <div className="card p-6">
        <h2 className="font-semibold text-white mb-4">Details</h2>
        <Field label="Session Key">
          {v.session_key
            ? <CopyHash hash={v.session_key} className="font-mono text-xs text-muted" />
            : <span className="text-muted">—</span>}
        </Field>
        <Field label="Era Points">
          <span className="text-white">{v.era_points ?? '0'}</span>
        </Field>
        <Field label="Last Active">
          <span className="text-white">{v.last_seen_block ? `Block #${v.last_seen_block.toLocaleString()}` : '—'}</span>
        </Field>
        <Field label="Slash Count">
          <span className={v.slash_count > 0 ? 'text-danger font-semibold' : 'text-muted'}>{v.slash_count}</span>
        </Field>
      </div>

      {/* Recent blocks */}
      {v.recentBlocks && v.recentBlocks.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">Recently Produced Blocks</h2>
          <div className="card overflow-hidden divide-y divide-border">
            {v.recentBlocks.map((b: Block) => (
              <div key={b.hash} className="flex items-center justify-between px-4 py-3 hover:bg-s2 transition-colors">
                <Link to={`/block/${b.number}`} className="text-primary font-semibold text-sm hover:underline">
                  #{b.number.toLocaleString()}
                </Link>
                <span className="text-muted text-sm">{b.tx_count} txs</span>
                <span className="text-muted text-xs">{timeAgo(b.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link to={`/address/${addr}`} className="link text-sm">
        ← View address page
      </Link>
    </div>
  );
}
