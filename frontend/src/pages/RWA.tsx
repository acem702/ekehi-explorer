import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, RwaAsset } from '../api/client';
import CopyHash from '../components/CopyHash';
import Badge from '../components/Badge';
import { SkTable } from '../components/Skeleton';

const TYPE_ICONS: Record<string, string> = {
  PROPERTY:  '🏘',
  BUSINESS:  '🏢',
  COMMODITY: '⚙',
};

function fmtUSD(wei: string): string {
  try { return (BigInt(wei || '0') / 10n ** 18n).toLocaleString(); }
  catch { return '0'; }
}

function AssetCard({ asset }: { asset: RwaAsset }) {
  const icon = TYPE_ICONS[asset.asset_type] ?? '⬡';
  return (
    <Link to={`/rwa/${asset.id}`}
      className="card p-5 hover:border-primary/30 transition-colors group block">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-s3 border border-border flex items-center justify-center text-xl group-hover:border-primary/20 transition-colors">
          {icon}
        </div>
        <Badge value={asset.status} />
      </div>
      <div className="font-mono text-xs text-muted mb-1 truncate">{asset.id.slice(0, 20)}…</div>
      {asset.name && <div className="font-semibold text-white mb-1 truncate">{asset.name}</div>}
      <div className="text-muted text-xs">{asset.asset_type} · {asset.jurisdiction || '—'}</div>
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-muted text-xs">Valuation</span>
        <span className="text-primary font-semibold text-sm">
          ${fmtUSD(asset.valuation_usd)}
        </span>
      </div>
    </Link>
  );
}

export default function RWA() {
  const [assets,  setAssets]  = useState<RwaAsset[]>([]);
  const [filter,  setFilter]  = useState('ALL');
  const [view,    setView]    = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.rwa()
      .then(res => setAssets(Array.isArray(res) ? res : (res.data ?? [])))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, []);

  const types   = ['ALL', ...Array.from(new Set(assets.map(a => a.asset_type)))];
  const visible = filter === 'ALL' ? assets : assets.filter(a => a.asset_type === filter);

  const totalVal = assets.reduce((s, a) => {
    try { return s + BigInt(a.valuation_usd || '0') / 10n ** 18n; } catch { return s; }
  }, 0n);

  return (
    <div className="animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Real-World Assets</h1>
        <p className="text-muted text-sm">
          Property · Business · Commodity · KYC-gated compliance ·{' '}
          {assets.length} assets · Total ~${totalVal.toLocaleString()}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex gap-2">
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                filter === t
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-s2 text-muted border-border hover:text-white'
              }`}>
              {t === 'ALL' ? 'All' : (TYPE_ICONS[t] ?? '') + ' ' + t}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`p-2 rounded-lg text-xs border transition-colors ${
                view === v
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-s2 text-muted border-border hover:text-white'
              }`}>
              {v === 'grid' ? '⊞' : '☰'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <SkTable rows={6} cols={4} /> : visible.length === 0 ? (
        <div className="card p-16 text-center text-muted">
          <div className="text-5xl mb-4">🏘</div>
          <div className="font-semibold text-white mb-1">No RWA assets yet</div>
          <div className="text-xs">Assets appear once tokenized via the RWA module.</div>
        </div>
      ) : view === 'grid' ? (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map(asset => <AssetCard key={asset.id} asset={asset} />)}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[2rem_1fr_8rem_9rem_10rem_7rem_5rem] gap-4 th border-b border-border bg-s2/40">
            <span></span><span>Asset ID</span><span>Type</span><span>Owner</span>
            <span>Jurisdiction</span><span className="text-right">Valuation</span><span className="text-center">Status</span>
          </div>
          <div className="divide-y divide-border">
            {visible.map(asset => (
              <div key={asset.id}
                className="grid md:grid-cols-[2rem_1fr_8rem_9rem_10rem_7rem_5rem] gap-4 px-4 py-3 items-center hover:bg-s2 transition-colors text-sm">
                <span className="text-lg">{TYPE_ICONS[asset.asset_type] ?? '⬡'}</span>
                <div>
                  <Link to={`/rwa/${asset.id}`} className="link font-mono text-xs">{asset.id.slice(0, 20)}…</Link>
                  {asset.name && <div className="text-muted text-xs mt-0.5">{asset.name}</div>}
                </div>
                <span className="text-xs bg-s3 border border-border px-2 py-1 rounded">{asset.asset_type}</span>
                <CopyHash hash={asset.owner} type="address" pre={5} suf={3} className="text-xs" />
                <span className="text-muted text-xs">{asset.jurisdiction || '—'}</span>
                <span className="text-right text-primary font-semibold text-xs">
                  ${fmtUSD(asset.valuation_usd)}
                </span>
                <div className="flex justify-center"><Badge value={asset.status} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
