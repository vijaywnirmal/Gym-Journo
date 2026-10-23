import RemoveButton from "@/components/RemoveButton";
import type { Gym } from "@/lib/types";
import { leaveGym, leaveGymStaff } from "./gymActions";

function place(gym: Gym): string {
  return [gym.area, gym.city].filter(Boolean).join(", ");
}

// The gym the person is a member of, and the gyms they train at. since is formatted on the server.
export default function YourGymSection({
  membership,
  trainerGyms,
  gymTrainer,
}: {
  membership: { gym: Gym; since: string } | null;
  trainerGyms: Gym[];
  // The trainer this gym arranged, who stops training them if they leave.
  gymTrainer: string | null;
}) {
  if (!membership && trainerGyms.length === 0) return null;
  return (
    <>
      <h2 className="section-title mt-8">{membership ? "Your gym" : "Gyms you train at"}</h2>
      <section className="card divide-y divide-separator">
        {membership && (
          <div>
            <div className="flex items-center gap-3 px-4 pt-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{membership.gym.name}</p>
                <p className="text-sm text-label-2">
                  {[place(membership.gym), `since ${membership.since}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              {membership.gym.phone && (
                <a
                  href={`tel:${membership.gym.phone}`}
                  className="h-8 shrink-0 rounded-lg border border-separator px-3 text-sm font-semibold leading-8 hover:bg-fill"
                >
                  Call
                </a>
              )}
            </div>
            <RemoveButton
              label="Leave gym"
              warning={
                gymTrainer
                  ? `You'll leave ${membership.gym.name}, and ${gymTrainer} will stop training you.`
                  : `You'll leave ${membership.gym.name}.`
              }
              action={leaveGym.bind(null, membership.gym.id)}
              confirmLabel="Leave"
            />
          </div>
        )}
        {trainerGyms.map((gym) => (
          <div key={gym.id}>
            <div className="px-4 pt-3">
              <p className="text-sm font-semibold">Trainer at {gym.name}</p>
              {place(gym) && <p className="text-sm text-label-2">{place(gym)}</p>}
            </div>
            <RemoveButton
              label="Leave gym"
              warning={`You'll stop training ${gym.name}'s members. Your own clients stay.`}
              action={leaveGymStaff.bind(null, gym.id, "trainer")}
              confirmLabel="Leave"
            />
          </div>
        ))}
      </section>
    </>
  );
}
