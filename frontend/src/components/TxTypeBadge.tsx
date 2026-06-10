import clsx from 'clsx';

// EVM kinds
const EVM_KINDS: Record<string, string> = {
  Transfer: 'bg-primary/10 text-primary border-primary/20',
  Deploy:   'bg-warning/10 text-warning border-warning/20',
  Contract: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

// Native kinds grouped by category
const NATIVE_KINDS: Record<string, string> = {
  // Staking
  Stake:          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Unstake:        'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Delegate:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Undelegate:     'bg-rose-500/10 text-rose-400 border-rose-500/20',
  ClaimRewards:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  // NFT
  CreateCollection: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  MintNft:          'bg-pink-500/10 text-pink-400 border-pink-500/20',
  TransferNft:      'bg-pink-500/10 text-pink-400 border-pink-500/20',
  BurnNft:          'bg-rose-500/10 text-rose-400 border-rose-500/20',
  ListNft:          'bg-amber-500/10 text-amber-400 border-amber-500/20',
  BuyNft:           'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DelistNft:        'bg-amber-500/10 text-amber-400 border-amber-500/20',
  // RWA
  TokenizeAsset:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  TransferRwaShares:'bg-purple-500/10 text-purple-400 border-purple-500/20',
  ListRwaShares:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  BuyRwaShares:     'bg-purple-500/10 text-purple-400 border-purple-500/20',
  DelistRwaShares:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  DistributeDividend:'bg-purple-500/10 text-purple-400 border-purple-500/20',
  ClaimDividend:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  // Governance
  Propose:          'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Vote:             'bg-amber-500/10 text-amber-400 border-amber-500/20',
  // AMM
  Swap:             'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  CreatePool:       'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  AddLiquidity:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  RemoveLiquidity:  'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

const KIND_LABELS: Record<string, string> = {
  CreateCollection: 'Collection',
  MintNft:          'Mint NFT',
  TransferNft:      'NFT Xfer',
  BurnNft:          'Burn NFT',
  ListNft:          'List NFT',
  BuyNft:           'Buy NFT',
  DelistNft:        'Delist',
  TokenizeAsset:    'Tokenize',
  TransferRwaShares:'RWA Xfer',
  ListRwaShares:    'RWA List',
  BuyRwaShares:     'RWA Buy',
  DelistRwaShares:  'Delist',
  DistributeDividend:'Dividend',
  ClaimDividend:    'Claim Div',
  ClaimRewards:     'Claim',
  CreatePool:       'New Pool',
  AddLiquidity:     'Add Liq',
  RemoveLiquidity:  'Rem Liq',
  Undelegate:       'Undelegate',
};

interface Props {
  kind: string;
  type?: 'EVM' | 'Native' | string;
}

export default function TxTypeBadge({ kind, type }: Props) {
  const color =
    EVM_KINDS[kind] ??
    NATIVE_KINDS[kind] ??
    'bg-s3 text-white/60 border-white/15';

  const label = KIND_LABELS[kind] ?? kind;

  return (
    <div className="flex items-center gap-1">
      {type && (
        <span className={clsx(
          'badge border text-[9px] font-bold tracking-wider px-1.5 py-0.5',
          type === 'Native'
            ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
            : 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        )}>
          {type}
        </span>
      )}
      <span className={clsx('badge border text-xs', color)}>
        {label}
      </span>
    </div>
  );
}
