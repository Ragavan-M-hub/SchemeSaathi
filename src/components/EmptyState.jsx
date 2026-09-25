// src/components/EmptyState.jsx
export default function EmptyState({ icon = "📭", title, description, action }) {
  return (
    <div className="card text-center py-12 px-6">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-navy-900 mb-2">{title}</h3>
      {description && (
        <p className="text-slate-600 max-w-md mx-auto text-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}