import { useEffect, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  api, RwaAsset, RwaListing, RwaShareholder, RwaValuationEntry, RwaDocument, formatEKH,
} from '../api/client';
import CopyHash from '../components/CopyHash';
import Badge from '../components/Badge';
import { SkDetail } from '../components/Skeleton';

// ── Asset type icons (all 11 native types) ────────────────────────────────────

const TYPE_ICONS: Record<string, string> = {
  Property:             '🏘',
  Business:             '🏢',
  Commodity:            '⚙',
  Bond:                 '📄',
  Art:                  '🎨',
  PrivateEquity:        '💼',
  Invoice:              '🧾',
  IntellectualProperty: '💡',
  CarbonCredit:         '🌿',
  PreciousMetal:        '🪙',
  Infrastructure:       '🏗',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUSD(wei: string): string {
  try { return (BigInt(wei || '0') / 10n ** 18n).toLocaleString(); }
  catch { return '0'; }
}

function bps(n: number): string {
  if (!n) return '—';
  return `${n} bps (${(n / 100).toFixed(2)}%)`;
}

function blockOrNone(val: string | number, label = 'No expiry'): string {
  if (!val || String(val) === '0') return label;
  return `Block ${Number(val).toLocaleString()}`;
}

// Node serialises RegulationType via Debug: "Open", "RegD", "Custom(\"NG-SEC\")"
// Extract just the readable label.
function fmtRegulation(raw: string): string {
  if (!raw) return 'Open';
  const custom = raw.match(/^Custom\("?(.+?)"?\)$/);
  if (custom) return custom[1];
  const labels: Record<string, string> = {
    Open: 'Open', RegD: 'Reg D', RegS: 'Reg S',
    RegCF: 'Reg CF', MiFIDII: 'MiFID II', AIFMD: 'AIFMD',
  };
  return labels[raw] ?? raw;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <div className="field-value">{children}</div>
    </div>
  );
}

