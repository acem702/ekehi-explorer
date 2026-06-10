import { useState, useEffect } from 'react';
import { api, Block, timeAgo } from '../api/client';
import CopyHash from '../components/CopyHash';
import Pagination from '../components/Pagination';
import { SkTable } from '../components/Skeleton';
import { useLive } from '../components/Layout';

export default function Blocks() {
  const [data,    setData]    = useState<Block[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const { blockNumber } = useLive();

  async function load(p: number) {
    setLoading(true);
    try {
      const res = await api.blocks(p, 20);
      setData(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch { /* offline */ }
    setLoading(false);
  }

  useEffect(() => { load(page); }, [page]);
  useEffect(() => { if (page === 1 && blockNumber > 0) load(1); }, [blockNumber]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Blocks</h1>
          <p className="text-muted text-sm mt-0.5">{total.toLocaleString()} indexed</p>
        </div>
      </div>

      {loading ? <SkTable rows={10} cols={5} /> : (
        <div className="card overflow-hidden">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-[5rem_1fr_1fr_6rem_7rem_6rem] gap-4 th border-b border-border bg-s2/40">
            <span>Block</span><span>Hash</span><span>Validator</span>
            <span className="text-right">Txns</span>
            <span className="text-right">Gas Used</span>
            <span className="text-right">Age</span>
          </div>

          <div className="divide-y divide-border">
            {data.map(b => (
              <div key={b.hash} className="hover:bg-s2 transition-colors">

                {/* Mobile row */}
                <div className="md:hidden px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <CopyHash hash={b.number.toString()} type="block" mono={false}
                      className="text-primary font-bold text-sm" />
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span>{b.tx_count} txs</span>
                      <span>·</span>
                      <span>{timeAgo(b.timestamp)}</span>
                    </div>
                  </div>
                  <CopyHash hash={b.hash} type="tx" pre={10} suf={6} className="text-xs text-muted" />
                  {b.validator && (
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="text-muted/50">validator</span>
                      <CopyHash hash={b.validator} type="address" pre={6} suf={4} className="text-xs" />
                    </div>
                  )}
                </div>

                {/* Desktop row */}
                <div className="hidden md:grid grid-cols-[5rem_1fr_1fr_6rem_7rem_6rem] gap-4 px-4 py-3 items-center text-sm">
                  <CopyHash hash={b.number.toString()} type="block" mono={false}
                    className="text-primary font-semibold" />
                  <CopyHash hash={b.hash} type="tx" pre={10} suf={6} className="text-xs" />
                  {b.validator
                    ? <CopyHash hash={b.validator} type="address" pre={8} suf={4} className="text-xs" />
                    : <span className="text-muted text-xs">—</span>}
                  <span className="text-right text-white">{b.tx_count}</span>
                  <span className="text-right text-muted text-xs">
                    {b.gas_used && b.gas_used !== '0x0'
                      ? parseInt(b.gas_used, 16).toLocaleString() : '—'}
                  </span>
                  <span className="text-right text-muted text-xs">{timeAgo(b.timestamp)}</span>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} limit={20} onChange={setPage} />
    </div>
  );
}
