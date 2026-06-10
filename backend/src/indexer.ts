import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { initSchema, run, get, all } from './models';
import { evm, tryNative } from './rpc';

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 4_000);

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let lastIndexedBlock = 0n;
let prevBlockTimestamp = 0;

let onNewBlock: ((blockNumber: number) => void) | null = null;
export function setNewBlockCallback(cb: (blockNumber: number) => void): void {
  onNewBlock = cb;
}

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] [Indexer] ${msg}`);
}

// ── Deployments ───────────────────────────────────────────────────────────────

interface Deployments {
  chainId?: number;
  EKHToken?: string;
  EKHStaking?: string;
  EKHAMM?: string;
  EKHRWARegistry?: string;
  EKHDynamicNFT?: string;
  EKHGovernor?: string;
  EKHGasSubsidy?: string;
}

let CONTRACTS: Deployments = {};
const ADDR_KIND: Record<string, string> = {};

function loadDeployments(): void {
  const candidates = [
    process.env.DEPLOYMENTS_PATH,
    path.resolve(__dirname, '../../deployments.json'),
    path.resolve(process.cwd(), 'deployments.json'),
    path.resolve(__dirname, '../../../../../contracts/deployments.json'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      CONTRACTS = JSON.parse(fs.readFileSync(p, 'utf8')) as Deployments;
      log(`Loaded deployments from ${p}`);
      buildAddrMap();
      return;
    } catch { /* try next candidate */ }
  }
  log('deployments.json not found — contract event indexing disabled; deploy contracts and set DEPLOYMENTS_PATH');
}

function buildAddrMap(): void {
  const mapping: [keyof Deployments, string][] = [
    ['EKHRWARegistry', 'RWA'],
    ['EKHDynamicNFT',  'NFT'],
    ['EKHGovernor',    'Governance'],
    ['EKHStaking',     'Stake'],
    ['EKHAMM',         'Swap'],
    ['EKHGasSubsidy',  'Contract'],
    ['EKHToken',       'Contract'],
  ];
  for (const [key, kind] of mapping) {
    const addr = CONTRACTS[key];
    if (addr) ADDR_KIND[addr.toLowerCase()] = kind;
  }
  log(`Address map: ${JSON.stringify(ADDR_KIND)}`);
}

function contractAddresses(): string[] {
  return Object.values(CONTRACTS).filter((v): v is string => typeof v === 'string' && v.startsWith('0x'));
}

// ── Event topic hashes ────────────────────────────────────────────────────────

const T = {
  Transfer:          ethers.id('Transfer(address,address,uint256)'),
  AssetTokenized:    ethers.id('AssetTokenized(uint256,uint8,address,bytes32)'),
  ProposalCreated:   ethers.id('ProposalCreated(uint256,address,uint8,string)'),
  VoteCast:          ethers.id('VoteCast(uint256,address,uint8,uint256)'),
  ProposalFinalized: ethers.id('ProposalFinalized(uint256,uint8)'),
  Staked:            ethers.id('Staked(address,uint256,uint256)'),
  Delegated:         ethers.id('Delegated(address,address,uint256)'),
  PoolCreated:       ethers.id('PoolCreated(bytes32,address,address,address)'),
  AMMSwap:           ethers.id('Swap(bytes32,address,address,uint256,uint256)'),
};

// ── ABI interfaces ────────────────────────────────────────────────────────────

const RWA_IFACE = new ethers.Interface([
  'function getAsset(uint256) view returns (uint256,uint8,address,bytes32,string,string,uint256,uint256,uint8,uint256,bool,bool)',
]);

const GOV_IFACE = new ethers.Interface([
  'function getProposal(uint256) view returns (uint256,address,uint8,string,bytes,address,uint256,uint256,uint256,uint256,uint256,uint8,uint256,uint256,uint256)',
]);

const NFT_IFACE = new ethers.Interface([
  'function tokenURI(uint256) view returns (string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
]);

const STAKING_IFACE = new ethers.Interface([
  'function validators(address) view returns (uint256,uint256,uint256,bool,uint256)',
]);

const AMM_IFACE = new ethers.Interface([
  'function allPoolsLength() view returns (uint256)',
  'function allPoolIds(uint256 index) view returns (bytes32)',
  'function getPool(bytes32 poolId) view returns (address tokenA, address tokenB, uint256 reserveA, uint256 reserveB, uint256 lpSupply, address lpToken)',
  'event PoolCreated(bytes32 indexed poolId, address tokenA, address tokenB, address lpToken)',
  'event Swap(bytes32 indexed poolId, address indexed trader, address tokenIn, uint256 amountIn, uint256 amountOut)',
]);

async function ethCall(to: string, data: string): Promise<string | null> {
  return evm<string>('eth_call', [{ to, data }, 'latest']);
}

// ── EVM log type ──────────────────────────────────────────────────────────────

interface EthLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

// ── Startup ───────────────────────────────────────────────────────────────────

export function startIndexer(): void {
  initSchema();
  loadDeployments();
  const stored = get<{ value: string }>('SELECT value FROM chain_stats WHERE key = ?', 'last_block');
  if (stored) lastIndexedBlock = BigInt(stored.value);
  log(`Starting from block ${lastIndexedBlock}`);

  // If we have contract addresses loaded and already-indexed blocks, backfill
  // events for those blocks (handles case where deployments.json was created
  // after the indexer already indexed past the deployment blocks).
  const hasContracts = Object.keys(ADDR_KIND).length > 0;
  const startup = hasContracts && lastIndexedBlock > 0n
    ? syncEvmEventsRange(1, Number(lastIndexedBlock))
        .then(() => log(`Event backfill complete through block ${lastIndexedBlock}`))
        .then(() => catchUp())
    : catchUp();

  startup
    .then(() => syncNativeState())
    .then(() => schedulePoll());
}

export function stopIndexer(): void {
  if (pollTimer) clearTimeout(pollTimer);
}

// ── Catch-up ──────────────────────────────────────────────────────────────────

async function catchUp(): Promise<void> {
  try {
    const raw = await evm<string>('eth_blockNumber');
    if (!raw) return;
    const tip = BigInt(raw);
    if (tip <= lastIndexedBlock) return;
    const from = Number(lastIndexedBlock) + 1;
    const to   = Number(tip);
    log(`Catching up: block ${from} → ${to}`);
    for (let n = BigInt(from); n <= tip; n++) {
      await indexBlock(n);
    }
    // Sync all contract events in the catch-up range in one batch call
    await syncEvmEventsRange(from, to);
    await syncValidators();
    await syncNativeState();
  } catch (e) {
    log(`Catch-up error: ${(e as Error).message}`);
  }
}

// ── Polling loop ──────────────────────────────────────────────────────────────

function schedulePoll(): void {
  pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
}

async function poll(): Promise<void> {
  try {
    const raw = await evm<string>('eth_blockNumber');
    if (raw) {
      const tip = BigInt(raw);
      if (tip > lastIndexedBlock) {
        for (let n = lastIndexedBlock + 1n; n <= tip; n++) {
          await indexBlock(n);
          await syncEvmEvents(Number(n));
        }
        if (Number(tip) % 10 === 0) {
          await syncValidators();
          await syncNativeState();
        }
      }
    }
  } catch (e) {
    log(`Poll error: ${(e as Error).message}`);
  }
  schedulePoll();
}

// ── EVM block indexer ─────────────────────────────────────────────────────────

interface RawBlock {
  hash: string;
  number: string;
  parentHash: string;
  timestamp: string;
  miner: string;
  stateRoot: string;
  transactionsRoot: string;
  gasUsed: string;
  gasLimit: string;
  baseFeePerGas?: string;
  transactions: RawTx[];
}

interface RawTx {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  input: string;
}

function classifyTx(tx: RawTx): string {
  if (!tx.to) return 'Deploy';
  const known = ADDR_KIND[tx.to.toLowerCase()];
  if (known) return known;
  const inp = tx.input ?? '0x';
  if (inp === '0x' || inp === '') return 'Transfer';
  return 'Contract';
}

interface NativeTxEntry {
  hash: string;
  from: string;
  nonce: number;
  gasPrice: string;
  gasLimit: number;
  blockNumber: number;
  blockHash: string;
  timestamp: number;
  type: 'Native' | 'Evm';
  kind: string;
  kindData: Record<string, unknown>;
}

async function indexBlock(blockNumber: bigint): Promise<void> {
  try {
    const num = Number(blockNumber);

    // Fetch block metadata + all txs with kind info in parallel
    const [block, nativeTxs] = await Promise.all([
      evm<RawBlock>('eth_getBlockByNumber', ['0x' + blockNumber.toString(16), true]),
      tryNative<NativeTxEntry[]>('ekh_getBlockTransactions', [num]),
    ]);
    if (!block) return;

    const ts = parseInt(block.timestamp, 16);
    const blockTimeMs = prevBlockTimestamp > 0
      ? Math.max(0, (ts - prevBlockTimestamp) * 1000)
      : 4_000;
    prevBlockTimestamp = ts;

    const totalTxCount = block.transactions.length;

    run(
      `INSERT OR REPLACE INTO blocks
         (hash, number, parent_hash, timestamp, validator, state_root, txs_root, gas_used, gas_limit, base_fee_per_gas, tx_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      block.hash, num, block.parentHash, ts,
      block.miner ?? '',
      block.stateRoot ?? '',
      block.transactionsRoot ?? '',
      block.gasUsed ?? '0x0',
      block.gasLimit ?? '0x0',
      block.baseFeePerGas ?? '0x0',
      totalTxCount,
    );

    run(
      `INSERT OR REPLACE INTO block_metrics (number, timestamp, tx_count, block_time_ms)
       VALUES (?, ?, ?, ?)`,
      num, ts, totalTxCount, blockTimeMs,
    );

    // Index native transactions from ekh_getBlockTransactions (post-rebuild)
    const nativeHashes = new Set<string>();
    if (nativeTxs && nativeTxs.length > 0) {
      for (const tx of nativeTxs) {
        if (tx.type !== 'Native') continue;
        nativeHashes.add(tx.hash.toLowerCase());
        const kindData = JSON.stringify(tx.kindData ?? {});
        run(
          `INSERT OR REPLACE INTO transactions
             (hash, block_hash, block_number, type, tx_kind, from_addr, to_addr, value, gas_limit, gas_price, nonce, input_data, status, timestamp, kind_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          tx.hash.toLowerCase(),
          block.hash,
          num,
          'Native',
          tx.kind,
          tx.from.toLowerCase(),
          (tx.kindData?.to as string | undefined)?.toLowerCase() ?? null,
          (tx.kindData?.amount as string | undefined) ?? '0x0',
          String(tx.gasLimit ?? 0),
          tx.gasPrice ?? '0',
          String(tx.nonce ?? 0),
          '0x',
          1,
          ts,
          kindData,
        );
        upsertAccount(tx.from, ts);
        if (tx.kindData?.to) upsertAccount(tx.kindData.to as string, ts);
      }
    }

    // Index EVM transactions (skip any already indexed as native)
    for (const tx of block.transactions) {
      if (nativeHashes.has(tx.hash.toLowerCase())) continue;
      const kind = classifyTx(tx);
      run(
        `INSERT OR REPLACE INTO transactions
           (hash, block_hash, block_number, type, tx_kind, from_addr, to_addr, value, gas_limit, gas_price, nonce, input_data, status, timestamp, kind_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        tx.hash,
        block.hash,
        num,
        'EVM',
        kind,
        tx.from.toLowerCase(),
        tx.to?.toLowerCase() ?? null,
        tx.value ?? '0x0',
        tx.gas ?? '0x0',
        tx.gasPrice ?? '0x0',
        tx.nonce ?? '0x0',
        tx.input ?? '0x',
        1,
        ts,
        '{}',
      );
      upsertAccount(tx.from, ts);
      if (tx.to) upsertAccount(tx.to, ts);
    }

    if (block.miner) {
      const addr = block.miner.toLowerCase();
      run(
        `UPDATE validators SET blocks_produced = blocks_produced + 1, last_seen_block = ? WHERE address = ?`,
        num, addr,
      );
    }

    run(`INSERT OR REPLACE INTO chain_stats (key, value) VALUES (?, ?)`, 'last_block', blockNumber.toString());
    lastIndexedBlock = blockNumber;
    onNewBlock?.(num);

    if (num % 100 === 0) {
      run(`DELETE FROM block_metrics WHERE number < (SELECT number FROM block_metrics ORDER BY number DESC LIMIT 1 OFFSET 499)`);
    }
  } catch (e) {
    log(`Error indexing block ${blockNumber}: ${(e as Error).message}`);
  }
}

