// Who gets credit on a plan: "Planned by Ravi" when a trainer made it, "edited by you" once the
// client changed it, "Changed by Ravi" when a trainer changed the client's own plan. Nothing for a
// plan the person made and kept to themselves (the usual case), or a plan from before 0034.

export type PlanAuthors = { created_by?: string | null; updated_by?: string | null };

// The signed-in person's current trainer. Only trainers who were linked can write someone's
// plans, so any other author is a past trainer, whose name isn't readable any more.
export type KnownTrainer = { id: string; name: string } | null;

function nameOf(userId: string, trainer: KnownTrainer): string {
  return trainer?.id === userId ? trainer.name : "a past trainer";
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

// The line above the plan form when someone else made or changed the plan. The current trainer
// sees all of the client's plans and logs, so the note says so; a past trainer doesn't.
export function planAuthorNote(plan: PlanAuthors, me: string, trainer: KnownTrainer): string | null {
  const other = plan.created_by && plan.created_by !== me ? plan.created_by : plan.updated_by !== me ? plan.updated_by : null;
  if (!other) return null;
  const verb = other === plan.created_by ? "planned" : "changed";
  if (trainer?.id !== other) return `A past trainer ${verb} this.`;
  return `${trainer.name} ${verb} this and can see your changes.`;
}

// For the trainer's view of a client's week: whether the client changed a plan the trainer made.
export function editedByClient(plan: PlanAuthors, clientId: string): boolean {
  return !!plan.created_by && plan.created_by !== clientId && plan.updated_by === clientId;
}
