import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Block, timeAgo, formatTs } from '../api/client';
import CopyHash from '../components/CopyHash';
import TxTypeBadge from '../components/TxTypeBadge';
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

function hexToNum(hex?: string): string {
  if (!hex || hex === '0x0') return '—';
  try { return parseInt(hex, 16).toLocaleString(); } catch { return hex; }
}

export default function BlockDetail() {
  const { param } = useParams<{ param: string }>();
  const [block,   setBlock]   = useState<Block | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!param) return;
    setLoading(true);
    api.block(param)
      .then(setBlock)
      .catch(() => setError('Block not found'))
      .finally(() => setLoading(false));
  }, [param]);

  if (loading) return <SkDetail />;
  if (error || !block) return (
    <div className="text-center py-20 text-muted">Block not found: {param}</div>
  );

  const txs = block.transactions ?? [];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center gap-3">
        <Link to="/blocks" className="text-muted hover:text-white text-sm transition-colors">← Blocks</Link>
        <span className="text-border">/</span>
        <h1 className="text-xl font-bold text-white">Block #{block.number.toLocaleString()}</h1>
        <Badge value="success" label="Confirmed" />
      </div>

      <div className="card p-6 space-y-0">
        <Field label="Block Number">
          <span className="text-primary font-semibold">#{block.number.toLocaleString()}</span>
          {block.number > 0 && (
            <span className="ml-4 space-x-3 text-xs">
              <Link to={`/block/${block.number - 1}`} className="link">← Prev</Link>
              <Link to={`/block/${block.number + 1}`} className="link">Next →</Link>
            </span>
          )}
        </Field>
        <Field label="Timestamp">
          <span className="text-white">{formatTs(block.timestamp)}</span>
          <span className="text-muted text-xs ml-2">({timeAgo(block.timestamp)})</span>
        </Field>
        <Field label="Hash">
          <CopyHash hash={block.hash} full className="font-mono text-xs break-all" />
        </Field>
        <Field label="Parent Hash">
          <CopyHash hash={block.parent_hash} type="block" full className="font-mono text-xs break-all" />
        </Field>
        {block.validator && (
          <Field label="Validator">
            <CopyHash hash={block.validator} type="address" full className="font-mono text-xs" />
          </Field>
        )}
        <Field label="Transactions">
          <span className="text-primary font-semibold">{block.tx_count}</span>
        </Field>
        <Field label="Gas Used">   {hexToNum(block.gas_used)}</Field>
        <Field label="Gas Limit">  {hexToNum(block.gas_limit)}</Field>
        {block.base_fee_per_gas && block.base_fee_per_gas !== '0x0' && (
          <Field label="Base Fee">{hexToNum(block.base_fee_per_gas)} wei</Field>
        )}
        <Field label="State Root">
          <CopyHash hash={block.state_root ?? '—'} className="font-mono text-xs break-all" />
        </Field>
        {block.txs_root && (
          <Field label="Txns Root">
            <CopyHash hash={block.txs_root} className="font-mono text-xs break-all" />
          </Field>
        )}
      </div>

      {txs.length > 0 && (
        <div>
          <h2 className="font-semibold text-white mb-3">
            {txs.length} Transaction{txs.length !== 1 ? 's' : ''}
          </h2>
          <div className="card overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_8rem_6rem] gap-4 th border-b border-border bg-s2/40">
              <span>Hash</span><span>From</span><span>To</span>
              <span className="text-right">Value</span><span className="text-center">Type</span>
            </div>
            <div className="divide-y divide-border">
              {txs.map(tx => {
                const valEKH = tx.value && tx.value !== '0x0'
                  ? (Number(BigInt(tx.value)) / 1e18).toFixed(4) + ' EKH'
                  : '0 EKH';
                return (
                  <div key={tx.hash}
                    className="grid md:grid-cols-[1fr_1fr_1fr_8rem_6rem] gap-4 px-4 py-3 items-center hover:bg-s2 transition-colors text-sm">
                    <CopyHash hash={tx.hash} type="tx" className="text-xs" />
                    <CopyHash hash={tx.from_addr} type="address" pre={6} suf={4} className="text-xs" />
                    {tx.to_addr
                      ? <CopyHash hash={tx.to_addr} type="address" pre={6} suf={4} className="text-xs" />
                      : <span className="text-warning text-xs">Contract Deploy</span>}
                    <span className="text-right text-white text-xs">{valEKH}</span>
                    <div className="flex justify-center">
                      <TxTypeBadge kind={tx.tx_kind || tx.type} />
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