function upsertAccount(address: string, lastActive: number): void {
  const addr = address.toLowerCase();
  run(
    `INSERT OR IGNORE INTO accounts (address, balance, frozen, nonce, tx_count, last_active) VALUES (?, '0', '0', '0', 0, 0)`,
    addr,
  );
  run(`UPDATE accounts SET tx_count = tx_count + 1, last_active = ? WHERE address = ?`, lastActive, addr);
}

// ── EVM event sync ────────────────────────────────────────────────────────────

async function syncEvmEvents(blockNumber: number): Promise<void> {
  await syncEvmEventsRange(blockNumber, blockNumber);
}

async function syncEvmEventsRange(fromBlock: number, toBlock: number): Promise<void> {
  const addrs = contractAddresses();
  if (addrs.length === 0) return;

  try {
    const logs = await evm<EthLog[]>('eth_getLogs', [{
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock:   '0x' + toBlock.toString(16),
      address:   addrs,
    }]);
    if (!Array.isArray(logs) || logs.length === 0) return;
    log(`Processing ${logs.length} event(s) in blocks ${fromBlock}–${toBlock}`);
    await processLogs(logs);
  } catch (e) {
    log(`syncEvmEventsRange error: ${(e as Error).message}`);
  }
}

async function processLogs(logs: EthLog[]): Promise<void> {
  for (const evt of logs) {
    const addr = evt.address.toLowerCase();
    const t0   = evt.topics[0];
    if (!t0) continue;

    if (addr === CONTRACTS.EKHRWARegistry?.toLowerCase() && t0 === T.AssetTokenized) {
      await handleAssetTokenized(evt);

    } else if (addr === CONTRACTS.EKHDynamicNFT?.toLowerCase() && t0 === T.Transfer) {
      await handleNftTransfer(evt);

    } else if (addr === CONTRACTS.EKHGovernor?.toLowerCase()) {
      if      (t0 === T.ProposalCreated)   await handleProposalCreated(evt);
      else if (t0 === T.VoteCast)          await handleVoteCast(evt);
      else if (t0 === T.ProposalFinalized) await handleProposalFinalized(evt);

    } else if (addr === CONTRACTS.EKHStaking?.toLowerCase()) {
      if      (t0 === T.Staked)    await handleStaked(evt);
      else if (t0 === T.Delegated) handleDelegated(evt);

    } else if (addr === CONTRACTS.EKHAMM?.toLowerCase()) {
      if      (t0 === T.PoolCreated) await handlePoolCreated(evt);
      else if (t0 === T.AMMSwap)     handleAMMSwap(evt);
    }
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

const ASSET_TYPES  = ['Property', 'Business', 'Commodity', 'Financial', 'IP', 'Other'];
const ASSET_STATUS = ['Active', 'Frozen', 'Redeemed'];
const GOV_TYPES    = ['General', 'ParameterChange', 'Upgrade', 'Treasury', 'Emergency'];
const GOV_STATUS   = ['Pending', 'Active', 'Passed', 'Failed', 'Executed', 'Canceled'];

async function handleAssetTokenized(evt: EthLog): Promise<void> {
  try {
    if (!CONTRACTS.EKHRWARegistry) return;
    const assetId  = BigInt(evt.topics[1]).toString();
    const calldata = RWA_IFACE.encodeFunctionData('getAsset', [assetId]);
    const result   = await ethCall(CONTRACTS.EKHRWARegistry, calldata);
    if (!result || result === '0x') return;
    const r = RWA_IFACE.decodeFunctionResult('getAsset', result);
    const blockNum = parseInt(evt.blockNumber, 16);
    run(
      `INSERT OR REPLACE INTO rwa_assets
         (id, asset_type, name, owner, title_hash, metadata_uri, jurisdiction,
          valuation_usd, total_shares, verified, accredited_only, status, created_block, updated_block)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      (r[0] as bigint).toString(),
      ASSET_TYPES[Number(r[1])] ?? 'Property',
      '',
      (r[2] as string).toLowerCase(),
      r[3] as string,
      r[4] as string,
      r[5] as string,
      (r[6] as bigint).toString(),
      (r[7] as bigint).toString(),
      r[11] ? 1 : 0,
      ASSET_STATUS[Number(r[8])] ?? 'Active',
      blockNum, blockNum,
    );
    log(`RWA asset tokenized: id=${(r[0] as bigint).toString()}`);
  } catch (e) {
    log(`handleAssetTokenized error: ${(e as Error).message}`);
  }
}

async function handleNftTransfer(evt: EthLog): Promise<void> {
  try {
    if (!CONTRACTS.EKHDynamicNFT) return;
    const from     = ('0x' + evt.topics[1].slice(-40)).toLowerCase();
    const to       = ('0x' + evt.topics[2].slice(-40)).toLowerCase();
    const tokenId  = BigInt(evt.topics[3]).toString();
    const blockNum = parseInt(evt.blockNumber, 16);
    const isMint   = from === '0x0000000000000000000000000000000000000000';
    const collAddr = CONTRACTS.EKHDynamicNFT.toLowerCase();

    let tokenUri = '';
    try {
      const uriData = NFT_IFACE.encodeFunctionData('tokenURI', [tokenId]);
      const uriHex  = await ethCall(CONTRACTS.EKHDynamicNFT, uriData);
      if (uriHex && uriHex !== '0x') {
        [tokenUri] = NFT_IFACE.decodeFunctionResult('tokenURI', uriHex) as [string];
      }
    } catch { /* tokenURI may revert */ }

    if (isMint) {
      // Ensure collection row exists
      const existsColl = get<{ id: string }>('SELECT id FROM nft_collections WHERE id = ?', collAddr);
      if (!existsColl) {
        let name = 'Ekehi Dynamic NFT';
        let symbol = 'EKHNFT';
        try {
          const [nameHex, symHex] = await Promise.all([
            ethCall(CONTRACTS.EKHDynamicNFT, NFT_IFACE.encodeFunctionData('name', [])),
            ethCall(CONTRACTS.EKHDynamicNFT, NFT_IFACE.encodeFunctionData('symbol', [])),
          ]);
          if (nameHex && nameHex !== '0x') [name] = NFT_IFACE.decodeFunctionResult('name', nameHex) as [string];
          if (symHex  && symHex  !== '0x') [symbol] = NFT_IFACE.decodeFunctionResult('symbol', symHex) as [string];
        } catch { /* use defaults */ }
        run(
          `INSERT OR IGNORE INTO nft_collections
             (id, name, symbol, owner, royalty_bps, mint_price, max_supply, total_minted, metadata_base_uri, created_block)
           VALUES (?, ?, ?, ?, 250, '0', NULL, 0, '', ?)`,
          collAddr, name, symbol, to, blockNum,
        );
      }
      run(`UPDATE nft_collections SET total_minted = total_minted + 1 WHERE id = ?`, collAddr);
    }

    run(
      `INSERT OR REPLACE INTO nfts
         (id, collection_id, token_id, owner, metadata, locked, listed_price, created_block)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
      `${collAddr}-${tokenId}`,
      collAddr,
      tokenId,
      to,
      tokenUri,
      blockNum,
    );
    log(`NFT ${isMint ? 'minted' : 'transferred'}: tokenId=${tokenId} to=${to}`);
  } catch (e) {
    log(`handleNftTransfer error: ${(e as Error).message}`);
  }
}

async function refreshProposal(proposalId: string, blockNum: number): Promise<void> {
  if (!CONTRACTS.EKHGovernor) return;
  try {
    const calldata = GOV_IFACE.encodeFunctionData('getProposal', [proposalId]);
    const result   = await ethCall(CONTRACTS.EKHGovernor, calldata);
    if (!result || result === '0x') return;
    const r = GOV_IFACE.decodeFunctionResult('getProposal', result);
    const existing = get<{ created_block: number }>(
      'SELECT created_block FROM governance_proposals WHERE id = ?', proposalId,
    );
    run(
      `INSERT OR REPLACE INTO governance_proposals
         (id, proposer, proposal_type, description, status, votes_for, votes_against,
          start_block, end_block, created_block)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      (r[0] as bigint).toString(),
      (r[1] as string).toLowerCase(),
      GOV_TYPES[Number(r[2])]  ?? 'General',
      r[3] as string,
      GOV_STATUS[Number(r[11])] ?? 'Pending',
      (r[8] as bigint).toString(),
      (r[9] as bigint).toString(),
      Number(r[6]),
      Number(r[7]),
      existing?.created_block ?? blockNum,
    );
  } catch (e) {
    log(`refreshProposal error: ${(e as Error).message}`);
  }
}

async function handleProposalCreated(evt: EthLog): Promise<void> {
  const proposalId = BigInt(evt.topics[1]).toString();
  await refreshProposal(proposalId, parseInt(evt.blockNumber, 16));
  log(`Proposal created: id=${proposalId}`);
}

async function handleVoteCast(evt: EthLog): Promise<void> {
  const proposalId = BigInt(evt.topics[1]).toString();
  await refreshProposal(proposalId, parseInt(evt.blockNumber, 16));
}

async function handleProposalFinalized(evt: EthLog): Promise<void> {
  const proposalId = BigInt(evt.topics[1]).toString();
  await refreshProposal(proposalId, parseInt(evt.blockNumber, 16));
  log(`Proposal finalized: id=${proposalId}`);
}

async function handleStaked(evt: EthLog): Promise<void> {
  try {
    if (!CONTRACTS.EKHStaking) return;
    const validator = ('0x' + evt.topics[1].slice(-40)).toLowerCase();
    const [amount, commBps] = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], evt.data);
    const blockNum = parseInt(evt.blockNumber, 16);

    let stake     = (amount as bigint).toString();
    let delegated = '0';
    let active    = true;
    let slashCount = 0;

    try {
      const calldata = STAKING_IFACE.encodeFunctionData('validators', [validator]);
      const result   = await ethCall(CONTRACTS.EKHStaking, calldata);
      if (result && result !== '0x') {
        const r = STAKING_IFACE.decodeFunctionResult('validators', result);
        stake      = (r[0] as bigint).toString();
        delegated  = (r[1] as bigint).toString();
        active     = r[3] as boolean;
        slashCount = Number(r[4]);
      }
    } catch { /* use event data as fallback */ }

    const total    = (BigInt(stake) + BigInt(delegated)).toString();
    const existing = get<Record<string, unknown>>('SELECT * FROM validators WHERE address = ?', validator);
    run(
      `INSERT OR REPLACE INTO validators
         (address, stake, delegated_stake, total_stake, commission_pct, status, slash_count,
          session_key, uptime, era_points, blocks_produced, last_seen_block)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      validator, stake, delegated, total,
      String(Number(commBps) / 100),
      active ? 'ACTIVE' : 'INACTIVE',
      slashCount,
      String(existing?.session_key ?? ''),
      Number(existing?.uptime ?? 100),
      String(existing?.era_points ?? '0'),
      Number(existing?.blocks_produced ?? 0),
      blockNum,
    );
    log(`Validator staked: ${validator} stake=${stake}`);
  } catch (e) {
    log(`handleStaked error: ${(e as Error).message}`);
  }
}

function handleDelegated(evt: EthLog): void {
  try {
    const validator = ('0x' + evt.topics[2].slice(-40)).toLowerCase();
    const [amount]  = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], evt.data);
    const existing  = get<{ delegated_stake: string; total_stake: string }>(
      'SELECT delegated_stake, total_stake FROM validators WHERE address = ?', validator,
    );
    if (!existing) return;
    const newDelegated = (BigInt(existing.delegated_stake ?? '0') + (amount as bigint)).toString();
    const newTotal     = (BigInt(existing.total_stake    ?? '0') + (amount as bigint)).toString();
    run('UPDATE validators SET delegated_stake = ?, total_stake = ? WHERE address = ?',
      newDelegated, newTotal, validator);
  } catch (e) {
    log(`handleDelegated error: ${(e as Error).message}`);
  }
}

