import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { initDB, initSchema } from './models';
import { startIndexer, stopIndexer, setNewBlockCallback, syncValidators } from './indexer';
import { router } from './api/routes';

const PORT = Number(process.env.PORT ?? 3002);

// ── DB + Express ──────────────────────────────────────────────────────────────

initDB();
initSchema();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api', router);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

app.get('/metrics', (_req, res) => {
  res.json({
    uptime: process.uptime(),
    memMb:  Math.round(process.memoryUsage().heapUsed / 1_048_576),
    pid:    process.pid,
  });
});

// ── WebSocket broadcast ───────────────────────────────────────────────────────

const server  = http.createServer(app);
const wss     = new WebSocketServer({ server, path: '/ws' });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

function broadcast(msg: object): void {
  const payload = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch { clients.delete(client); }
    }
  }
}

setNewBlockCallback((blockNumber) => {
  broadcast({ type: 'NEW_BLOCK', blockNumber });
});

// ── Startup ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[Explorer API] http://localhost:${PORT}  WS: ws://localhost:${PORT}/ws`);
  startIndexer();
  // Initial validator sync (may fail if node is offline — that's OK)
  syncValidators().catch(() => null);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

const shutdown = (): void => {
  console.log('[Explorer] Shutting down…');
  stopIndexer();
  wss.close();
  server.close(() => process.exit(0));
};

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
