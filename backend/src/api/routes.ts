import { Router, Request, Response, NextFunction } from 'express';
import { get, all, run } from '../models';
import { evm, tryNative } from '../rpc';

export const router: Router = Router();

// ── In-memory rate limiter ────────────────────────────────────────────────────

const _rl = new Map<string, { count: number; reset: number }>();

function rateLimit(max = 120) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'x';
    const now = Date.now();
    const entry = _rl.get(key);
    if (!entry || entry.reset < now) {
      _rl.set(key, { count: 1, reset: now + 60_000 });
      return void next();
    }
    if (entry.count >= max) {
      res.status(429).json({ error: 'Rate limit exceeded. Max 120 req/min.' });
      return;
    }
    entry.count++;
    next();
  };
}

router.use(rateLimit(120));

// ── Pagination helper ─────────────────────────────────────────────────────────

function paginate(req: Request, defaultLimit = 20, maxLimit = 50) {
  const page  = Math.max(1, Number(req.query.page  ?? 1));
  const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit ?? defaultLimit)));
  return { page, limit, offset: (page - 1) * limit };
}

// ── Blocks ────────────────────────────────────────────────────────────────────

router.get('/blocks', (req, res) => {
  const { page, limit, offset } = paginate(req);
  const blocks = all('SELECT * FROM blocks ORDER BY number DESC LIMIT ? OFFSET ?', limit, offset);
  const total  = (get<{ c: number }>('SELECT COUNT(*) c FROM blocks') ?? { c: 0 }).c;
  res.json({ data: blocks, total, page, limit, pages: Math.ceil(total / limit) });
});

router.get('/blocks/:param', (req, res) => {
  const { param } = req.params;
  const block = /^\d+$/.test(param)
    ? get('SELECT * FROM blocks WHERE number = ?', Number(param))
    : get('SELECT * FROM blocks WHERE hash = ?', param);
  if (!block) return void res.status(404).json({ error: 'Block not found' });
  const txs = all('SELECT * FROM transactions WHERE block_hash = ?', (block as { hash: string }).hash);
  res.json({ ...(block as object), transactions: txs });
});

// ── Transactions ──────────────────────────────────────────────────────────────

router.get('/transactions', (req, res) => {
  const { page, limit, offset } = paginate(req);
  const kind    = req.query.kind as string | undefined;
  const address = req.query.address as string | undefined;

  let where = '';
  const args: (string | number)[] = [];

  if (kind === 'EVM_ALL') {
    where += ' AND type = ?'; args.push('EVM');
  } else if (kind === 'NATIVE_ALL') {
    where += ' AND type = ?'; args.push('Native');
  } else if (kind && kind !== 'ALL') {
    where += ' AND tx_kind = ?'; args.push(kind);
  }
  if (address) {
    const addr = address.toLowerCase();
    where += ' AND (from_addr = ? OR to_addr = ?)';
    args.push(addr, addr);
  }

  const txs   = all(
    `SELECT * FROM transactions WHERE 1=1${where} ORDER BY block_number DESC LIMIT ? OFFSET ?`,
    ...args, limit, offset,
  );
  const total = (get<{ c: number }>(
    `SELECT COUNT(*) c FROM transactions WHERE 1=1${where}`, ...args,
  ) ?? { c: 0 }).c;

  res.json({ data: txs, total, page, limit, pages: Math.ceil(total / limit) });
});

router.get('/transactions/:hash', (req, res) => {
  const tx = get('SELECT * FROM transactions WHERE hash = ?', req.params.hash);
  if (!tx) return void res.status(404).json({ error: 'Transaction not found' });
  res.json(tx);
});

// ── Addresses ─────────────────────────────────────────────────────────────────

