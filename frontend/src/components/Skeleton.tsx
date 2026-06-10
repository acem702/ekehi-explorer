import React from 'react';
import clsx from 'clsx';

interface Props { className?: string; style?: React.CSSProperties; }

export function Sk({ className, style }: Props) {
  return <div className={clsx('skeleton', className)} style={style} />;
}

export function SkRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="tr">
      {Array.from({ length: cols }).map((_, i) => (
        <Sk key={i} className={clsx('h-4 rounded', i === 0 ? 'w-24' : i === 1 ? 'flex-1' : 'w-20')} />
      ))}
    </div>
  );
}

export function SkTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="th flex gap-4 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} className={clsx('h-3', i === 0 ? 'w-16' : 'w-24')} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => <SkRow key={i} cols={cols} />)}
    </div>
  );
}

export function SkCard() {
  return (
    <div className="card p-5 space-y-3">
      <Sk className="h-4 w-32" />
      <Sk className="h-8 w-48" />
      <Sk className="h-3 w-24" />
    </div>
  );
}

export function SkStatRow() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[0,1,2,3].map(i => <SkCard key={i} />)}
    </div>
  );
}

export function SkDetail() {
  return (
    <div className="card p-6 space-y-4">
      {[160, 280, 200, 240, 180].map((w, i) => (
        <div key={i} className="field-row">
          <Sk className="h-4 w-32" />
          <Sk className={`h-4 w-${w > 200 ? '64' : '48'}`} style={{ width: `${w}px` }} />
        </div>
      ))}
    </div>
  );
}
