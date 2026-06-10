import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  api, Block, Transaction, Stats, BlockMetric,
  formatEKHCompact, timeAgo, shortHash,
} from '../api/client';
import StatCard from '../components/StatCard';
import TxTypeBadge from '../components/TxTypeBadge';
import CopyHash from '../components/CopyHash';
import { SkStatRow, SkTable } from '../components/Skeleton';
import { useLive } from '../components/Layout';

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function ChartTip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-s2 border border-border rounded-lg px-3 py-2 text-xs">
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted">{p.name}:</span>
          <span className="text-white font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [blocks,  setBlocks]  = useState<Block[]>([]);
  const [txs,     setTxs]     = useState<Transaction[]>([]);
  const [chart,   setChart]   = useState<BlockMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const { blockNumber, flash } = useLive();

  const load = useCallback(async () => {
    try {
      const [s, b, t, c] = await Promise.all([
        api.stats(),
        api.blocks(1, 8),
        api.transactions(1, 8),
        api.chart(),
      ]);
      setStats(s);
      setBlocks(b.data);
      setTxs(t.data);
      setChart(c);
    } catch { /* node offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch on new block from WS
  useEffect(() => { if (blockNumber > 0) load(); }, [blockNumber, load]);

  const burned      = stats?.tokenStats?.totalBurned
    ? formatEKHCompact(stats.tokenStats.totalBurned)
    : '—';
  const circulating = stats?.tokenStats?.circulatingSupply
    ? formatEKHCompact(stats.tokenStats.circulatingSupply)
    : '—';

  // Chart data: TPS per block
  const chartData = chart.slice(-60).map(m => ({
    n:  m.number,
    tx: m.tx_count,
    bt: +(m.block_time_ms / 1000).toFixed(1),
  }));

  if (loading) return (
    <div className="space-y-8">
      <SkStatRow />
      <div className="grid lg:grid-cols-2 gap-6"><SkTable /><SkTable /></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-up">

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">
          Ekehi <span className="text-gradient">Network</span>
        </h1>
        <p className="text-muted text-sm">Africa-first · EVM-compatible · Chain ID 8866</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Block Height"
          value={(stats?.blockCount ?? 0).toLocaleString()}
          sub={flash ? '● New block' : `~${stats?.avgBlockTime ?? 4}s avg`}
        />
        <StatCard
          label="Transactions"
          value={(stats?.txCount ?? 0).toLocaleString()}
          sub={`${stats?.tps ?? 0} TPS`}
        />
        <StatCard
          label="Validators"
          value={stats?.validatorCount ?? 0}
          sub={`${stats?.peerCount ?? 0} peers`}
        />
        <StatCard
          label="EKH Burned"
          value={burned}
          sub={`${circulating} circulating`}
        />
        <StatCard label="RWA Assets" value={stats?.rwaCount ?? 0} sub="Tokenized real assets" />
        <StatCard label="NFTs"        value={stats?.nftCount ?? 0} sub="On-chain collectibles" />
        <StatCard label="Chain ID"    value="8866" sub="EVM + native RPC" />
        <StatCard label="Block Time"  value={`${stats?.avgBlockTime ?? 4}s`} sub="Average last 20 blocks" />
      </div>

      {/* Chart */}
      {chartData.length > 5 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Transactions per Block (last 60)</h2>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FF9F00" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#FF9F00" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="n" tick={{ fill: '#666', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#666', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone" dataKey="tx" name="Txns"
                stroke="#FF9F00" strokeWidth={2}
                fill="url(#txGrad)" dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Latest blocks + txs */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Blocks */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-white">Latest Blocks</h2>
            <Link to="/blocks" className="link text-xs">View all →</Link>
          </div>
          <div className="card divide-y divide-border">
            {blocks.length === 0 ? (
              <div className="py-10 text-center text-muted text-sm">
                No blocks yet — start the node
              </div>
            ) : blocks.map(b => (
              <div key={b.hash} className="tr">
                <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  ⬡
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/block/${b.number}`} className="link font-semibold text-sm">
                    #{b.number.toLocaleString()}
                  </Link>
                  <div className="text-muted text-xs font-mono truncate">{shortHash(b.hash)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-white text-sm">{b.tx_count} txs</div>
                  <div className="text-muted text-xs">{timeAgo(b.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Transactions */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-white">Latest Transactions</h2>
            <Link to="/transactions" className="link text-xs">View all →</Link>
          </div>
          <div className="card divide-y divide-border">
            {txs.length === 0 ? (
              <div className="py-10 text-center text-muted text-sm">No transactions yet</div>
            ) : txs.map(tx => (
              <div key={tx.hash} className="tr">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${
                  tx.status === 1
                    ? 'bg-success/10 border-success/20 text-success'
                    : 'bg-danger/10 border-danger/20 text-danger'
                }`}>
                  {tx.status === 1 ? '✓' : '✗'}
                </div>
                <div className="flex-1 min-w-0">
                  <CopyHash hash={tx.hash} type="tx" className="text-sm" />
                  <div className="text-muted text-xs truncate font-mono">
                    {shortHash(tx.from_addr, 6, 4)} → {tx.to_addr ? shortHash(tx.to_addr, 6, 4) : 'Deploy'}
                  </div>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <TxTypeBadge kind={tx.tx_kind || tx.type} />
                  <div className="text-muted text-xs">#{tx.block_number}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
