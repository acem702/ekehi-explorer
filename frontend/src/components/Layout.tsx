import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import clsx from 'clsx';
import logoUrl from '../../logo.png';

// ── Live block context ────────────────────────────────────────────────────────

interface WsCtx { blockNumber: number; flash: boolean; }
const WsContext = createContext<WsCtx>({ blockNumber: 0, flash: false });
export const useLive = () => useContext(WsContext);

// ── Search bar ────────────────────────────────────────────────────────────────

function SearchBar({ onClose }: { onClose?: () => void }) {
  const [q, setQ]         = useState('');
  const [busy, setBusy]   = useState(false);
  const navigate          = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const r = await api.search(trimmed);
      const routes: Record<string, string> = {
        block: `/block/${r.value}`,
        transaction: `/tx/${r.value}`,
        address: `/address/${r.value}`,
        rwa: `/rwa/${r.value}`,
      };
      navigate(routes[r.type] ?? `/tx/${r.value}`);
      setQ('');
      onClose?.();
    } catch {
      if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) navigate(`/tx/${trimmed}`);
      else if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) navigate(`/address/${trimmed}`);
      else if (/^\d+$/.test(trimmed)) navigate(`/block/${trimmed}`);
    } finally {
      setBusy(false);
      setQ('');
    }
  }

  return (
    <form onSubmit={submit} className="flex-1 max-w-2xl">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search block · tx hash · address…"
          className="input w-full pl-9 pr-16 text-sm"
        />
        <button type="submit" disabled={busy || !q.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary-deep disabled:opacity-30 px-2 py-1 rounded transition-colors">
          {busy ? '…' : 'Go'}
        </button>
      </div>
    </form>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/',              label: 'Home',       icon: '⬡' },
  { to: '/blocks',        label: 'Blocks',     icon: '□' },
  { to: '/transactions',  label: 'Txns',       icon: '↔' },
  { to: '/validators',    label: 'Validators', icon: '✦' },
  { to: '/defi',          label: 'DeFi',       icon: '⇄' },
  { to: '/governance',    label: 'Governance', icon: '⚖' },
  { to: '/rwa',           label: 'RWA',        icon: '🏢' },
  { to: '/nfts',          label: 'NFTs',       icon: '◈' },
];

// ── Layout ────────────────────────────────────────────────────────────────────

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [blockNumber, setBlockNumber] = useState(0);
  const [flash, setFlash]             = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // WebSocket
  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; blockNumber?: number };
        if (msg.type === 'NEW_BLOCK' && msg.blockNumber) {
          setBlockNumber(msg.blockNumber);
          setFlash(true);
          setTimeout(() => setFlash(false), 1000);
        }
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, []);

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to);

  return (
    <WsContext.Provider value={{ blockNumber, flash }}>
      <div className="min-h-screen flex flex-col bg-bg">

        {/* ── Top bar ── */}
        <header className="sticky top-0 z-50 border-b border-border bg-bg/95 backdrop-blur-sm">
          <div className="max-w-screen-2xl mx-auto px-4">

            {/* Row 1: Logo + Search + Status */}
            <div className="flex items-center gap-4 h-14">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 group-hover:shadow-[0_0_10px_rgba(255,159,0,0.5)] transition-all">
                  <img src={logoUrl} alt="Ekehi" className="w-full h-full object-cover scale-[1.35]" />
                </div>
                <span className="font-bold text-white text-sm hidden sm:block tracking-tight">
                  Ekehi <span className="text-primary">Explorer</span>
                </span>
              </Link>

              <SearchBar />

              {/* Chain badge + mobile menu */}
              <div className="flex items-center gap-2 shrink-0">
                <div className={clsx(
                  'hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all duration-300',
                  flash
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-border bg-s2 text-muted',
                )}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full', flash ? 'bg-primary animate-pulse-dot' : 'bg-muted')} />
                  {blockNumber > 0 ? `#${blockNumber.toLocaleString()}` : 'Chain 8866'}
                </div>
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="sm:hidden p-2 text-muted hover:text-white transition-colors"
                  aria-label="Menu"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {menuOpen
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
                  </svg>
                </button>
              </div>
            </div>

            {/* Row 2: Nav links */}
            <nav className={clsx(
              'hidden sm:flex gap-0.5 pb-1',
              menuOpen && '!flex flex-col gap-1 pb-3',
            )}>
              {NAV.map(({ to, label }) => (
                <Link key={to} to={to}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive(to)
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted hover:text-white hover:bg-s2',
                  )}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-8 animate-fade-in">
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="border-t border-border py-6">
          <div className="max-w-screen-2xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-muted text-xs">
            <span>Ekehi Network Explorer · Chain ID 8866 · Africa-first L1</span>
            <div className="flex items-center gap-4">
              <span>EVM RPC: 8545</span>
              <span>Native RPC: 9944</span>
              <a href="/health" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">Health</a>
            </div>
          </div>
        </footer>
      </div>
    </WsContext.Provider>
  );
}