router.get('/address/:address', async (req, res) => {
  const addr = req.params.address.toLowerCase();
  let account = get('SELECT * FROM accounts WHERE address = ?', addr);

  try {
    const [balRaw, nonceRaw] = await Promise.all([
      evm<string>('eth_getBalance', [req.params.address, 'latest']),
      evm<string>('eth_getTransactionCount', [req.params.address, 'latest']),
    ]);
    const balance = balRaw ? BigInt(balRaw).toString() : '0';
    const nonce   = nonceRaw ?? '0x0';
    if (account) {
      (account as Record<string, unknown>).balance = balance;
      (account as Record<string, unknown>).nonce   = nonce;
    } else {
      account = { address: addr, balance, frozen: '0', nonce, is_validator: 0, tx_count: 0, last_active: 0 };
    }
    // Persist refreshed balance
    run(
      `INSERT OR REPLACE INTO accounts (address, balance, frozen, nonce, is_validator, tx_count, last_active)
       VALUES (?, ?, '0', ?, 0, COALESCE((SELECT tx_count FROM accounts WHERE address = ?), 0), COALESCE((SELECT last_active FROM accounts WHERE address = ?), 0))`,
      addr, balance, nonce, addr, addr,
    );
  } catch {
    if (!account) account = { address: addr, balance: '0', frozen: '0', nonce: '0x0', tx_count: 0 };
  }

  const { page, limit, offset } = paginate(req, 25, 50);
  const transactions = all(
    `SELECT * FROM transactions WHERE from_addr = ? OR to_addr = ? ORDER BY block_number DESC LIMIT ? OFFSET ?`,
    addr, addr, limit, offset,
  );
  const txTotal = (get<{ c: number }>(
    'SELECT COUNT(*) c FROM transactions WHERE from_addr = ? OR to_addr = ?', addr, addr,
  ) ?? { c: 0 }).c;

  const validator = get('SELECT * FROM validators WHERE address = ?', addr);
  const nfts      = all('SELECT * FROM nfts WHERE owner = ? LIMIT 50', addr);
  const rwaAssets = all('SELECT * FROM rwa_assets WHERE owner = ? LIMIT 50', addr);
  const rwaHoldings = all('SELECT rwa_assets.*, rwa_listings.shares FROM rwa_assets LEFT JOIN rwa_listings ON rwa_listings.asset_id = rwa_assets.id WHERE rwa_listings.seller = ? LIMIT 20', addr);

  res.json({
    account,
    transactions,
    txTotal,
    txPage: page,
    validator: validator ?? null,
    nfts,
    rwaAssets,
    rwaHoldings,
  });
});

// ── Validators ────────────────────────────────────────────────────────────────

router.get('/validators', (_req, res) => {
  const validators = all('SELECT * FROM validators ORDER BY CAST(total_stake AS REAL) DESC');
  res.json(validators);
});

router.get('/validators/:address', (req, res) => {
  const v = get('SELECT * FROM validators WHERE address = ?', req.params.address.toLowerCase());
  if (!v) return void res.status(404).json({ error: 'Validator not found' });
  const recentBlocks = all(
    'SELECT * FROM blocks WHERE validator = ? ORDER BY number DESC LIMIT 20',
    req.params.address.toLowerCase(),
  );
  const delegators = all(
    'SELECT from_addr, value FROM transactions WHERE to_addr = ? AND tx_kind = ? ORDER BY block_number DESC LIMIT 30',
    req.params.address.toLowerCase(), 'Delegate',
  );
  res.json({ ...(v as object), recentBlocks, delegators });
});

// ── RWA ───────────────────────────────────────────────────────────────────────

router.get('/rwa', (req, res) => {
  const { page, limit, offset } = paginate(req, 20, 50);
  const type = req.query.type as string | undefined;
  const where = type && type !== 'ALL' ? ' WHERE asset_type = ?' : '';
  const args  = type && type !== 'ALL' ? [type] : [];

  const data  = all(`SELECT * FROM rwa_assets${where} ORDER BY created_block DESC LIMIT ? OFFSET ?`, ...args, limit, offset);
  const total = (get<{ c: number }>(`SELECT COUNT(*) c FROM rwa_assets${where}`, ...args) ?? { c: 0 }).c;
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
});

router.get('/rwa/:id', async (req, res) => {
  const asset = get('SELECT * FROM rwa_assets WHERE id = ?', req.params.id);
  if (!asset) return void res.status(404).json({ error: 'Asset not found' });

  const listings = all('SELECT * FROM rwa_listings WHERE asset_id = ? AND status = ?', req.params.id, 'Open');

  // Refresh live stats from node (volume, dividends, transfer count)
  const live = await tryNative<Record<string, unknown>>('ekh_getRwaAsset', [req.params.id]);

  res.json({ ...(asset as object), listings, live: live ?? null });
});

