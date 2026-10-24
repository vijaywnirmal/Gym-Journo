import { cache } from "react";
import { redirect } from "next/navigation";
import { getAdminGym } from "@/lib/gyms";
import { getMyTrainerProfile } from "@/lib/trainers";

// Trainers and the people who run a gym (its owner and admins) use Gym Journal for work only: they
// get work screens instead of the workout journal, and use a separate member account for their own
// training.
export type WorkRoles = { trainer: boolean; gym: boolean };

export const getWorkRoles = cache(async (): Promise<WorkRoles> => {
  const [trainer, gym] = await Promise.all([getMyTrainerProfile(), getAdminGym()]);
  return { trainer: trainer !== null, gym: gym !== null };
});

export function isWorkAccount(roles: WorkRoles): boolean {
  return roles.trainer || roles.gym;
}

// Where a work account lands: a trainer's Today (also for someone who runs a gym and trains), else
// the gym's dashboard.
export function workHome(roles: WorkRoles): string {
  return roles.trainer ? "/trainer" : "/gym";
}

// For the workout journal's pages: sends a work account to its own home.
export async function requireMemberApp(): Promise<void> {
  const roles = await getWorkRoles();
  if (isWorkAccount(roles)) redirect(workHome(roles));
}
