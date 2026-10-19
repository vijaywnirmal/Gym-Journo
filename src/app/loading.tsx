// Shown the instant a screen is opened, while its data loads from the server, so a tap never
// looks unanswered. Prefetched with the link, so it appears without a network round trip.
export default function Loading() {
  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10" aria-busy="true" aria-label="Loading">
      <div className="mb-6">
        <div className="skeleton mb-2 h-7 w-44" />
        <div className="skeleton h-4 w-64 max-w-full" />
      </div>
      <div className="card mb-4 flex flex-col gap-3 p-5">
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton mt-2 h-11 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-24 p-4">
          <div className="skeleton h-4 w-2/3" />
        </div>
        <div className="card h-24 p-4">
          <div className="skeleton h-4 w-1/2" />
        </div>
      </div>
    </main>
  );
}
