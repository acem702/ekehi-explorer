import clsx from 'clsx';

interface Props { value: string | number; label?: string; }

export default function Badge({ value, label }: Props) {
  const v = String(label ?? value).toUpperCase();

  const cls = (() => {
    if (['ACTIVE', '1', 'SUCCESS', 'OPEN', 'EXECUTED', 'VERIFIED', 'PASSED'].includes(v))
      return 'badge-success';
    if (['FAILED', '0', 'REJECTED', 'FROZEN'].includes(v))
      return 'badge-danger';
    if (['JAILED', 'PENDING', 'REDEEMED', 'INACTIVE'].includes(v))
      return 'badge-warning';
    if (['ACCREDITED', 'ELECTED'].includes(v))
      return 'badge-primary';
    return 'badge-muted';
  })();

  return <span className={clsx('badge', cls)}>{label ?? value}</span>;
}
