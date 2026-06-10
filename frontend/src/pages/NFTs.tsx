import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Nft, NftCollection } from '../api/client';
import CopyHash from '../components/CopyHash';
import Pagination from '../components/Pagination';
import { SkTable } from '../components/Skeleton';

function NftCard({ nft }: { nft: Nft }) {
  let meta: Record<string, string> = {};
  try { meta = JSON.parse(nft.metadata); } catch { /* ignore */ }

  return (
    <Link to={`/nft/${nft.id}`}
      className="card p-3 hover:border-primary/30 transition-colors group block">
      <div className="aspect-square bg-s2 rounded-xl mb-3 flex items-center justify-center border border-border group-hover:border-primary/20 transition-colors overflow-hidden">
        {meta.image
          ? <img src={meta.image} alt={meta.name ?? ''} className="w-full h-full object-cover" />
          : <span className="text-primary/30 text-4xl">◈</span>}
      </div>
      <div className="text-muted text-xs truncate mb-0.5">
        {nft.collection_id.slice(0, 14)}…
      </div>
      <div className="text-white text-sm font-semibold truncate">
        {meta.name ?? `#${nft.token_id}`}
      </div>
      <div className="text-muted text-xs mt-1 truncate font-mono">{nft.owner.slice(0, 10)}…</div>
      {nft.is_fractionalized === 1 && (
        <span className="inline-block mt-2 badge-warning text-xs">Fractionalized</span>
      )}
      {nft.listed_price && nft.listed_price !== '0' && (
        <div className="mt-1 text-primary text-xs font-semibold">
          {(Number(nft.listed_price) / 1e18).toFixed(4)} EKH
        </div>
      )}
    </Link>
  );
}

function CollectionCard({ col }: { col: NftCollection }) {
  return (
    <div className="card p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-s3 border border-border flex items-center justify-center text-primary/60 text-xl">
          ◈
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate">{col.name ?? col.id.slice(0, 16) + '…'}</div>
          <CopyHash hash={col.id} type="address" pre={8} suf={4} className="text-xs text-muted" />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{col.item_count ?? col.total_minted ?? 0} items</span>
        <CopyHash hash={col.owner} type="address" pre={5} suf={3} className="text-xs" />
      </div>
    </div>
  );
}

export default function NFTs() {
  const [nfts,        setNfts]        = useState<Nft[]>([]);
  const [collections, setCollections] = useState<NftCollection[]>([]);
  const [total,       setTotal]       = useState(0);
  const [pages,       setPages]       = useState(1);
  const [page,        setPage]        = useState(1);
  const [collFilter,  setCollFilter]  = useState('');
  const [tab,         setTab]         = useState<'nfts' | 'collections'>('nfts');
  const [loading,     setLoading]     = useState(true);
  const LIMIT = 24;

  useEffect(() => {
    setLoading(true);
    const nftsP = api.nfts(page, LIMIT, collFilter || undefined)
      .then(res => {
        const list = Array.isArray(res) ? res : res.data ?? [];
        setNfts(list);
        if (!Array.isArray(res)) { setTotal(res.total ?? 0); setPages(res.pages ?? 1); }
      });
    const colsP = api.nftCollections()
      .then(res => setCollections(Array.isArray(res) ? res : (res.data ?? [])))
      .catch(() => setCollections([]));
    Promise.all([nftsP, colsP])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, collFilter]);

  return (
    <div className="animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">NFTs</h1>
        <p className="text-muted text-sm">
          Dynamic NFTs · On-chain metadata · ERC-721 compatible · {total.toLocaleString()} total
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-5">
        {([['nfts', 'All NFTs'], ['collections', 'Collections']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-white'
            }`}>
            {label}
            {id === 'collections' && collections.length > 0 && (
              <span className="ml-1.5 text-xs bg-s3 px-1.5 py-0.5 rounded">{collections.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Collection filter (only in NFTs tab) */}
      {tab === 'nfts' && collections.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => { setCollFilter(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              !collFilter
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-s2 text-muted border-border hover:text-white'
            }`}>
            All
          </button>
          {collections.map(c => (
            <button key={c.id} onClick={() => { setCollFilter(c.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                collFilter === c.id
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-s2 text-muted border-border hover:text-white'
              }`}>
              {(c.name ?? c.id).slice(0, 14)}…
            </button>
          ))}
        </div>
      )}

      {/* NFTs grid */}
      {tab === 'nfts' && (
        loading ? <SkTable rows={4} cols={6} /> : nfts.length === 0 ? (
          <div className="card p-16 text-center text-muted">
            <div className="text-5xl mb-4 text-primary/20">◈</div>
            <div className="font-semibold text-white mb-1">No NFTs minted yet</div>
            <div className="text-xs">NFTs appear once minted via the NFT module.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {nfts.map(nft => <NftCard key={nft.id} nft={nft} />)}
            </div>
            <Pagination page={page} pages={pages} total={total} limit={LIMIT} onChange={setPage} />
          </>
        )
      )}

      {/* Collections grid */}
      {tab === 'collections' && (
        loading ? <SkTable rows={3} cols={3} /> : collections.length === 0 ? (
          <div className="card p-16 text-center text-muted">
            <div className="text-5xl mb-4 text-primary/20">◈</div>
            <div className="font-semibold text-white mb-1">No collections yet</div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {collections.map(c => <CollectionCard key={c.id} col={c} />)}
          </div>
        )
      )}
    </div>
  );
}
