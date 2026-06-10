import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Validator, formatEKH } from '../api/client';
import CopyHash from '../components/CopyHash';
import Badge from '../components/Badge';
import { SkTable } from '../components/Skeleton';

export default function Validators() {
  const [validators, setValidators] = useState<Validator[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sort, setSort]             = useState<'stake' | 'uptime' | 'era'>('stake');

  useEffect(() => {
    api.validators()
      .then(setValidators)
      .catch(() => setValidators([]))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...validators].sort((a, b) => {
    if (sort === 'stake') {
      try { return Number(BigInt(b.total_stake || '0') - BigInt(a.total_stake || '0')); } catch { return 0; }
    }
    if (sort === 'uptime') return b.uptime - a.uptime;
    try { return Number(BigInt(b.era_points || '0') - BigInt(a.era_points || '0')); } catch { return 0; }
  });

  const active = validators.filter(v => v.status === 'ACTIVE').length;
  const jailed = validators.filter(v => v.status === 'JAILED').length;

  const maxStake = sorted.length > 0 ? BigInt(sorted[0].total_stake || '0') : 1n;

  return (
    <div className="animate-slide-up">
      <div className="mb-6 space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Validators</h1>
          <p className="text-muted text-sm mt-0.5">
            <span className="text-success">{active} active</span>
            {jailed > 0 && <span className="text-danger ml-3">{jailed} jailed</span>}
            <span className="ml-3">{validators.length} total</span>
          </p>
        </div>
        {/* Sort buttons — wraps on mobile */}
        <div className="flex flex-wrap gap-2">
          {(['stake', 'uptime', 'era'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                sort === s
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-s2 text-muted border-border hover:text-white'
              }`}>
              {s === 'era' ? 'Era Points' : s === 'stake' ? 'Total Stake' : 'Uptime'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <SkTable rows={10} cols={7} /> : validators.length === 0 ? (
        <div className="card p-12 text-center text-muted">
          <div className="text-4xl mb-3 text-primary/30">✦</div>
          <div className="font-medium mb-1 text-white">No validators indexed</div>
          <div className="text-xs">Start the node and stake at least 20,000 EKH to become a validator.</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[2rem_1fr_9rem_9rem_10rem_7rem_6rem_5rem] gap-4 th border-b border-border bg-s2/40">
            <span>#</span><span>Address</span>
            <span className="text-right">Self Stake</span>
            <span className="text-right">Delegated</span>
            <span>Stake Share</span>
            <span className="text-right">Commission</span>
            <span className="text-right">Uptime</span>
            <span className="text-center">Status</span>
          </div>

          <div className="divide-y divide-border">
            {sorted.map((v, i) => {
              let stakePct = 0;
              try {
                const vStake = BigInt(v.total_stake || '0');
                stakePct = maxStake > 0n ? Number((vStake * 100n) / maxStake) : 0;
              } catch { /* ignore */ }

              return (
                <div key={v.address} className="hover:bg-s2 transition-colors">

                  {/* Mobile row */}
                  <div className="md:hidden px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted text-xs shrink-0">{i + 1}</span>
                        <Link to={`/validator/${v.address}`}
                          className="font-mono text-xs text-primary hover:underline truncate">
                          {v.address.slice(0, 14)}…{v.address.slice(-6)}
                        </Link>
                      </div>
                      <Badge value={v.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-s3 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${stakePct}%` }} />
                      </div>
                      <span className="text-muted text-xs w-8 text-right">{stakePct}%</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>Stake: <span className="text-white">{formatEKH(v.stake, 0)}</span></span>
                      <span>·</span>
                      <span>Uptime: <span className={
                        v.uptime > 95 ? 'text-success' : v.uptime > 80 ? 'text-warning' : 'text-danger'
                      }>{v.uptime}%</span></span>
                      <span>·</span>
                      <span>Fee: {v.commission_pct}%</span>
                    </div>
                  </div>

                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[2rem_1fr_9rem_9rem_10rem_7rem_6rem_5rem] gap-4 px-4 py-3 items-center text-sm">
                    <span className="text-muted text-xs">{i + 1}</span>
                    <Link to={`/validator/${v.address}`}
                      className="font-mono text-xs text-primary hover:underline truncate">
                      {v.address.slice(0, 12)}…{v.address.slice(-6)}
                    </Link>
                    <span className="text-right text-white text-xs">{formatEKH(v.stake, 0)}</span>
                    <span className="text-right text-muted text-xs">{formatEKH(v.delegated_stake, 0)}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-s3 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${stakePct}%` }} />
                      </div>
                      <span className="text-muted text-xs w-8 text-right">{stakePct}%</span>
                    </div>
                    <span className="text-right text-muted text-xs">{v.commission_pct}%</span>
                    <span className={`text-right text-xs font-medium ${
                      v.uptime > 95 ? 'text-success' : v.uptime > 80 ? 'text-warning' : 'text-danger'
                    }`}>
                      {v.uptime}%
                    </span>
                    <div className="flex justify-center">
                      <Badge value={v.status} />
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
