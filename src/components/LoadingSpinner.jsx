// src/components/LoadingSpinner.jsx
export default function LoadingSpinner({ size = "md", label }) {
  const sizes = {
    sm: "w-5 h-5 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8" role="status">
      <div
        className={`${sizes[size]} rounded-full border-slate-200 border-t-navy-700 animate-spin`}
      />
      {label && <div className="text-sm text-slate-600">{label}</div>}
      <span className="sr-only">Loading...</span>
    </div>
  );
}