// ── AMM event handlers ────────────────────────────────────────────────────────

async function handlePoolCreated(evt: EthLog): Promise<void> {
  try {
    const ammAddr = CONTRACTS.EKHAMM;
    if (!ammAddr) return;
    const poolId  = evt.topics[1];
    const blockNum = parseInt(evt.blockNumber, 16);
    const poolHex = await ethCall(ammAddr, AMM_IFACE.encodeFunctionData('getPool', [poolId]));
    if (!poolHex || poolHex === '0x') {
      // Decode from event data as fallback
      const decoded = AMM_IFACE.parseLog({ topics: evt.topics, data: evt.data });
      if (!decoded) return;
      run(
        `INSERT OR IGNORE INTO pools
           (id, asset_a, asset_b, reserve_a, reserve_b, lp_supply, fee_bps, volume_24h, created_block)
         VALUES (?, ?, ?, '0', '0', '0', 30, '0', ?)`,
        poolId,
        (decoded.args[1] as string).toLowerCase(),
        (decoded.args[2] as string).toLowerCase(),
        blockNum,
      );
    } else {
      const p = AMM_IFACE.decodeFunctionResult('getPool', poolHex);
      run(
        `INSERT OR IGNORE INTO pools
           (id, asset_a, asset_b, reserve_a, reserve_b, lp_supply, fee_bps, volume_24h, created_block)
         VALUES (?, ?, ?, ?, ?, ?, 30, '0', ?)`,
        poolId,
        (p[0] as string).toLowerCase(),
        (p[1] as string).toLowerCase(),
        (p[2] as bigint).toString(),
        (p[3] as bigint).toString(),
        (p[4] as bigint).toString(),
        blockNum,
      );
    }
    log(`Pool created: ${poolId}`);
  } catch (e) {
    log(`handlePoolCreated error: ${(e as Error).message}`);
  }
}

