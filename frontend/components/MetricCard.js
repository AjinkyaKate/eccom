export default function MetricCard({ label, value, help }) {
  return (
    <div className="panel-surface rounded-[1.75rem] border border-palette-light/80 p-6 shadow-panel">
      <p className="text-sm uppercase tracking-[0.18em] text-palette-primary/65">{label}</p>
      <p className="mt-4 text-4xl font-semibold text-palette-dark">{value}</p>
      <p className="mt-3 text-sm leading-6 text-palette-dark/70">{help}</p>
    </div>
  );
}
