import { useEffect, useState } from 'react';
import { api, Pool } from '../api/client';
import { SkTable } from '../components/Skeleton';

function fmt(raw: string): string {
  try {
    const n = BigInt(raw);
    if (n === 0n) return '0';
    if (n > 10n ** 15n) return (Number(n) / 1e18).toFixed(2) + ' EKH';
    return n.toLocaleString();
  } catch { return raw; }
}

function PoolCard({ pool }: { pool: Pool }) {
  const feePct = (Number(pool.fee_bps) / 100).toFixed(2);
  const tvl    = (() => {
    try {
      const a = BigInt(pool.reserve_a || '0');
      const b = BigInt(pool.reserve_b || '0');
      return (Number(a + b) / 1e18).toFixed(2);
    } catch { return '—'; }
  })();

  return (
    <div className="card p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-lg font-bold">
            ⇄
          </div>
          <div>
            <div className="font-semibold text-white text-sm">
              {pool.asset_a.slice(0, 8)}… / {pool.asset_b.slice(0, 8)}…
            </div>
            <div className="text-muted text-xs font-mono">{pool.id.slice(0, 18)}…</div>
          </div>
        </div>
        <span className="badge-success text-xs">{feePct}% fee</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="bg-s2 rounded-lg p-2">
          <div className="text-muted text-xs mb-0.5">Reserve A</div>
          <div className="text-white font-medium text-xs">{fmt(pool.reserve_a)}</div>
        </div>
        <div className="bg-s2 rounded-lg p-2">
          <div className="text-muted text-xs mb-0.5">Reserve B</div>
          <div className="text-white font-medium text-xs">{fmt(pool.reserve_b)}</div>
        </div>
        <div className="bg-s2 rounded-lg p-2">
          <div className="text-muted text-xs mb-0.5">Vol 24h</div>
          <div className="text-primary font-medium text-xs">{fmt(pool.volume_24h)}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>LP Supply: {fmt(pool.lp_supply)}</span>
        <span className="text-primary font-semibold">TVL ~{tvl} EKH</span>
      </div>
    </div>
  );
}

export default function DeFi() {
  const [pools, setPools]   = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.pools()
      .then(p => setPools(Array.isArray(p) ? p : []))
      .catch(() => setPools([]))
      .finally(() => setLoading(false));
  }, []);

  const totalTvl = pools.reduce((sum, p) => {
    try { return sum + Number(BigInt(p.reserve_a || '0') + BigInt(p.reserve_b || '0')) / 1e18; }
    catch { return sum; }
  }, 0);

  return (
    <div className="animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">DeFi — AMM Pools</h1>
        <p className="text-muted text-sm">Constant-product (x·y=k) DEX · {pools.length} pools · TVL ~{totalTvl.toFixed(2)} EKH</p>
      </div>

      {loading ? <SkTable rows={4} cols={3} /> : pools.length === 0 ? (
        <div className="card p-16 text-center text-muted">
          <div className="text-5xl mb-4 text-primary/20">⇄</div>
          <div className="font-semibold text-white mb-1">No pools yet</div>
          <div className="text-xs">Pools appear once liquidity is added via the AMM module.</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pools.map(pool => <PoolCard key={pool.id} pool={pool} />)}
        </div>
      )}

      {/* Placeholder upcoming pairs */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Upcoming Pairs</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { title: 'EKH / USDC', desc: 'Primary stable pair' },
            { title: 'EKH / BTC',  desc: 'Cross-chain bridge' },
            { title: 'RWA / EKH',  desc: 'Real-world asset trading' },
          ].map(p => (
            <div key={p.title} className="card p-5 opacity-40 cursor-not-allowed">
              <div className="text-2xl mb-2 text-primary/40">⇄</div>
              <div className="font-medium text-white">{p.title}</div>
              <div className="text-xs text-muted mt-1">{p.desc} · Coming soon</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