function handleAMMSwap(evt: EthLog): void {
  try {
    const poolId = evt.topics[1];
    const decoded = AMM_IFACE.parseLog({ topics: evt.topics, data: evt.data });
    if (!decoded) return;
    const amountIn = decoded.args[3] as bigint;
    const existing = get<{ volume_24h: string }>('SELECT volume_24h FROM pools WHERE id = ?', poolId);
    if (existing) {
      const newVol = (BigInt(existing.volume_24h || '0') + amountIn).toString();
      run('UPDATE pools SET volume_24h = ? WHERE id = ?', newVol, poolId);
    }
  } catch (e) {
    log(`handleAMMSwap error: ${(e as Error).message}`);
  }
}

// ── Validator sync — reads from native ekh_getValidators ─────────────────────

export async function syncValidators(): Promise<void> {
  try {
    const validators = await tryNative<Array<{
      address: string;
      stake: string;
      delegatedStake: string;
      totalStake: string;
      commissionPct: number;
      status: string;
      slashCount: number;
      uptime: number;
    }>>('ekh_getValidators');

    if (!validators || !validators.length) {
      log('syncValidators: native node returned no validators');
      return;
    }

    for (const v of validators) {
      const addr = v.address.toLowerCase();
      const existing = get<Record<string, unknown>>('SELECT * FROM validators WHERE address = ?', addr);
      run(
        `INSERT OR REPLACE INTO validators
           (address, stake, delegated_stake, total_stake, commission_pct, status, slash_count,
            session_key, uptime, era_points, blocks_produced, last_seen_block)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        addr,
        v.stake ?? '0',
        v.delegatedStake ?? '0',
        v.totalStake ?? '0',
        String(v.commissionPct ?? 10),
        (v.status ?? 'Active').toUpperCase(),
        Number(v.slashCount ?? 0),
        String(existing?.session_key ?? ''),
        Number(v.uptime ?? 1) * 100,
        String(existing?.era_points ?? '0'),
        Number(existing?.blocks_produced ?? 0),
        Number(existing?.last_seen_block ?? 0),
      );
    }
    log(`syncValidators: upserted ${validators.length} validator(s)`);
  } catch (e) {
    log(`syncValidators error: ${(e as Error).message}`);
  }
}

// ── Native state sync — polls ekh_* endpoints for NFTs, RWA, proposals ───────

export async function syncNativeState(): Promise<void> {
  await Promise.all([
    syncNftCollections(),
    syncAllNfts(),
    syncRwaAssets(),
    syncRwaListings(),
    syncGovernanceProposals(),
    syncPools(),
  ]);
}

async function syncAllNfts(): Promise<void> {
  try {
    const nfts = await tryNative<Array<{
      id: string; collectionId: string; tokenId: string | number;
      owner: string; metadata: string; locked: boolean;
    }>>('ekh_getAllNfts');
    if (!nfts || !nfts.length) return;

    for (const n of nfts) {
      // Find listing price from listings table if locked
      run(
        `INSERT OR REPLACE INTO nfts
           (id, collection_id, token_id, owner, metadata, locked, listed_price, created_block)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        n.id, n.collectionId ?? '',
        String(n.tokenId ?? ''), (n.owner ?? '').toLowerCase(),
        n.metadata ?? '', n.locked ? 1 : 0, null, 0,
      );
    }
    log(`syncAllNfts: synced ${nfts.length} NFT(s)`);
  } catch (e) {
    log(`syncAllNfts error: ${(e as Error).message}`);
  }
}

