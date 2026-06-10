import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Transaction, formatTs, timeAgo, formatEKH } from '../api/client';
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
  if (!hex) return '—';
  try { return parseInt(hex, 16).toLocaleString(); } catch { return hex; }
}

function parsedKindData(raw: string | undefined): Record<string, unknown> {
  try { return JSON.parse(raw ?? '{}'); } catch { return {}; }
}

// ── Native kind detail panel ──────────────────────────────────────────────────

function NativeKindPanel({ tx }: { tx: Transaction }) {
  const kd = parsedKindData(tx.kind_data);

  const rows: { label: string; value: string; addr?: boolean }[] = [];

  switch (tx.tx_kind) {
    case 'Stake':
      rows.push({ label: 'Validator', value: String(kd.validator ?? '—'), addr: true });
      rows.push({ label: 'Amount', value: formatEKH(String(kd.amount ?? '0')) + ' EKH' });
      rows.push({ label: 'Commission', value: kd.commissionPct + '%' });
      break;
    case 'Unstake':
      rows.push({ label: 'Validator', value: String(kd.validator ?? '—'), addr: true });
      break;
    case 'Delegate':
    case 'Undelegate':
      rows.push({ label: 'Validator', value: String(kd.validator ?? '—'), addr: true });
      rows.push({ label: 'Amount', value: formatEKH(String(kd.amount ?? '0')) + ' EKH' });
      break;
    case 'ClaimRewards':
      rows.push({ label: 'Validator', value: String(kd.validator ?? '—'), addr: true });
      break;
    case 'MintNft':
      rows.push({ label: 'Collection', value: String(kd.collectionId ?? '—') });
      rows.push({ label: 'Recipient', value: String(kd.recipient ?? '—'), addr: true });
      if (kd.metadata) rows.push({ label: 'Metadata', value: String(kd.metadata).slice(0, 80) });
      break;
    case 'CreateCollection':
      rows.push({ label: 'Name', value: String(kd.name ?? '—') });
      rows.push({ label: 'Symbol', value: String(kd.symbol ?? '—') });
      rows.push({ label: 'Royalty', value: kd.royaltyBps ? kd.royaltyBps + ' bps' : '0' });
      rows.push({ label: 'Mint Price', value: formatEKH(String(kd.mintPrice ?? '0')) + ' EKH' });
      if (kd.maxSupply) rows.push({ label: 'Max Supply', value: String(kd.maxSupply) });
      break;
    case 'TransferNft':
      rows.push({ label: 'NFT ID', value: String(kd.nftId ?? '—') });
      rows.push({ label: 'To', value: String(kd.to ?? '—'), addr: true });
      break;
    case 'BurnNft':
      rows.push({ label: 'NFT ID', value: String(kd.nftId ?? '—') });
      break;
    case 'ListNft':
      rows.push({ label: 'NFT ID', value: String(kd.nftId ?? '—') });
      rows.push({ label: 'Price', value: formatEKH(String(kd.price ?? '0')) + ' EKH' });
      break;
    case 'BuyNft':
      rows.push({ label: 'NFT ID', value: String(kd.nftId ?? '—') });
      break;
    case 'TokenizeAsset':
      rows.push({ label: 'Asset Type', value: String(kd.assetType ?? '—') });
      rows.push({ label: 'Name', value: String(kd.name ?? '—') });
      break;
    case 'TransferRwaShares':
      rows.push({ label: 'Asset', value: String(kd.assetId ?? '—') });
      rows.push({ label: 'To', value: String(kd.to ?? '—'), addr: true });
      rows.push({ label: 'Amount', value: String(kd.amount ?? '—') + ' shares' });
      break;
    case 'ListRwaShares':
      rows.push({ label: 'Asset', value: String(kd.assetId ?? '—') });
      rows.push({ label: 'Shares', value: String(kd.shares ?? '—') });
      rows.push({ label: 'Price/Share', value: formatEKH(String(kd.pricePerShare ?? '0')) + ' EKH' });
      break;
    case 'Propose':
      rows.push({ label: 'Type', value: String(kd.proposalType ?? '—') });
      rows.push({ label: 'Description', value: String(kd.description ?? '—') });
      break;
    case 'Vote':
      rows.push({ label: 'Proposal', value: String(kd.proposalId ?? '—') });
      rows.push({ label: 'Support', value: kd.support ? '✓ Yes' : '✗ No' });
      rows.push({ label: 'Conviction', value: String(kd.conviction ?? '1') + 'x' });
      break;
    case 'Swap':
      rows.push({ label: 'Pool', value: String(kd.poolId ?? '—') });
      rows.push({ label: 'Amount In', value: formatEKH(String(kd.amountIn ?? '0')) + ' EKH' });
      rows.push({ label: 'Asset In', value: String(kd.assetIn ?? '—'), addr: true });
      rows.push({ label: 'Min Out', value: formatEKH(String(kd.minAmountOut ?? '0')) });
      break;
    case 'CreatePool':
      rows.push({ label: 'Asset A', value: String(kd.assetA ?? '—'), addr: true });
      rows.push({ label: 'Asset B', value: String(kd.assetB ?? '—'), addr: true });
      rows.push({ label: 'Amount A', value: formatEKH(String(kd.amountA ?? '0')) });
      rows.push({ label: 'Amount B', value: formatEKH(String(kd.amountB ?? '0')) });
      break;
  }

  if (rows.length === 0) return null;

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-violet-400" />
        Native Transaction Details
      </h2>
      {rows.map(r => (
        <Field key={r.label} label={r.label}>
          {r.addr
            ? <CopyHash hash={r.value} type="address" full className="font-mono text-xs" />
            : <span className="text-white text-sm">{r.value}</span>}
        </Field>
      ))}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function TxDetail() {
  const { hash } = useParams<{ hash: string }>();
  const [tx,      setTx]      = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!hash) return;
    setLoading(true);
    api.transaction(hash)
      .then(setTx)
      .catch(() => setError('Transaction not found'))
      .finally(() => setLoading(false));
  }, [hash]);

  if (loading) return <SkDetail />;
  if (error || !tx) return (
    <div className="text-center py-20 text-muted">Transaction not found: {hash}</div>
  );

  const isNative = tx.type === 'Native';

  const valueWei = (() => {
    if (isNative) {
      const kd = parsedKindData(tx.kind_data);
      try { return BigInt(String(kd.amount ?? '0')); } catch { return 0n; }
    }
    try { return BigInt(tx.value ?? '0'); } catch { return 0n; }
  })();
  const valueEKH = valueWei > 0n
    ? (Number(valueWei) / 1e18).toFixed(6) + ' EKH'
    : null;

  const gasPrice = isNative
    ? (tx.gas_price ? (Number(tx.gas_price) / 1e9).toFixed(4) + ' gwei' : '—')
    : (tx.gas_price ? hexToNum(tx.gas_price) + ' wei' : '—');
  const gasLimit = tx.gas_limit ? (isNative ? Number(tx.gas_limit).toLocaleString() : hexToNum(tx.gas_limit)) + ' gas' : '—';
  const nonce    = isNative ? String(tx.nonce ?? 0) : hexToNum(tx.nonce);

  return (
    <div className="space-y-5 animate-slide-up">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-white">Transaction</h1>
        <Badge value={tx.status} label={tx.status === 1 ? 'Success' : 'Failed'} />
        <TxTypeBadge kind={tx.tx_kind} type={tx.type} />
      </div>

      {/* Core fields */}
      <div className="card p-6">
        <Field label="Hash">
          <CopyHash hash={tx.hash} full className="font-mono text-xs break-all" />
        </Field>
        <Field label="Status">
          <span className={tx.status === 1 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
            {tx.status === 1 ? '✓ Success' : '✗ Failed'}
          </span>
        </Field>
        <Field label="System">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-semibold ${
            isNative
              ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
              : 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
          }`}>
            {isNative ? '⬡ Native Ekehi transaction (port 9944)' : '⬢ EVM transaction (port 8545)'}
          </div>
        </Field>
        <Field label="Block">
          <CopyHash hash={tx.block_number.toString()} type="block" mono={false}
            className="text-primary font-semibold" />
          {tx.block_hash && (
            <span className="text-muted text-xs ml-2 font-mono">({tx.block_hash.slice(0, 14)}…)</span>
          )}
        </Field>
        {tx.timestamp ? (
          <Field label="Timestamp">
            <span className="text-white">{formatTs(tx.timestamp)}</span>
            <span className="text-muted text-xs ml-2">({timeAgo(tx.timestamp)})</span>
          </Field>
        ) : null}
        <Field label="From">
          <CopyHash hash={tx.from_addr} type="address" full className="font-mono text-xs" />
        </Field>
        {tx.to_addr ? (
          <Field label="To">
            <CopyHash hash={tx.to_addr} type="address" full className="font-mono text-xs" />
          </Field>
        ) : !isNative ? (
          <Field label="To"><span className="text-warning">Contract Creation</span></Field>
        ) : null}
        {valueEKH && (
          <Field label="Value">
            <span className="text-primary font-semibold">{valueEKH}</span>
          </Field>
        )}
        <Field label="Gas Limit">{gasLimit}</Field>
        <Field label="Gas Price">{gasPrice}</Field>
        <Field label="Nonce">{nonce}</Field>
        {!isNative && tx.input_data && tx.input_data !== '0x' && (
          <Field label="Input Data">
            <div className="bg-s2 border border-border rounded-lg p-3 font-mono text-xs text-muted break-all max-h-32 overflow-y-auto">
              {tx.input_data}
            </div>
          </Field>
        )}
      </div>

      {/* Native kind detail */}
      {isNative && <NativeKindPanel tx={tx} />}

      {/* Nav links */}
      <div className="flex gap-3 flex-wrap">
        <Link to={`/block/${tx.block_number}`} className="btn-ghost text-sm">← Block #{tx.block_number}</Link>
        <Link to={`/address/${tx.from_addr}`} className="btn-ghost text-sm">From address →</Link>
        {tx.to_addr && (
          <Link to={`/address/${tx.to_addr}`} className="btn-ghost text-sm">To address →</Link>
        )}
      </div>
    </div>
  );
}
