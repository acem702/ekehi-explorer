import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { shortHash } from '../api/client';
import clsx from 'clsx';

interface Props {
  hash: string;
  type?: 'address' | 'block' | 'tx' | 'rwa' | 'nft' | null;
  pre?: number;
  suf?: number;
  full?: boolean;
  className?: string;
  mono?: boolean;
}

function routeFor(type: Props['type'], value: string): string | null {
  switch (type) {
    case 'address': return `/address/${value}`;
    case 'block':   return `/block/${value}`;
    case 'tx':      return `/tx/${value}`;
    case 'rwa':     return `/rwa/${value}`;
    case 'nft':     return `/nft/${value}`;
    default:        return null;
  }
}

export default function CopyHash({ hash, type, pre = 8, suf = 6, full = false, className, mono = true }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => null);
  }, [hash]);

  const display = full ? hash : shortHash(hash, pre, suf);
  const route   = type ? routeFor(type, hash) : null;

  const base = clsx(
    'group inline-flex items-center gap-1.5',
    mono && 'font-mono',
    className,
  );

  const text = (
    <span className="flex items-center gap-1.5">
      <span className={clsx(route && 'link')}>{display}</span>
      <button
        onClick={copy}
        title="Copy"
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-primary"
      >
        {copied
          ? <svg className="w-3 h-3 text-success" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          : <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
        }
      </button>
    </span>
  );

  if (route) {
    return <Link to={route} className={base}>{text}</Link>;
  }
  return <span className={base}>{text}</span>;
}
