import { useState, useEffect, useCallback } from 'react';
import { api, Transaction, timeAgo, formatEKH } from '../api/client';
import CopyHash from '../components/CopyHash';
import TxTypeBadge from '../components/TxTypeBadge';
import Pagination from '../components/Pagination';
import { SkTable } from '../components/Skeleton';
import { useLive } from '../components/Layout';

// ── Filter config ─────────────────────────────────────────────────────────────

type SystemFilter = 'All' | 'EVM' | 'Native';

const EVM_KINDS   = ['Transfer', 'Deploy', 'Contract'];
const NATIVE_KINDS = [
  'Stake', 'Unstake', 'Delegate', 'Undelegate', 'ClaimRewards',
  'MintNft', 'CreateCollection', 'TransferNft', 'BurnNft', 'ListNft', 'BuyNft',
  'TokenizeAsset', 'TransferRwaShares', 'ListRwaShares', 'BuyRwaShares',
  'Propose', 'Vote',
  'Swap', 'CreatePool', 'AddLiquidity', 'RemoveLiquidity',
];

const CATEGORY_FILTERS = [
  { label: 'Staking',    kinds: ['Stake', 'Unstake', 'Delegate', 'Undelegate', 'ClaimRewards'] },
  { label: 'NFT',        kinds: ['MintNft', 'CreateCollection', 'TransferNft', 'BurnNft', 'ListNft', 'BuyNft'] },
  { label: 'RWA',        kinds: ['TokenizeAsset', 'TransferRwaShares', 'ListRwaShares', 'BuyRwaShares', 'DistributeDividend', 'ClaimDividend'] },
  { label: 'Governance', kinds: ['Propose', 'Vote'] },
  { label: 'DeFi',       kinds: ['Swap', 'CreatePool', 'AddLiquidity', 'RemoveLiquidity'] },
  { label: 'EKH',        kinds: ['Transfer', 'Deploy'] },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function parsedKindData(raw: string | undefined): Record<string, unknown> {
  try { return JSON.parse(raw ?? '{}'); } catch { return {}; }
}

function txSummary(tx: Transaction): string {
  const kd = parsedKindData(tx.kind_data);
  switch (tx.tx_kind) {
    case 'Transfer':    return formatEKH(tx.value) + ' EKH';
    case 'Stake':       return formatEKH(String(kd.amount ?? '0')) + ' EKH staked';
    case 'Delegate':    return formatEKH(String(kd.amount ?? '0')) + ' EKH delegated';
    case 'Unstake':     return 'Unstake from validator';
    case 'Undelegate':  return 'Undelegate ' + formatEKH(String(kd.amount ?? '0')) + ' EKH';
    case 'ClaimRewards':return 'Claim staking rewards';
    case 'MintNft':     return 'Mint NFT';
    case 'CreateCollection': return `Collection "${kd.name ?? ''}"`;
    case 'TransferNft': return 'Transfer NFT';
    case 'BurnNft':     return 'Burn NFT';
    case 'ListNft':     return formatEKH(String(kd.price ?? '0')) + ' EKH listing';
    case 'BuyNft':      return 'Purchase NFT';
    case 'TokenizeAsset': return `Tokenize "${kd.name ?? ''}"`;
    case 'Propose':     return `Proposal: ${String(kd.description ?? '').slice(0, 40)}`;
    case 'Vote':        return kd.support ? 'Vote FOR' : 'Vote AGAINST';
    case 'Swap':        return formatEKH(String(kd.amountIn ?? '0')) + ' EKH swap';
    case 'CreatePool':  return 'Create AMM pool';
    case 'Deploy':      return 'Contract deploy';
    default:            return tx.tx_kind;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const LIMIT = 20;

export default function Transactions() {
  const [data,    setData]    = useState<Transaction[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [system,  setSystem]  = useState<SystemFilter>('All');
  const [category,setCategory]= useState<string>('');
  const [view,    setView]    = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(true);
  const { blockNumber } = useLive();

  const buildKindParam = useCallback(() => {
    if (category) return category;
    if (system === 'EVM')    return 'EVM_ALL';
    if (system === 'Native') return 'NATIVE_ALL';
    return '';
  }, [system, category]);

  async function load(p: number) {
    setLoading(true);
    try {
      const kind = buildKindParam();
      const res  = await api.transactions(p, LIMIT, kind || undefined);
      setData(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch { /* offline */ }
    setLoading(false);
  }

  useEffect(() => { load(page); }, [page, system, category]);
  useEffect(() => { if (page === 1 && blockNumber > 0) load(1); }, [blockNumber]);

  function pickSystem(s: SystemFilter) {
    setSystem(s);
    setCategory('');
    setPage(1);
  }

  function pickCategory(label: string) {
    setCategory(prev => prev === label ? '' : label);
    setSystem('All');
    setPage(1);
  }

  return (
    <div className="space-y-5 animate-slide-up">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-muted text-sm mt-0.5">{total.toLocaleString()} total</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex gap-1">
            {(['list', 'grid'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`p-2 rounded-lg text-xs border transition-colors ${
                  view === v
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-s2 text-muted border-border hover:text-white'
                }`}>
                {v === 'list' ? '☰' : '⊞'}
              </button>
            ))}
          </div>
          {/* Live dot */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* System toggle */}
      <div className="flex flex-wrap gap-2">
        {(['All', 'EVM', 'Native'] as SystemFilter[]).map(s => (
          <button key={s} onClick={() => pickSystem(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              system === s && !category
                ? s === 'Native'
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : s === 'EVM'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-s1 text-muted border border-border hover:text-white hover:border-white/10'
            }`}>
            {s === 'Native' ? '⬡ Native' : s === 'EVM' ? '⬢ EVM' : 'All'}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-dim self-center hidden sm:block">
          EVM = token sends &amp; contracts &nbsp;·&nbsp; Native = staking, NFT, RWA, governance
        </span>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map(c => (
          <button key={c.label} onClick={() => pickCategory(c.label)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              category === c.label
                ? 'bg-primary/15 text-primary border-primary/25'
                : 'bg-s1 text-dim border-border hover:text-white hover:border-border'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? <SkTable rows={12} cols={6} /> : data.length === 0 ? (
        <div className="card p-16 text-center space-y-2">
          <div className="text-3xl opacity-20">⟳</div>
          <p className="text-muted">No transactions match this filter.</p>
        </div>
      ) : view === 'list' ? (

        /* ── List / Table view ── */
        <div className="card overflow-hidden">
          <div className="hidden lg:grid grid-cols-[2fr_1.4fr_1.4fr_1fr_1.5fr_1fr] gap-3 px-4 py-2.5 bg-s2/60 border-b border-border text-xs text-dim font-medium uppercase tracking-wide">
            <span>Hash</span>
            <span>From</span>
            <span>To / Detail</span>
            <span>Block</span>
            <span>Action</span>
            <span className="text-right">Age</span>
          </div>

          <div className="divide-y divide-border/50">
            {data.map(tx => {
              const kd = parsedKindData(tx.kind_data);
              const isNative = tx.type === 'Native';
              const toAddr = tx.to_addr || (kd.to as string | undefined) || null;

              return (
                <div key={tx.hash} className="hover:bg-s2/40 transition-colors">

                  {/* Mobile row */}
                  <div className="lg:hidden px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <TxTypeBadge kind={tx.tx_kind} type={tx.type} />
                      <span className="text-xs text-muted/60">{tx.timestamp ? timeAgo(tx.timestamp) : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1 h-4 rounded-full flex-shrink-0 ${isNative ? 'bg-violet-500/60' : 'bg-sky-500/40'}`} />
                      <CopyHash hash={tx.hash} type="tx" className="text-xs" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <CopyHash hash={tx.from_addr} type="address" pre={5} suf={3} className="text-muted" />
                      <span className="text-muted/40">→</span>
                      {toAddr
                        ? <CopyHash hash={toAddr} type="address" pre={5} suf={3} className="text-muted" />
                        : <span className="text-muted/50 italic truncate">{txSummary(tx)}</span>}
                      <span className="ml-auto">
                        <CopyHash hash={tx.block_number.toString()} type="block" mono={false}
                          className="text-primary text-xs font-semibold" />
                      </span>
                    </div>
                  </div>

                  {/* Desktop row */}
                  <div className="hidden lg:grid grid-cols-[2fr_1.4fr_1.4fr_1fr_1.5fr_1fr] gap-3 px-4 py-3 items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-1.5 h-6 rounded-full flex-shrink-0 ${isNative ? 'bg-violet-500/60' : 'bg-sky-500/40'}`} />
                      <CopyHash hash={tx.hash} type="tx" className="text-xs" />
                    </div>
                    <CopyHash hash={tx.from_addr} type="address" pre={6} suf={4} className="text-xs text-muted" />
                    <div className="min-w-0">
                      {toAddr
                        ? <CopyHash hash={toAddr} type="address" pre={6} suf={4} className="text-xs text-muted" />
                        : <span className="text-xs text-muted/60 italic">{txSummary(tx)}</span>}
                    </div>
                    <CopyHash hash={tx.block_number.toString()} type="block" mono={false}
                      className="text-primary text-xs font-semibold" />
                    <TxTypeBadge kind={tx.tx_kind} type={tx.type} />
                    <span className="text-xs text-muted/60 text-right">{tx.timestamp ? timeAgo(tx.timestamp) : '—'}</span>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      ) : (

        /* ── Grid / Card view ── */
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.map(tx => {
            const kd = parsedKindData(tx.kind_data);
            const isNative = tx.type === 'Native';
            const toAddr = tx.to_addr || (kd.to as string | undefined) || null;
            const summary = txSummary(tx);

            return (
              <div key={tx.hash}
                className="card p-4 hover:border-primary/20 transition-colors space-y-3">

                {/* Top: type badge + age */}
                <div className="flex items-center justify-between">
                  <TxTypeBadge kind={tx.tx_kind} type={tx.type} />
                  <span className="text-[10px] text-muted/60">
                    {tx.timestamp ? timeAgo(tx.timestamp) : '—'}
                  </span>
                </div>

                {/* Hash with accent bar */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-1 h-4 rounded-full flex-shrink-0 ${isNative ? 'bg-violet-500/60' : 'bg-sky-500/50'}`} />
                  <CopyHash hash={tx.hash} type="tx" className="text-xs" />
                </div>

                {/* From → To */}
                <div className="flex items-center gap-1.5 text-xs min-w-0">
                  <CopyHash hash={tx.from_addr} type="address" pre={5} suf={3} className="text-muted" />
                  <span className="text-muted/40 flex-shrink-0">→</span>
                  {toAddr
                    ? <CopyHash hash={toAddr} type="address" pre={5} suf={3} className="text-muted" />
                    : <span className="text-muted/50 italic truncate">{summary}</span>}
                </div>

                {/* Block + summary */}
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <CopyHash hash={tx.block_number.toString()} type="block" mono={false}
                    className="text-primary text-xs font-semibold" />
                  <span className="text-xs text-muted/60 truncate max-w-[120px] text-right">{summary}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} limit={LIMIT} onChange={p => { setPage(p); }} />
    </div>
  );
}
