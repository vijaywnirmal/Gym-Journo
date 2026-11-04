// Tells someone their gym or trainer ended, for those who didn't get a notification. Goes by itself
// after 14 days, or when they start with a gym or trainer again (my_recent_removals). since is
// formatted on the server.
export default function RemovalNotices({
  removals,
}: {
  removals: { kind: "gym" | "trainer"; name: string; since: string }[];
}) {
  if (removals.length === 0) return null;
  return (
    <section className="card mb-4 divide-y divide-separator">
      {removals.map((removal) => (
        <div key={removal.kind} className="px-4 py-3">
          <p className="text-sm font-semibold">
            {removal.kind === "gym" ? `You're no longer a member of ${removal.name}` : `${removal.name} is no longer your trainer`}
          </p>
          <p className="text-sm text-label-2">
            {removal.kind === "gym"
              ? `Since ${removal.since}. Your workouts and history are still here. If this is a mistake, ask the gym.`
              : `Since ${removal.since}. Your workouts and plans are still here.`}
          </p>
        </div>
      ))}
    </section>
  );
}