function ShareholdersTable({ id }: { id: string }) {
  const [holders, setHolders] = useState<RwaShareholder[]>([]);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    api.rwaShareholders(id)
      .then(setHolders)
      .catch(() => setHolders([]))
      .finally(() => setLoaded(true));
  }, [id]);

  if (!loaded) return <div className="text-muted text-sm py-4">Loading shareholders…</div>;
  if (!holders.length) return <div className="text-muted text-sm py-4">No shareholders on record.</div>;

  // Sort by shares descending
  const sorted = [...holders].sort((a, b) =>
    Number(BigInt(b.shares) - BigInt(a.shares)),
  );

  return (
    <div className="divide-y divide-border">
      <div className="hidden md:grid grid-cols-[1fr_8rem_8rem] gap-4 th border-b border-border bg-s2/40">
        <span>Address</span>
        <span className="text-right">Shares</span>
        <span className="text-right">%</span>
      </div>
      {sorted.map((h, i) => {
        const totalAll = sorted.reduce((s, x) => s + BigInt(x.shares), 0n);
        const pct = totalAll > 0n
          ? ((Number(BigInt(h.shares) * 10000n / totalAll)) / 100).toFixed(2)
          : '0.00';
        return (
          <div key={i} className="grid md:grid-cols-[1fr_8rem_8rem] gap-4 px-4 py-3 items-center text-sm hover:bg-s2 transition-colors">
            <CopyHash hash={h.address} type="address" full className="text-xs font-mono" />
            <span className="text-right text-white text-xs font-mono">{Number(h.shares).toLocaleString()}</span>
            <span className="text-right text-muted text-xs">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function ValuationHistory({ id }: { id: string }) {
  const [history, setHistory] = useState<RwaValuationEntry[]>([]);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    api.rwaHistory(id)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoaded(true));
  }, [id]);

  if (!loaded) return <div className="text-muted text-sm py-4">Loading history…</div>;
  if (!history.length) return <div className="text-muted text-sm py-4">No valuation updates on record.</div>;

  return (
    <div className="divide-y divide-border">
      <div className="hidden md:grid grid-cols-[6rem_1fr_1fr] gap-4 th border-b border-border bg-s2/40">
        <span>Block</span>
        <span className="text-right">Valuation USD</span>
        <span>Updated By</span>
      </div>
      {[...history].reverse().map((e, i) => (
        <div key={i} className="grid md:grid-cols-[6rem_1fr_1fr] gap-4 px-4 py-3 items-center text-sm hover:bg-s2 transition-colors">
          <span className="text-muted text-xs font-mono">{e.block.toLocaleString()}</span>
          <span className="text-right text-primary font-semibold text-xs">${formatUSD(e.valuationUsd)}</span>
          <CopyHash hash={e.updatedBy} type="address" pre={6} suf={4} className="text-xs font-mono" />
        </div>
      ))}
    </div>
  );
}

function DocumentsList({ id }: { id: string }) {
  const [docs,   setDocs]   = useState<RwaDocument[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.rwaDocuments(id)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoaded(true));
  }, [id]);

  if (!loaded) return <div className="text-muted text-sm py-4">Loading documents…</div>;
  if (!docs.length) return <div className="text-muted text-sm py-4">No documents attached to this asset.</div>;

  return (
    <div className="divide-y divide-border">
      {docs.map((d, i) => (
        <div key={i} className="px-4 py-3 hover:bg-s2 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm mb-1">{d.description || 'Untitled document'}</div>
              <CopyHash hash={d.hash} className="text-xs font-mono text-muted" />
            </div>
            <span className="text-muted text-xs shrink-0">Block {d.addedAt.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

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
              {asset.verified    && <span className="text-success">✓ Verified</span>}
              {asset.accredited_only && <span className="text-warning">⚠ Accredited only</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold text-primary">${formatUSD(asset.valuation_usd)}</div>
            <div className="text-muted text-xs">Valuation USD</div>
          </div>
        </div>
      </div>

      {/* Details + Metadata */}
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

        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Metadata</h2>
          {asset.metadata_uri ? (
            <Field label="URI">
              <span className="font-mono text-xs text-muted break-all">{asset.metadata_uri}</span>
            </Field>
          ) : null}
          <Field label="Title Hash">
            {asset.title_hash
              ? <CopyHash hash={asset.title_hash} className="font-mono text-xs text-muted" />
              : <span className="text-muted">—</span>}
          </Field>
          <Field label="Created Block">
            <span className="text-muted">{asset.created_block.toLocaleString()}</span>
          </Field>
        </div>
      </div>

      {/* Compliance + Trading */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-semibold text-white mb-4">Compliance</h2>
          <Field label="Regulation">
            <span className="text-white">{fmtRegulation(asset.regulation_type)}</span>
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
            <span className="text-white">{blockOrNone(asset.maturity_block, 'Perpetual')}</span>
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
        </div>
      </div>

      {/* Active Listings */}
      {listings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-white">Active Listings ({listings.length})</h2>
          </div>
          <div className="hidden md:grid grid-cols-[1fr_6rem_7rem_6rem_5rem_6rem_5rem] gap-3 th bg-s2/40">
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
                <div key={i} className="grid md:grid-cols-[1fr_6rem_7rem_6rem_5rem_6rem_5rem] gap-3 px-4 py-3 items-center text-sm hover:bg-s2 transition-colors">
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
                      ? Number(l.min_purchase).toLocaleString() : '—'}
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
      )}

      {/* Shareholders */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-white">Shareholders</h2>
          <p className="text-muted text-xs mt-0.5">All addresses holding shares of this asset</p>
        </div>
        <ShareholdersTable id={id!} />
      </div>

      {/* Valuation History */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-white">Valuation History</h2>
          <p className="text-muted text-xs mt-0.5">Every time the oracle or owner updated the USD valuation</p>
        </div>
        <ValuationHistory id={id!} />
      </div>

      {/* Documents */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-white">Legal Documents</h2>
          <p className="text-muted text-xs mt-0.5">Title deeds, audit reports, and other attached documents</p>
        </div>
        <DocumentsList id={id!} />
      </div>

    </div>
  );
}
