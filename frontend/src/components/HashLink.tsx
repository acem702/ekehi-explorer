// Thin wrapper around CopyHash kept for backward compat
import CopyHash from './CopyHash';

interface Props {
  hash: string;
  type: 'block' | 'tx' | 'address' | 'rwa' | 'nft';
  pre?: number;
  suf?: number;
  full?: boolean;
  className?: string;
}

export default function HashLink({ hash, type, pre, suf, full, className }: Props) {
  if (!hash) return <span className="text-muted">—</span>;
  return <CopyHash hash={hash} type={type} pre={pre} suf={suf} full={full} className={className ?? 'text-sm'} />;
}