router.get('/rwa/:id/shareholders', async (req, res) => {
  const holders = await tryNative<Array<{ address: string; shares: string }>>(
    'ekh_getShareholders', [req.params.id],
  );
  res.json(holders ?? []);
});

router.get('/rwa/:id/history', async (req, res) => {
  const history = await tryNative<Array<{ block: number; valuationUsd: string; updatedBy: string }>>(
    'ekh_getRwaValuationHistory', [req.params.id],
  );
  res.json(history ?? []);
});

router.get('/rwa/:id/documents', async (req, res) => {
  const docs = await tryNative<Array<{ hash: string; description: string; addedAt: number }>>(
    'ekh_getRwaDocuments', [req.params.id],
  );
  res.json(docs ?? []);
});

// ── NFT Collections ───────────────────────────────────────────────────────────

router.get('/nft-collections', (req, res) => {
  const { page, limit, offset } = paginate(req);
  const data  = all('SELECT * FROM nft_collections ORDER BY created_block DESC LIMIT ? OFFSET ?', limit, offset);
  const total = (get<{ c: number }>('SELECT COUNT(*) c FROM nft_collections') ?? { c: 0 }).c;
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
});

router.get('/nft-collections/:id', (req, res) => {
  const coll = get('SELECT * FROM nft_collections WHERE id = ?', req.params.id);
  if (!coll) return void res.status(404).json({ error: 'Collection not found' });
  const nfts = all('SELECT * FROM nfts WHERE collection_id = ? LIMIT 100', req.params.id);
  res.json({ ...(coll as object), nfts });
});

// ── NFTs ──────────────────────────────────────────────────────────────────────

router.get('/nfts', (req, res) => {
  const { page, limit, offset } = paginate(req, 24, 60);
  const collection = req.query.collection as string | undefined;
  const where = collection ? ' WHERE collection_id = ?' : '';
  const args  = collection ? [collection] : [];

  const data  = all(`SELECT n.*, c.name as collection_name FROM nfts n LEFT JOIN nft_collections c ON c.id = n.collection_id${where} ORDER BY n.created_block DESC LIMIT ? OFFSET ?`, ...args, limit, offset);
  const total = (get<{ c: number }>(`SELECT COUNT(*) c FROM nfts${where}`, ...args) ?? { c: 0 }).c;
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
});

router.get('/nfts/:id', (req, res) => {
  const nft = get(
    'SELECT n.*, c.name as collection_name, c.royalty_bps FROM nfts n LEFT JOIN nft_collections c ON c.id = n.collection_id WHERE n.id = ?',
    req.params.id,
  );
  if (!nft) return void res.status(404).json({ error: 'NFT not found' });

  const { collection_id } = nft as { collection_id: string };
  const transfers = all(
    `SELECT * FROM transactions WHERE to_addr = ? AND tx_kind = 'NFT' ORDER BY block_number DESC LIMIT 20`,
    collection_id,
  );
  res.json({ ...(nft as object), transfers });
});

// ── Governance ────────────────────────────────────────────────────────────────

router.get('/governance/proposals', (req, res) => {
  const { page, limit, offset } = paginate(req);
  const status = req.query.status as string | undefined;
  const where  = status && status !== 'ALL' ? ' WHERE status = ?' : '';
  const args   = status && status !== 'ALL' ? [status] : [];

  const data  = all(`SELECT * FROM governance_proposals${where} ORDER BY created_block DESC LIMIT ? OFFSET ?`, ...args, limit, offset);
  const total = (get<{ c: number }>(`SELECT COUNT(*) c FROM governance_proposals${where}`, ...args) ?? { c: 0 }).c;
  res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
});

router.get('/governance/proposals/:id', (req, res) => {
  const proposal = get('SELECT * FROM governance_proposals WHERE id = ?', req.params.id);
  if (!proposal) return void res.status(404).json({ error: 'Proposal not found' });
  res.json(proposal);
});

// ── DeFi / Pools ──────────────────────────────────────────────────────────────

