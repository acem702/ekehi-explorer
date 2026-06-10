const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Block {
  hash: string;
  number: number;
  parent_hash: string;
  timestamp: number;
  validator: string;
  state_root: string;
  txs_root: string;
  gas_used: string;
  gas_limit: string;
  base_fee_per_gas: string;
  tx_count: number;
  total_burned: string;
  transactions?: Transaction[];
}

export interface Transaction {
  hash: string;
  block_hash: string;
  block_number: number;
  type: 'EVM' | 'Native';
  tx_kind: string;
  from_addr: string;
  to_addr: string | null;
  value: string;
  gas_limit: string;
  gas_price: string;
  nonce: string;
  input_data: string;
  status: number;
  timestamp: number;
  kind_data: string; // JSON string with native kind fields
}

export interface Validator {
  address: string;
  session_key: string;
  stake: string;
  delegated_stake: string;
  total_stake: string;
  commission_pct: string;
  status: string;
  uptime: number;
  slash_count: number;
  era_points: string;
  last_seen_block: number;
  blocks_produced: number;
  recentBlocks?: Block[];
}

export interface Account {
  address: string;
  balance: string;
  frozen: string;
  nonce: string;
  is_validator: number;
  tx_count: number;
  last_active: number;
}

export interface RwaAsset {
  id: string;
  asset_type: string;
  name: string;
  owner: string;
  title_hash: string;
  metadata_uri: string;
  jurisdiction: string;
  valuation_usd: string;
  total_shares: string;
  verified: number;
  accredited_only: number;
  status: string;
  created_block: number;
  updated_block: number;
  // Enterprise compliance & trading fields
  regulation_type: string;
  trading_fee_bps: number;
  lockup_until: string;
  max_concentration_pct: number;
  maturity_block: string;
  coupon_rate_bps: number;
  total_dividends_distributed: string;
  total_volume_traded: string;
  transfer_count: number;
}

export interface RwaShareholder {
  address: string;
  shares: string;
}

export interface RwaValuationEntry {
  block: number;
  valuationUsd: string;
  updatedBy: string;
}

export interface RwaDocument {
  hash: string;
  description: string;
  addedAt: number;
}

export interface RwaListing {
  id: string;
  asset_id: string;
  seller: string;
  shares: string;
  price_per_share: string;
  expires_at: string;
  min_purchase: string;
  status: string;
  created_block: number;
}

export interface NftCollection {
  id: string;
  name: string;
  symbol: string;
  owner: string;
  royalty_bps: number;
  mint_price: string;
  max_supply: number | null;
  total_minted: number;
  item_count?: number;
  metadata_base_uri: string;
  created_block: number;
}

export interface Nft {
  id: string;
  collection_id: string;
  collection_name?: string;
  token_id: string;
  item_id?: string;
  owner: string;
  metadata: string;
  locked: number;
  is_fractionalized?: number;
  listed_price: string | null;
  created_block: number;
}

export interface Proposal {
  id: string;
  proposer: string;
  title?: string;
  proposal_type: string;
  description: string;
  status: string;
  // snake_case (from DB)
  votes_for?: string;
  votes_against?: string;
  start_block?: number;
  end_block?: number;
  // camelCase aliases (populated by transformer)
  votesFor?: string;
  votesAgainst?: string;
  startBlock?: number;
  endBlock?: number;
  created_block: number;
}

export interface Pool {
  id: string;
  asset_a: string;
  asset_b: string;
  reserve_a: string;
  reserve_b: string;
  lp_supply: string;
  fee_bps: number;
  volume_24h: string;
  created_block: number;
}

export interface Stats {
  blockCount: number;
  txCount: number;
  validatorCount: number;
  rwaCount: number;
  nftCount: number;
  latestBlock?: { number: number; timestamp: number; tx_count: number };
  avgBlockTime: number;
  tps: number;
  peerCount: number;
  tokenStats?: { totalBurned: string; circulatingSupply: string; totalSupply: string };
}

export interface BlockMetric {
  number: number;
  timestamp: number;
  tx_count: number;
  block_time_ms: number;
}

// ── Normalizers ────────────────────────────────────────────────────────────────

