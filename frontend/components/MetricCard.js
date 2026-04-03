export default function MetricCard({ label, value, help }) {
  return (
    <div className="panel-surface rounded-2xl border border-palette-light/80 px-5 py-3 shadow-panel">
      <p className="text-xs uppercase tracking-[0.18em] text-palette-primary/65">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-palette-dark">{value}</p>
      {help ? <p className="mt-1 text-xs leading-5 text-palette-dark/70">{help}</p> : null}
    </div>
  );
}
