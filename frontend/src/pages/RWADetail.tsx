import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, RwaAsset, RwaListing, formatEKH } from '../api/client';
import CopyHash from '../components/CopyHash';
import Badge from '../components/Badge';
import { SkDetail } from '../components/Skeleton';

const TYPE_ICONS: Record<string, string> = {
  PROPERTY: '🏘', BUSINESS: '🏢', COMMODITY: '⚙',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <div className="field-value">{children}</div>
    </div>
  );
}

function formatUSD(wei: string): string {
  try {
    const n = BigInt(wei || '0');
    return (n / 10n ** 18n).toLocaleString();
  } catch { return '0'; }
}

function bps(n: number): string {
  if (!n) return '—';
  return `${n} bps (${(n / 100).toFixed(2)}%)`;
}

function blockOrNone(val: string, label = 'No expiry'): string {
  if (!val || val === '0') return label;
  return `Block ${Number(val).toLocaleString()}`;
}

export default function RWADetail() {
  const { id } = useParams<{ id: string }>();
  const [asset,    setAsset]    = useState<RwaAsset | null>(null);
  const [listings, setListings] = useState<RwaListing[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.rwaAsset(id)
      .then(data => {
        setAsset(data);
        setListings(data.listings ?? []);
      })
      .catch(() => setError('Asset not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SkDetail />;
  if (error || !asset) return (
    <div className="text-center py-20 text-muted">{error || 'Asset not found'}</div>
  );

  const totalShares = Number(asset.total_shares ?? 0);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link to="/rwa" className="text-muted hover:text-white text-sm transition-colors">← RWA</Link>
        <span className="text-border">/</span>
        <span className="text-muted text-sm font-mono">{id?.slice(0, 16)}…</span>
        <Badge value={asset.status} />
      </div>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-s3 border border-border flex items-center justify-center text-4xl shrink-0">
            {TYPE_ICONS[asset.asset_type] ?? '⬡'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white mb-1">{asset.name ?? `Asset #${id}`}</h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted">
              <span className="bg-s3 border border-border px-2 py-0.5 rounded text-xs">{asset.asset_type}</span>
              <span>{asset.jurisdiction || 'No jurisdiction'}</span>
              {asset.verified   && <span className="text-success">✓ Verified</span>}
              {asset.accredited_only && <span className="text-warning">⚠ Accredited only</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-primary">
              ${formatUSD(asset.valuation_usd)}
            </div>
            <div className="text-muted text-xs">Valuation USD</div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Asset Details</h2>
          <Field label="Asset ID">
            <CopyHash hash={id!} className="font-mono text-xs text-muted" />
          </Field>
          <Field label="Owner">
            <CopyHash hash={asset.owner} type="address" full className="font-mono text-xs" />
          </Field>
          <Field label="Asset Type">
            <span className="text-white">{asset.asset_type}</span>
          </Field>
          <Field label="Jurisdiction">
            <span className="text-white">{asset.jurisdiction || '—'}</span>
          </Field>
          <Field label="Verified">
            <span className={asset.verified ? 'text-success' : 'text-muted'}>
              {asset.verified ? '✓ Yes' : '—'}
            </span>
          </Field>
          <Field label="Accredited Only">
            <span className={asset.accredited_only ? 'text-warning' : 'text-muted'}>
              {asset.accredited_only ? '⚠ Yes' : 'No'}
            </span>
          </Field>
          {totalShares > 0 && (
            <Field label="Total Shares">
              <span className="text-white">{totalShares.toLocaleString()}</span>
            </Field>
          )}
        </div>

        {asset.metadata_uri && (
          <div className="card p-6">
            <h2 className="font-semibold text-white mb-4">Metadata</h2>
            <Field label="URI">
              <span className="font-mono text-xs text-muted break-all">{asset.metadata_uri}</span>
            </Field>
            <Field label="Title Hash">
              {asset.title_hash
                ? <CopyHash hash={asset.title_hash} className="font-mono text-xs text-muted" />
                : <span className="text-muted">—</span>}
            </Field>
          </div>
        )}
      </div>

      {/* Compliance & Trading */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Compliance</h2>
          <Field label="Regulation Type">
            <span className="text-white">{asset.regulation_type || 'Open'}</span>
          </Field>
          <Field label="Lockup Until">
            <span className="text-white">{blockOrNone(asset.lockup_until, 'No lockup')}</span>
          </Field>
          <Field label="Max Concentration">
            <span className="text-white">
              {asset.max_concentration_pct ? `${asset.max_concentration_pct}%` : '—'}
            </span>
          </Field>
          <Field label="Maturity Block">
            <span className="text-white">{blockOrNone(asset.maturity_block, 'No maturity')}</span>
          </Field>
          <Field label="Coupon Rate">
            <span className="text-white">{bps(asset.coupon_rate_bps)}</span>
          </Field>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Trading Activity</h2>
          <Field label="Trading Fee">
            <span className="text-white">{bps(asset.trading_fee_bps)}</span>
          </Field>
          <Field label="Total Volume">
            <span className="text-primary font-semibold">
              {formatEKH(asset.total_volume_traded || '0')}
            </span>
          </Field>
          <Field label="Total Dividends">
            <span className="text-success">
              {formatEKH(asset.total_dividends_distributed || '0')}
            </span>
          </Field>
          <Field label="Transfer Count">
            <span className="text-white">{(asset.transfer_count ?? 0).toLocaleString()}</span>
          </Field>
          <Field label="Created Block">
            <span className="text-muted">{asset.created_block.toLocaleString()}</span>
          </Field>
        </div>
      </div>

      {/* Active listings */}
      {listings.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">
            Active Listings ({listings.length})
          </h2>
          <div className="card overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_6rem_7rem_6rem_5rem_6rem_5rem] gap-3 th border-b border-border bg-s2/40">
              <span>Seller</span>
              <span className="text-right">Shares</span>
              <span className="text-right">Price/Share</span>
              <span className="text-right">Total</span>
              <span className="text-right">Min Buy</span>
              <span className="text-right">Expires</span>
              <span className="text-center">Status</span>
            </div>
            <div className="divide-y divide-border">
              {listings.map((l, i) => {
                const totalEKH = (Number(l.price_per_share || 0) / 1e18) * Number(l.shares);
                return (
                  <div key={i}
                    className="grid md:grid-cols-[1fr_6rem_7rem_6rem_5rem_6rem_5rem] gap-3 px-4 py-3 items-center hover:bg-s2 transition-colors text-sm">
                    <CopyHash hash={l.seller} type="address" pre={8} suf={4} className="text-xs" />
                    <span className="text-right text-white text-xs">{Number(l.shares).toLocaleString()}</span>
                    <span className="text-right text-muted text-xs">
                      {(Number(l.price_per_share || 0) / 1e18).toFixed(4)} EKH
                    </span>
                    <span className="text-right text-primary text-xs font-semibold">
                      {totalEKH.toFixed(2)} EKH
                    </span>
                    <span className="text-right text-muted text-xs">
                      {l.min_purchase && l.min_purchase !== '0'
                        ? Number(l.min_purchase).toLocaleString()
                        : '—'}
                    </span>
                    <span className="text-right text-muted text-xs">
                      {blockOrNone(l.expires_at)}
                    </span>
                    <div className="flex justify-center">
                      <Badge value={l.status ?? 'ACTIVE'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
