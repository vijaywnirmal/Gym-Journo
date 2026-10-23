// Who gets credit on a plan: "Planned by Ravi" when a trainer made it, "edited by you" once the
// client changed it, "Changed by Ravi" when a trainer changed the client's own plan. Nothing for a
// plan the person made and kept to themselves (the usual case), or a plan from before 0034.

export type PlanAuthors = { created_by?: string | null; updated_by?: string | null };

// The signed-in person's current trainer; a past trainer's name isn't readable any more.
export type KnownTrainer = { id: string; name: string } | null;

function nameOf(userId: string, trainer: KnownTrainer): string {
  return trainer?.id === userId ? trainer.name : "your trainer";
}

export function planAuthorLabel(plan: PlanAuthors, me: string, trainer: KnownTrainer): string | null {
  const { created_by: createdBy, updated_by: updatedBy } = plan;
  if (createdBy && createdBy !== me) {
    const by = `Planned by ${nameOf(createdBy, trainer)}`;
    return updatedBy === me ? `${by} · edited by you` : by;
  }
  if (updatedBy && updatedBy !== me) return `Changed by ${nameOf(updatedBy, trainer)}`;
  return null;
}

// The line above the plan form when someone else made the plan.
export function planAuthorNote(plan: PlanAuthors, me: string, trainer: KnownTrainer): string | null {
  const other = plan.created_by && plan.created_by !== me ? plan.created_by : plan.updated_by !== me ? plan.updated_by : null;
  if (!other) return null;
  const name = nameOf(other, trainer);
  const verb = other === plan.created_by ? "planned" : "changed";
  if (trainer?.id !== other) return `Your trainer ${verb} this.`;
  return `${name[0].toUpperCase()}${name.slice(1)} ${verb} this. Your changes will show on ${name}'s screen.`;
}

// For the trainer's view of a client's week: whether the client changed a plan the trainer made.
export function editedByClient(plan: PlanAuthors, clientId: string): boolean {
  return !!plan.created_by && plan.created_by !== clientId && plan.updated_by === clientId;
}
