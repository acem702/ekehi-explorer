interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, sub, icon }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-1 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted text-xs uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className="text-primary/60 text-lg">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-white truncate">{value}</div>
      {sub && <div className="text-muted text-xs truncate">{sub}</div>}
    </div>
  );
}
