"use client";

import { useState } from "react";
import type { ProfileFieldsValue } from "@/lib/profile-fields";
import { initialsOf } from "@/lib/names";
import { displayNameOf, summarizeProfile } from "@/lib/profileSummary";
import ProfileEditForm from "./ProfileEditForm";

// The profile as a person sees it: a card with their name and details, and an Edit button that swaps
// the details for the form. Saving or cancelling returns to the card.
export default function ProfileCard({
  initial,
  email,
}: {
  initial: ProfileFieldsValue;
  email: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState(initial);
  const [justSaved, setJustSaved] = useState(false);

  const name = displayNameOf(fields);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-lg font-semibold text-neutral-100"
        >
          {initialsOf(fields.firstName, fields.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-neutral-100">{name || "Add your name"}</p>
          {email && <p className="truncate text-sm text-neutral-400">{email}</p>}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setJustSaved(false);
              setEditing(true);
            }}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-100"
          >
            Edit
          </button>
        )}
      </div>

      {justSaved && !editing && <p className="text-sm text-green-400">Profile updated.</p>}

      {editing ? (
        <ProfileEditForm
          initial={fields}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setFields(saved);
            setEditing(false);
            setJustSaved(true);
          }}
        />
      ) : (
        summarizeProfile(fields).map((section) => (
          <section key={section.title} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold text-neutral-100">{section.title}</h2>
            <dl className="divide-y divide-neutral-800">
              {section.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-sm text-neutral-400">{row.label}</dt>
                  <dd className={`text-right text-sm ${row.set ? "text-neutral-100" : "text-neutral-500"}`}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))
      )}
    </div>
  );
}