async function syncNftCollections(): Promise<void> {
  try {
    const cols = await tryNative<Array<{
      id: string; name: string; symbol: string; creator: string;
      royaltyBps: number; mintPrice: string; maxSupply: number | null;
      minted: number; metadataBaseUri: string;
    }>>('ekh_getAllCollections');
    if (!cols) return;

    for (const c of cols) {
      run(
        `INSERT OR REPLACE INTO nft_collections
           (id, name, symbol, owner, royalty_bps, mint_price, max_supply, total_minted, metadata_base_uri, created_block)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.id, c.name, c.symbol, (c.creator ?? '').toLowerCase(),
        c.royaltyBps ?? 0, c.mintPrice ?? '0',
        c.maxSupply ?? null, c.minted ?? 0,
        c.metadataBaseUri ?? '', 0,
      );
    }

    if (cols.length) log(`syncNftCollections: synced ${cols.length} collection(s)`);
  } catch (e) {
    log(`syncNftCollections error: ${(e as Error).message}`);
  }
}

async function syncNftsForCollection(collectionId: string): Promise<void> {
  try {
    // Use ekh_getNftsByCollection if available, fall back to silent failure
    const nfts = await tryNative<Array<{
      id: string; collectionId: string; tokenId: string | number;
      owner: string; metadata: string; locked: boolean; listedPrice?: string;
    }>>('ekh_getNftsByCollection', [collectionId]);
    if (!nfts) return;

    for (const n of nfts) {
      run(
        `INSERT OR REPLACE INTO nfts
           (id, collection_id, token_id, owner, metadata, locked, listed_price, created_block)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        n.id, n.collectionId ?? collectionId,
        String(n.tokenId ?? ''), (n.owner ?? '').toLowerCase(),
        n.metadata ?? '', n.locked ? 1 : 0,
        n.listedPrice ?? null, 0,
      );
    }
  } catch { /* not all nodes implement this method */ }
}

