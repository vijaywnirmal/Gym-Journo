// Saved details shown as text, with an Edit button that swaps in the form (the form's own Cancel
// and Save come back here). Rows with no value say so rather than vanishing.
export default function DetailsView({
  rows,
  onEdit,
  saved,
}: {
  rows: { label: string; value: string | null }[];
  onEdit: () => void;
  // A confirmation after saving, shown under the card.
  saved?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 pb-6">
      <section className="card">
        <div className="flex items-center justify-end px-4 pt-3">
          <button
            type="button"
            onClick={onEdit}
            className="h-8 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill"
          >
            Edit
          </button>
        </div>
        <dl className="divide-y divide-separator">
          {rows.map((row) => (
            <div key={row.label} className="px-4 py-3">
              <dt className="text-xs text-label-2">{row.label}</dt>
              <dd className={`text-sm ${row.value ? "font-medium" : "text-label-3"}`}>{row.value || "Not set"}</dd>
            </div>
          ))}
        </dl>
      </section>
      {saved && (
        <p role="status" className="text-sm text-green">
          {saved}
        </p>
      )}
    </div>
  );
}
