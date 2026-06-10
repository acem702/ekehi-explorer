import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Nft } from '../api/client';
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

export default function NFTDetail() {
  const { id } = useParams<{ id: string }>();
  const [nft,     setNft]     = useState<Nft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.nft(id)
      .then(setNft)
      .catch(() => setError('NFT not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <SkDetail />;
  if (error || !nft) return (
    <div className="text-center py-20 text-muted">{error || 'NFT not found'}</div>
  );

  let meta: Record<string, string> = {};
  try { meta = JSON.parse(nft.metadata ?? '{}'); } catch { /* ignore */ }

  const attrs: Array<{ trait_type: string; value: string }> = (() => {
    try { return JSON.parse(meta.attributes ?? '[]'); } catch { return []; }
  })();

  const price = nft.listed_price && nft.listed_price !== '0'
    ? (Number(nft.listed_price) / 1e18).toFixed(4) + ' EKH'
    : null;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link to="/nfts" className="text-muted hover:text-white text-sm transition-colors">← NFTs</Link>
        <span className="text-border">/</span>
        <span className="text-white text-sm">{meta.name ?? `NFT #${nft.item_id}`}</span>
        {nft.locked === 1 && <Badge value="LOCKED" />}
        {nft.is_fractionalized === 1 && <Badge value="FRACTIONALIZED" />}
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-6">
        {/* Image */}
        <div>
          <div className="aspect-square rounded-2xl bg-s2 border border-border flex items-center justify-center overflow-hidden mb-4">
            {meta.image
              ? <img src={meta.image} alt={meta.name ?? ''} className="w-full h-full object-cover" />
              : <span className="text-primary/20 text-8xl">◈</span>}
          </div>

          {price && (
            <div className="card p-4 text-center">
              <div className="text-muted text-xs mb-1">Listed Price</div>
              <div className="text-primary text-2xl font-bold">{price}</div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-5">
          {meta.name && (
            <h1 className="text-3xl font-bold text-white">{meta.name}</h1>
          )}
          {meta.description && (
            <p className="text-muted leading-relaxed">{meta.description}</p>
          )}

          {/* Attributes */}
          {attrs.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Attributes</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {attrs.map((a, i) => (
                  <div key={i} className="bg-s2 border border-border rounded-xl p-3 text-center">
                    <div className="text-muted text-xs uppercase tracking-wide mb-1">{a.trait_type}</div>
                    <div className="text-primary font-semibold text-sm">{a.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4">Details</h2>
            <Field label="Token ID">
              <span className="text-primary font-semibold">#{nft.token_id}</span>
            </Field>
            <Field label="Collection">
              <CopyHash hash={nft.collection_id} className="font-mono text-xs text-muted" />
            </Field>
            <Field label="Owner">
              <CopyHash hash={nft.owner} type="address" full className="font-mono text-xs" />
            </Field>
            <Field label="Fractionalized">
              <span className={nft.is_fractionalized === 1 ? 'text-warning' : 'text-muted'}>
                {nft.is_fractionalized === 1 ? '✓ Yes' : 'No'}
              </span>
            </Field>
            <Field label="Locked">
              <span className={nft.locked === 1 ? 'text-danger' : 'text-muted'}>
                {nft.locked === 1 ? '🔒 Yes' : 'No'}
              </span>
            </Field>
            {meta.image && (
              <Field label="Image URI">
                <span className="font-mono text-xs text-muted break-all">{meta.image}</span>
              </Field>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
