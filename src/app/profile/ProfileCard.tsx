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
      <div className="card flex items-center gap-4 p-4">
        <div
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg font-semibold text-link"
        >
          {initialsOf(fields.firstName, fields.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{name || "Add your name"}</p>
          {email && <p className="truncate text-sm text-label-2">{email}</p>}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setJustSaved(false);
              setEditing(true);
            }}
            className="h-8 shrink-0 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill"
          >
            Edit
          </button>
        )}
      </div>

      {justSaved && !editing && <p className="text-sm text-green">Profile updated.</p>}

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
          <section key={section.title} className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">{section.title}</h2>
            <dl className="divide-y divide-separator">
              {section.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-sm text-label-2">{row.label}</dt>
                  <dd className={`text-right text-sm ${row.set ? "text-label" : "text-label-2"}`}>
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