async function syncRwaAssets(): Promise<void> {
  try {
    const assets = await tryNative<Array<{
      id: string; assetType: string; name: string; owner: string;
      titleHash: string; metadataUri: string; jurisdiction: string;
      valuationUsd: string; totalShares: string;
      verified: boolean; accreditedOnly: boolean; status: string;
      createdAt: number; updatedAt: number;
      regulationType: string; tradingFeeBps: number;
      lockupUntil: string; maxConcentrationPct: number;
      maturityBlock: string; couponRateBps: number;
      totalDividendsDistributed: string; totalVolumeTraded: string;
      transferCount: number;
    }>>('ekh_getAllRwaAssets');
    if (!assets || !assets.length) return;

    for (const a of assets) {
      run(
        `INSERT OR REPLACE INTO rwa_assets
           (id, asset_type, name, owner, title_hash, metadata_uri, jurisdiction,
            valuation_usd, total_shares, verified, accredited_only, status,
            created_block, updated_block,
            regulation_type, trading_fee_bps, lockup_until, max_concentration_pct,
            maturity_block, coupon_rate_bps, total_dividends_distributed,
            total_volume_traded, transfer_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        a.id,
        a.assetType ?? 'Property',
        a.name ?? '',
        (a.owner ?? '').toLowerCase(),
        a.titleHash ?? '',
        a.metadataUri ?? '',
        a.jurisdiction ?? '',
        a.valuationUsd ?? '0',
        a.totalShares ?? '0',
        a.verified ? 1 : 0,
        a.accreditedOnly ? 1 : 0,
        a.status ?? 'Active',
        a.createdAt ?? 0,
        a.updatedAt ?? 0,
        a.regulationType ?? 'Open',
        a.tradingFeeBps ?? 0,
        a.lockupUntil ?? '0',
        a.maxConcentrationPct ?? 0,
        a.maturityBlock ?? '0',
        a.couponRateBps ?? 0,
        a.totalDividendsDistributed ?? '0',
        a.totalVolumeTraded ?? '0',
        a.transferCount ?? 0,
      );
    }
    log(`syncRwaAssets: synced ${assets.length} asset(s)`);
  } catch (e) {
    log(`syncRwaAssets error: ${(e as Error).message}`);
  }
}

async function syncRwaListings(): Promise<void> {
  try {
    const listings = await tryNative<Array<{
      id: string; assetId: string; seller: string;
      shares: string; pricePerShare: string;
      listedAt: number; expiresAt: string; minPurchase: string;
    }>>('ekh_getRwaListings');
    if (!listings || !listings.length) return;

    for (const l of listings) {
      run(
        `INSERT OR REPLACE INTO rwa_listings
           (id, asset_id, seller, shares, price_per_share, expires_at, min_purchase, status, created_block)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        l.id,
        l.assetId ?? '',
        (l.seller ?? '').toLowerCase(),
        l.shares ?? '0',
        l.pricePerShare ?? '0',
        l.expiresAt ?? '0',
        l.minPurchase ?? '0',
        'Open',
        l.listedAt ?? 0,
      );
    }
    log(`syncRwaListings: synced ${listings.length} listing(s)`);
  } catch (e) {
    log(`syncRwaListings error: ${(e as Error).message}`);
  }
}