router.get('/pools', (_req, res) => {
  const pools = all('SELECT * FROM pools ORDER BY CAST(reserve_a AS REAL) DESC');
  res.json(pools);
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', async (_req, res) => {
  const latestBlock   = get<{ number: number; timestamp: number; tx_count: number }>(
    'SELECT number, timestamp, tx_count FROM blocks ORDER BY number DESC LIMIT 1',
  );
  const blockCount    = latestBlock?.number ?? 0;
  const txCount       = (get<{ c: number }>('SELECT COUNT(*) c FROM transactions') ?? { c: 0 }).c;
  const validatorCnt  = (get<{ c: number }>('SELECT COUNT(*) c FROM validators WHERE status = ?', 'ACTIVE') ?? { c: 0 }).c;
  const rwaCount      = (get<{ c: number }>('SELECT COUNT(*) c FROM rwa_assets') ?? { c: 0 }).c;
  const nftCount      = (get<{ c: number }>('SELECT COUNT(*) c FROM nfts') ?? { c: 0 }).c;

  // Average block time from last 20 blocks
  const recentMetrics = all<{ block_time_ms: number }>(
    'SELECT block_time_ms FROM block_metrics ORDER BY number DESC LIMIT 20',
  );
  const avgBlockTime = recentMetrics.length
    ? Math.round(recentMetrics.reduce((s, r) => s + r.block_time_ms, 0) / recentMetrics.length / 1000)
    : 4;

  // TPS: txns in last 60s window
  const tpsWindow = latestBlock ? latestBlock.timestamp - 60 : 0;
  const recentTxs = (get<{ c: number }>('SELECT COUNT(*) c FROM transactions WHERE timestamp > ?', tpsWindow) ?? { c: 0 }).c;
  const tps = +(recentTxs / 60).toFixed(2);

  let peerCount  = 0;
  let totalBurned = '0';
  let circulatingSupply = '1000000000000000000000000000';

  try {
    const pc = await evm<string>('net_peerCount');
    if (pc) peerCount = parseInt(pc, 16);
  } catch { /* offline */ }

  try {
    const stats = await tryNative<{ totalBurned?: string; circulatingSupply?: string }>('ekh_getTokenStats');
    if (stats) {
      totalBurned = stats.totalBurned ?? '0';
      circulatingSupply = stats.circulatingSupply ?? circulatingSupply;
    }
  } catch { /* offline */ }

  res.json({
    blockCount,
    txCount,
    validatorCount: validatorCnt,
    rwaCount,
    nftCount,
    latestBlock,
    avgBlockTime,
    tps,
    peerCount,
    tokenStats: { totalBurned, circulatingSupply, totalSupply: '1000000000000000000000000000' },
  });
});

// ── Chart data ────────────────────────────────────────────────────────────────

router.get('/stats/chart', (_req, res) => {
  const metrics = all<{ number: number; timestamp: number; tx_count: number; block_time_ms: number }>(
    'SELECT number, timestamp, tx_count, block_time_ms FROM block_metrics ORDER BY number DESC LIMIT 100',
  ).reverse();
  res.json(metrics);
});

// ── Search ────────────────────────────────────────────────────────────────────

router.get('/search', (req, res) => {
  const q = ((req.query.q as string) ?? '').trim();
  if (!q) return void res.status(400).json({ error: 'Missing query' });

  if (/^0x[0-9a-fA-F]{40}$/.test(q))
    return void res.json({ type: 'address', value: q.toLowerCase() });

  if (/^0x[0-9a-fA-F]{64}$/.test(q)) {
    const tx    = get('SELECT hash FROM transactions WHERE hash = ?', q);
    if (tx) return void res.json({ type: 'transaction', value: q });
    const block = get('SELECT hash FROM blocks WHERE hash = ?', q);
    if (block) return void res.json({ type: 'block', value: q });
    // Check RWA and NFT IDs
    const rwa = get('SELECT id FROM rwa_assets WHERE id = ?', q);
    if (rwa) return void res.json({ type: 'rwa', value: q });
    return void res.json({ type: 'transaction', value: q }); // optimistic
  }

  const num = /^0x[0-9a-fA-F]+$/.test(q)
    ? parseInt(q, 16)
    : /^\d+$/.test(q) ? Number(q) : null;

  if (num !== null) return void res.json({ type: 'block', value: num.toString() });

  res.status(404).json({ error: 'No match found' });
});
