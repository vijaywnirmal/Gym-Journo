import RemoveButton from "@/components/RemoveButton";
import type { Gym } from "@/lib/types";
import { leaveGym, leaveGymStaff } from "./gymActions";

function place(gym: Gym): string {
  return [gym.area, gym.city].filter(Boolean).join(", ");
}

// The gym the person is a member of, the gyms they train at, and a gym they help run (but don't own:
// the owner's gym goes with their account). since is formatted on the server.
export default function YourGymSection({
  membership,
  trainerGyms,
  adminOf,
  gymTrainer,
  fee = null,
}: {
  membership: { gym: Gym; since: string } | null;
  trainerGyms: Gym[];
  adminOf: Gym | null;
  // The trainer this gym arranged, who stops training them if they leave.
  gymTrainer: string | null;
  // The member's fee with the gym, if it records one.
  fee?: React.ReactNode;
}) {
  if (!membership && trainerGyms.length === 0 && !adminOf) return null;
  return (
    <>
      <h2 className="section-title mt-8">{membership ? "Your gym" : "Gyms"}</h2>
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
            {fee && <div className="px-4 pt-3">{fee}</div>}
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
        {adminOf && (
          <div>
            <div className="px-4 pt-3">
              <p className="text-sm font-semibold">Admin at {adminOf.name}</p>
              {place(adminOf) && <p className="text-sm text-label-2">{place(adminOf)}</p>}
            </div>
            <RemoveButton
              label="Step down"
              warning={`You'll no longer run ${adminOf.name}.`}
              action={leaveGymStaff.bind(null, adminOf.id, "admin")}
              confirmLabel="Leave"
            />
          </div>
        )}
      </section>
    </>
  );
}