function normalizeProposal(p: Proposal): Proposal {
  const q = p as unknown as Record<string, unknown>;
  return {
    ...p,
    votesFor:     (q.votes_for     ?? p.votesFor     ?? '0') as string,
    votesAgainst: (q.votes_against ?? p.votesAgainst ?? '0') as string,
    startBlock:   (q.start_block   ?? p.startBlock)          as number,
    endBlock:     (q.end_block     ?? p.endBlock)            as number,
  };
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  stats:   () => apiFetch<Stats>('/stats'),
  chart:   () => apiFetch<BlockMetric[]>('/stats/chart'),

  blocks: (page = 1, limit = 20) =>
    apiFetch<Paginated<Block>>(`/blocks?page=${page}&limit=${limit}`),
  block:  (param: string) => apiFetch<Block>(`/blocks/${param}`),

  transactions: (page = 1, limit = 20, kind?: string, address?: string) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (kind && kind !== 'ALL') qs.set('kind', kind);
    if (address) qs.set('address', address);
    return apiFetch<Paginated<Transaction>>(`/transactions?${qs}`);
  },
  transaction: (hash: string) => apiFetch<Transaction>(`/transactions/${hash}`),

  address: (addr: string, page = 1, limit = 25) =>
    apiFetch<{
      account: Account;
      transactions: Transaction[];
      txTotal: number;
      txPage: number;
      validator: Validator | null;
      nfts: Nft[];
      rwaAssets: RwaAsset[];
    }>(`/address/${addr}?page=${page}&limit=${limit}`),

  validators: () => apiFetch<Validator[]>('/validators'),
  validator:  (addr: string) => apiFetch<Validator>(`/validators/${addr}`),

  rwa:      (page = 1, type?: string) => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (type && type !== 'ALL') qs.set('type', type);
    return apiFetch<Paginated<RwaAsset>>(`/rwa?${qs}`);
  },
  rwaAsset:          (id: string) => apiFetch<RwaAsset & { listings: RwaListing[] }>(`/rwa/${id}`),
  rwaShareholders:   (id: string) => apiFetch<RwaShareholder[]>(`/rwa/${id}/shareholders`),
  rwaHistory:        (id: string) => apiFetch<RwaValuationEntry[]>(`/rwa/${id}/history`),
  rwaDocuments:      (id: string) => apiFetch<RwaDocument[]>(`/rwa/${id}/documents`),

  nftCollections: (page = 1) =>
    apiFetch<Paginated<NftCollection>>(`/nft-collections?page=${page}`),
  nftCollection:  (id: string) =>
    apiFetch<NftCollection & { nfts: Nft[] }>(`/nft-collections/${id}`),

  nfts: (page = 1, limit = 24, collection?: string) => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (collection) qs.set('collection', collection);
    return apiFetch<Paginated<Nft>>(`/nfts?${qs}`);
  },
  nft: (id: string) => apiFetch<Nft & { transfers: Transaction[] }>(`/nfts/${id}`),

  proposals: async (page = 1, status?: string): Promise<Paginated<Proposal>> => {
    const qs = new URLSearchParams({ page: String(page) });
    if (status && status !== 'ALL') qs.set('status', status);
    const res = await apiFetch<Paginated<Proposal>>(`/governance/proposals?${qs}`);
    return { ...res, data: res.data.map(normalizeProposal) };
  },
  proposal: async (id: string): Promise<Proposal> => {
    const res = await apiFetch<Proposal>(`/governance/proposals/${id}`);
    return normalizeProposal(res);
  },

  pools: () => apiFetch<Pool[]>('/pools'),

  search: (q: string) =>
    apiFetch<{ type: 'block' | 'transaction' | 'address' | 'rwa'; value: string }>(
      `/search?q=${encodeURIComponent(q)}`,
    ),
};

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatEKH(wei: string | number | bigint, decimals = 4): string {
  try {
    const n     = BigInt(wei.toString());
    const whole = n / 10n ** 18n;
    const frac  = n % 10n ** 18n;
    if (decimals === 0 || frac === 0n) return whole.toLocaleString() + ' EKH';
    const fracStr = frac.toString().padStart(18, '0').slice(0, decimals).replace(/0+$/, '');
    return `${whole.toLocaleString()}${fracStr ? '.' + fracStr : ''} EKH`;
  } catch { return '0 EKH'; }
}

export function formatEKHCompact(wei: string | number | bigint): string {
  try {
    const n = Number(BigInt(wei.toString())) / 1e18;
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B EKH';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(2) + 'M EKH';
    if (n >= 1_000)         return (n / 1_000).toFixed(2) + 'K EKH';
    return n.toFixed(4) + ' EKH';
  } catch { return '0 EKH'; }
}

export function formatHex(hex: string): string {
  if (!hex || hex === '0x0' || hex === '0x') return '0';
  try { return BigInt(hex).toLocaleString(); } catch { return hex; }
}

export function shortHash(hash: string, pre = 8, suf = 6): string {
  if (!hash || hash.length <= pre + suf + 3) return hash;
  return `${hash.slice(0, pre)}…${hash.slice(-suf)}`;
}

export function timeAgo(ts: number): string {
  if (!ts) return '—';
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function formatTs(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
