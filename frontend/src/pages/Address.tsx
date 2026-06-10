import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Account, Transaction, Validator, Nft, RwaAsset, formatEKH, timeAgo } from '../api/client';
import CopyHash from '../components/CopyHash';
import TxTypeBadge from '../components/TxTypeBadge';
import Badge from '../components/Badge';
import { SkDetail } from '../components/Skeleton';
import StatCard from '../components/StatCard';

type Tab = 'txns' | 'nfts' | 'rwa' | 'validator';

export default function Address() {
  const { addr } = useParams<{ addr: string }>();
  const [data,    setData]    = useState<{
    account: Account;
    transactions: Transaction[];
    validator: Validator | null;
    nfts: Nft[];
    rwaAssets: RwaAsset[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [tab,     setTab]     = useState<Tab>('txns');

  useEffect(() => {
    if (!addr) return;
    setLoading(true);
    api.address(addr)
      .then(setData)
      .catch(() => setError('Address not found or node offline'))
      .finally(() => setLoading(false));
  }, [addr]);

  if (loading) return <SkDetail />;
  if (error || !data) return (
    <div className="text-center py-20 text-muted">{error || 'Address not found'}</div>
  );

  const { account, transactions, validator, nfts, rwaAssets } = data;
  const nonceNum = account?.nonce?.startsWith('0x')
    ? parseInt(account.nonce, 16)
    : Number(account?.nonce ?? 0);

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'txns',      label: 'Transactions', count: transactions.length },
    { id: 'nfts',      label: 'NFTs',         count: nfts.length },
    { id: 'rwa',       label: 'RWA',          count: rwaAssets.length },
    ...(validator ? [{ id: 'validator' as Tab, label: 'Validator' }] : []),
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Address</h1>
        <CopyHash hash={addr!} full className="font-mono text-xs text-primary" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Balance"      value={formatEKH(account?.balance ?? '0')} />
        <StatCard label="Frozen"       value={formatEKH(account?.frozen  ?? '0')} />
        <StatCard label="Nonce"        value={nonceNum.toLocaleString()} />
        <StatCard label="Transactions" value={(account?.tx_count ?? 0).toLocaleString()} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-white'
            }`}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-xs bg-s3 px-1.5 py-0.5 rounded">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Transactions */}
      {tab === 'txns' && (
        <div className="card overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-10 text-center text-muted text-sm">No transactions found</div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map(tx => (
                <div key={tx.hash} className="tr">
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold border ${
                    tx.status === 1
                      ? 'bg-success/10 border-success/20 text-success'
                      : 'bg-danger/10 border-danger/20 text-danger'
                  }`}>
                    {tx.status === 1 ? '✓' : '✗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CopyHash hash={tx.hash} type="tx" className="text-sm" />
                    <div className="text-muted text-xs mt-0.5 truncate">
                      <span className={tx.from_addr.toLowerCase() === addr?.toLowerCase() ? 'text-warning' : ''}>
                        {tx.from_addr.slice(0, 8)}…
                      </span>
                      {' → '}
                      {tx.to_addr ? tx.to_addr.slice(0, 8) + '…' : 'Contract'}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <TxTypeBadge kind={tx.tx_kind || tx.type} />
                    <div className="text-muted text-xs">
                      {tx.timestamp ? timeAgo(tx.timestamp) : `#${tx.block_number}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: NFTs */}
      {tab === 'nfts' && (
        nfts.length === 0 ? (
          <div className="card p-10 text-center text-muted text-sm">No NFTs held</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {nfts.map(nft => {
              let meta: Record<string, string> = {};
              try { meta = JSON.parse(nft.metadata); } catch { /* ignore */ }
              return (
                <Link key={nft.id} to={`/nft/${nft.id}`}
                  className="card p-4 hover:border-primary/40 transition-colors">
                  <div className="aspect-square bg-s2 rounded-lg mb-2 flex items-center justify-center text-3xl border border-border">
                    {meta.image
                      ? <img src={meta.image} alt="" className="w-full h-full object-cover rounded-lg" />
                      : <span className="text-primary/60">◈</span>}
                  </div>
                  <div className="text-xs text-muted truncate">{nft.collection_id.slice(0, 12)}…</div>
                  <div className="text-sm font-medium text-white truncate">{meta.name ?? `#${nft.item_id}`}</div>
                </Link>
              );
            })}
          </div>
        )
      )}

      {/* Tab: RWA */}
      {tab === 'rwa' && (
        rwaAssets.length === 0 ? (
          <div className="card p-10 text-center text-muted text-sm">No RWA assets</div>
        ) : (
          <div className="card overflow-hidden divide-y divide-border">
            {rwaAssets.map(asset => (
              <div key={asset.id} className="px-4 py-3 flex items-center justify-between hover:bg-s2 transition-colors">
                <div>
                  <div className="text-sm font-medium text-white font-mono">{asset.id.slice(0, 20)}…</div>
                  <div className="text-xs text-muted">{asset.asset_type} · {asset.jurisdiction || '—'}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-primary font-semibold text-sm">
                    ${Number(asset.valuation_usd).toLocaleString()}
                  </span>
                  <Badge value={asset.status} />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Tab: Validator */}
      {tab === 'validator' && validator && (
        <div>
          <div className="card p-6 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-primary">Validator Node</h2>
              <Badge value={validator.status} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
              {[
                ['Self Stake',  formatEKH(validator.stake,           0)],
                ['Delegated',   formatEKH(validator.delegated_stake, 0)],
                ['Total Stake', formatEKH(validator.total_stake,     0)],
                ['Commission',  `${validator.commission_pct}%`],
                ['Uptime',      `${validator.uptime}%`],
                ['Slashes',     validator.slash_count.toString()],
              ].map(([label, val]) => (
                <div key={label}>
                  <div className="text-muted text-xs mb-0.5">{label}</div>
                  <div className={`font-semibold ${label === 'Total Stake' ? 'text-primary' : 'text-white'}`}>{val}</div>
                </div>
              ))}
            </div>
            <Link to={`/validator/${addr}`} className="link text-sm">
              Full validator details →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
