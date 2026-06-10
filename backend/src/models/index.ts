import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const DATA_DIR = path.resolve(process.env.DATA_DIR ?? './explorer-data');
const DB_PATH  = path.join(DATA_DIR, 'explorer.db');

let db: Database.Database;

export function initDB(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -32000');   // 32 MB page cache
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');
}

export function getDB(): Database.Database { return db; }

export function run(sql: string, ...params: (string | number | bigint | null)[]): Database.RunResult {
  return db.prepare(sql).run(...params);
}

export function get<T = Record<string, unknown>>(sql: string, ...params: (string | number | bigint | null)[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function all<T = Record<string, unknown>>(sql: string, ...params: (string | number | bigint | null)[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function initSchema(): void {
  db.exec(`
    -- Blocks
    CREATE TABLE IF NOT EXISTS blocks (
      hash              TEXT PRIMARY KEY,
      number            INTEGER NOT NULL,
      parent_hash       TEXT NOT NULL DEFAULT '',
      timestamp         INTEGER NOT NULL DEFAULT 0,
      validator         TEXT NOT NULL DEFAULT '',
      state_root        TEXT NOT NULL DEFAULT '',
      txs_root          TEXT NOT NULL DEFAULT '',
      gas_used          TEXT NOT NULL DEFAULT '0x0',
      gas_limit         TEXT NOT NULL DEFAULT '0x0',
      base_fee_per_gas  TEXT NOT NULL DEFAULT '0x0',
      tx_count          INTEGER NOT NULL DEFAULT 0,
      total_burned      TEXT NOT NULL DEFAULT '0'
    );

    -- EVM Transactions
    CREATE TABLE IF NOT EXISTS transactions (
      hash          TEXT PRIMARY KEY,
      block_hash    TEXT NOT NULL DEFAULT '',
      block_number  INTEGER NOT NULL DEFAULT 0,
      type          TEXT NOT NULL DEFAULT 'EVM',
      tx_kind       TEXT NOT NULL DEFAULT 'Transfer',
      from_addr     TEXT NOT NULL DEFAULT '',
      to_addr       TEXT,
      value         TEXT NOT NULL DEFAULT '0x0',
      gas_limit     TEXT NOT NULL DEFAULT '0x0',
      gas_price     TEXT NOT NULL DEFAULT '0x0',
      nonce         TEXT NOT NULL DEFAULT '0x0',
      input_data    TEXT NOT NULL DEFAULT '0x',
      status        INTEGER NOT NULL DEFAULT 1,
      timestamp     INTEGER NOT NULL DEFAULT 0,
      kind_data     TEXT NOT NULL DEFAULT '{}'
    );

    -- Validators
    CREATE TABLE IF NOT EXISTS validators (
      address         TEXT PRIMARY KEY,
      session_key     TEXT NOT NULL DEFAULT '',
      stake           TEXT NOT NULL DEFAULT '0',
      delegated_stake TEXT NOT NULL DEFAULT '0',
      total_stake     TEXT NOT NULL DEFAULT '0',
      commission_pct  TEXT NOT NULL DEFAULT '10',
      status          TEXT NOT NULL DEFAULT 'ACTIVE',
      uptime          REAL NOT NULL DEFAULT 100,
      slash_count     INTEGER NOT NULL DEFAULT 0,
      era_points      TEXT NOT NULL DEFAULT '0',
      last_seen_block INTEGER NOT NULL DEFAULT 0,
      blocks_produced INTEGER NOT NULL DEFAULT 0
    );

    -- Accounts
    CREATE TABLE IF NOT EXISTS accounts (
      address      TEXT PRIMARY KEY,
      balance      TEXT NOT NULL DEFAULT '0',
      frozen       TEXT NOT NULL DEFAULT '0',
      nonce        TEXT NOT NULL DEFAULT '0',
      is_validator INTEGER NOT NULL DEFAULT 0,
      tx_count     INTEGER NOT NULL DEFAULT 0,
      last_active  INTEGER NOT NULL DEFAULT 0
    );

    -- RWA Assets
    CREATE TABLE IF NOT EXISTS rwa_assets (
      id                           TEXT PRIMARY KEY,
      asset_type                   TEXT NOT NULL DEFAULT 'Property',
      name                         TEXT NOT NULL DEFAULT '',
      owner                        TEXT NOT NULL DEFAULT '',
      title_hash                   TEXT NOT NULL DEFAULT '',
      metadata_uri                 TEXT NOT NULL DEFAULT '',
      jurisdiction                 TEXT NOT NULL DEFAULT '',
      valuation_usd                TEXT NOT NULL DEFAULT '0',
      total_shares                 TEXT NOT NULL DEFAULT '0',
      verified                     INTEGER NOT NULL DEFAULT 0,
      accredited_only              INTEGER NOT NULL DEFAULT 0,
      status                       TEXT NOT NULL DEFAULT 'Active',
      created_block                INTEGER NOT NULL DEFAULT 0,
      updated_block                INTEGER NOT NULL DEFAULT 0,
      regulation_type              TEXT NOT NULL DEFAULT 'Open',
      trading_fee_bps              INTEGER NOT NULL DEFAULT 0,
      lockup_until                 TEXT NOT NULL DEFAULT '0',
      max_concentration_pct        INTEGER NOT NULL DEFAULT 0,
      maturity_block               TEXT NOT NULL DEFAULT '0',
      coupon_rate_bps              INTEGER NOT NULL DEFAULT 0,
      total_dividends_distributed  TEXT NOT NULL DEFAULT '0',
      total_volume_traded          TEXT NOT NULL DEFAULT '0',
      transfer_count               INTEGER NOT NULL DEFAULT 0
    );

    -- RWA Share Listings
    CREATE TABLE IF NOT EXISTS rwa_listings (
      id              TEXT PRIMARY KEY,
      asset_id        TEXT NOT NULL DEFAULT '',
      seller          TEXT NOT NULL DEFAULT '',
      shares          TEXT NOT NULL DEFAULT '0',
      price_per_share TEXT NOT NULL DEFAULT '0',
      expires_at      TEXT NOT NULL DEFAULT '0',
      min_purchase    TEXT NOT NULL DEFAULT '0',
      status          TEXT NOT NULL DEFAULT 'Open',
      created_block   INTEGER NOT NULL DEFAULT 0
    );

    -- NFT Collections
    CREATE TABLE IF NOT EXISTS nft_collections (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL DEFAULT '',
      symbol            TEXT NOT NULL DEFAULT '',
      owner             TEXT NOT NULL DEFAULT '',
      royalty_bps       INTEGER NOT NULL DEFAULT 0,
      mint_price        TEXT NOT NULL DEFAULT '0',
      max_supply        INTEGER,
      total_minted      INTEGER NOT NULL DEFAULT 0,
      metadata_base_uri TEXT NOT NULL DEFAULT '',
      created_block     INTEGER NOT NULL DEFAULT 0
    );

    -- NFTs
    CREATE TABLE IF NOT EXISTS nfts (
      id            TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL DEFAULT '',
      token_id      TEXT NOT NULL DEFAULT '',
      owner         TEXT NOT NULL DEFAULT '',
      metadata      TEXT NOT NULL DEFAULT '',
      locked        INTEGER NOT NULL DEFAULT 0,
      listed_price  TEXT,
      created_block INTEGER NOT NULL DEFAULT 0
    );

    -- Governance Proposals
    CREATE TABLE IF NOT EXISTS governance_proposals (
      id            TEXT PRIMARY KEY,
      proposer      TEXT NOT NULL DEFAULT '',
      proposal_type TEXT NOT NULL DEFAULT 'General',
      description   TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'Active',
      votes_for     TEXT NOT NULL DEFAULT '0',
      votes_against TEXT NOT NULL DEFAULT '0',
      start_block   INTEGER NOT NULL DEFAULT 0,
      end_block     INTEGER NOT NULL DEFAULT 0,
      created_block INTEGER NOT NULL DEFAULT 0
    );

    -- DEX Pools
    CREATE TABLE IF NOT EXISTS pools (
      id            TEXT PRIMARY KEY,
      asset_a       TEXT NOT NULL DEFAULT '',
      asset_b       TEXT NOT NULL DEFAULT '',
      reserve_a     TEXT NOT NULL DEFAULT '0',
      reserve_b     TEXT NOT NULL DEFAULT '0',
      lp_supply     TEXT NOT NULL DEFAULT '0',
      fee_bps       INTEGER NOT NULL DEFAULT 30,
      volume_24h    TEXT NOT NULL DEFAULT '0',
      created_block INTEGER NOT NULL DEFAULT 0
    );

    -- Block metrics for charts (TPS, block time)
    CREATE TABLE IF NOT EXISTS block_metrics (
      number        INTEGER PRIMARY KEY,
      timestamp     INTEGER NOT NULL DEFAULT 0,
      tx_count      INTEGER NOT NULL DEFAULT 0,
      block_time_ms INTEGER NOT NULL DEFAULT 0
    );

    -- Key-value store for indexer state
    CREATE TABLE IF NOT EXISTS chain_stats (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_blocks_number     ON blocks(number DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_block          ON transactions(block_number DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_from           ON transactions(from_addr);
    CREATE INDEX IF NOT EXISTS idx_tx_to             ON transactions(to_addr);
    CREATE INDEX IF NOT EXISTS idx_tx_kind           ON transactions(tx_kind);
    CREATE INDEX IF NOT EXISTS idx_tx_timestamp      ON transactions(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_nft_owner         ON nfts(owner);
    CREATE INDEX IF NOT EXISTS idx_nft_collection    ON nfts(collection_id);
    CREATE INDEX IF NOT EXISTS idx_rwa_owner         ON rwa_assets(owner);
    CREATE INDEX IF NOT EXISTS idx_rwa_type          ON rwa_assets(asset_type);
    CREATE INDEX IF NOT EXISTS idx_rwa_listing_asset ON rwa_listings(asset_id);
    CREATE INDEX IF NOT EXISTS idx_proposals_status  ON governance_proposals(status);
    CREATE INDEX IF NOT EXISTS idx_accounts_active   ON accounts(last_active DESC);
  `);
  // Migrations for existing databases
  const migrate = (sql: string) => { try { db.exec(sql); } catch { /* already exists */ } };
  migrate(`ALTER TABLE transactions ADD COLUMN kind_data TEXT NOT NULL DEFAULT '{}'`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN regulation_type TEXT NOT NULL DEFAULT 'Open'`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN trading_fee_bps INTEGER NOT NULL DEFAULT 0`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN lockup_until TEXT NOT NULL DEFAULT '0'`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN max_concentration_pct INTEGER NOT NULL DEFAULT 0`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN maturity_block TEXT NOT NULL DEFAULT '0'`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN coupon_rate_bps INTEGER NOT NULL DEFAULT 0`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN total_dividends_distributed TEXT NOT NULL DEFAULT '0'`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN total_volume_traded TEXT NOT NULL DEFAULT '0'`);
  migrate(`ALTER TABLE rwa_assets ADD COLUMN transfer_count INTEGER NOT NULL DEFAULT 0`);
  migrate(`ALTER TABLE rwa_listings ADD COLUMN expires_at TEXT NOT NULL DEFAULT '0'`);
  migrate(`ALTER TABLE rwa_listings ADD COLUMN min_purchase TEXT NOT NULL DEFAULT '0'`);

  console.log('[DB] Schema ready (WAL mode, 32 MB cache)');
}
