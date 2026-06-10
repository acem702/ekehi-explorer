import clsx from 'clsx';

interface Props {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onChange: (p: number) => void;
}

export default function Pagination({ page, pages, total, limit, onChange }: Props) {
  if (pages <= 1) return null;

  const from = Math.min((page - 1) * limit + 1, total);
  const to   = Math.min(page * limit, total);

  const win: (number | '…')[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) win.push(i);
  } else {
    win.push(1);
    if (page > 3) win.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) win.push(i);
    if (page < pages - 2) win.push('…');
    win.push(pages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs">
      <span className="text-muted">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="btn-ghost px-2.5 py-1.5 disabled:opacity-30">‹</button>
        {win.map((w, i) => w === '…'
          ? <span key={`e${i}`} className="px-2 text-muted">…</span>
          : <button key={w} onClick={() => onChange(w as number)}
              className={clsx('px-3 py-1.5 rounded-lg font-medium transition-colors',
                page === w
                  ? 'bg-primary text-bg'
                  : 'bg-s2 text-muted hover:text-white hover:bg-s3 border border-border')}>
              {w}
            </button>
        )}
        <button onClick={() => onChange(page + 1)} disabled={page >= pages}
          className="btn-ghost px-2.5 py-1.5 disabled:opacity-30">›</button>
      </div>
    </div>
  );
}