async function syncGovernanceProposals(): Promise<void> {
  try {
    const proposals = await tryNative<Array<{
      id: string; proposer: string; proposalType: string; description: string;
      status: string; votesFor: string; votesAgainst: string;
      startBlock: number; endBlock: number;
    }>>('ekh_getProposals');
    if (!proposals || !proposals.length) return;

    for (const p of proposals) {
      run(
        `INSERT OR REPLACE INTO governance_proposals
           (id, proposer, proposal_type, description, status, votes_for, votes_against,
            start_block, end_block, created_block)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, (p.proposer ?? '').toLowerCase(),
        p.proposalType ?? 'General', p.description ?? '',
        p.status ?? 'Active', p.votesFor ?? '0', p.votesAgainst ?? '0',
        p.startBlock ?? 0, p.endBlock ?? 0, p.startBlock ?? 0,
      );
    }
    log(`syncGovernanceProposals: synced ${proposals.length} proposal(s)`);
  } catch (e) {
    log(`syncGovernanceProposals error: ${(e as Error).message}`);
  }
}

async function syncPools(): Promise<void> {
  const ammAddr = CONTRACTS.EKHAMM;
  if (!ammAddr) return;
  try {
    const lenHex = await ethCall(ammAddr, AMM_IFACE.encodeFunctionData('allPoolsLength'));
    if (!lenHex || lenHex === '0x') return;
    const len = Number(AMM_IFACE.decodeFunctionResult('allPoolsLength', lenHex)[0]);
    if (len === 0) return;

    for (let i = 0; i < len; i++) {
      const idHex = await ethCall(ammAddr, AMM_IFACE.encodeFunctionData('allPoolIds', [i]));
      if (!idHex || idHex === '0x') continue;
      const poolId = AMM_IFACE.decodeFunctionResult('allPoolIds', idHex)[0] as string;

      const poolHex = await ethCall(ammAddr, AMM_IFACE.encodeFunctionData('getPool', [poolId]));
      if (!poolHex || poolHex === '0x') continue;
      const p = AMM_IFACE.decodeFunctionResult('getPool', poolHex);

      // Insert if new, always update reserves and lp_supply
      run(
        `INSERT OR IGNORE INTO pools
           (id, asset_a, asset_b, reserve_a, reserve_b, lp_supply, fee_bps, volume_24h, created_block)
         VALUES (?, ?, ?, ?, ?, ?, 30, '0', 0)`,
        poolId,
        (p[0] as string).toLowerCase(),
        (p[1] as string).toLowerCase(),
        (p[2] as bigint).toString(),
        (p[3] as bigint).toString(),
        (p[4] as bigint).toString(),
      );
      run(
        `UPDATE pools SET asset_a = ?, asset_b = ?, reserve_a = ?, reserve_b = ?, lp_supply = ? WHERE id = ?`,
        (p[0] as string).toLowerCase(),
        (p[1] as string).toLowerCase(),
        (p[2] as bigint).toString(),
        (p[3] as bigint).toString(),
        (p[4] as bigint).toString(),
        poolId,
      );
    }
    log(`syncPools: synced ${len} pool(s) from EVM AMM`);
  } catch (e) {
    log(`syncPools error: ${(e as Error).message}`);
  }
}
