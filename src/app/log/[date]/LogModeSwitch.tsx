"use client";

import { useState, type ReactNode } from "react";

// Which view a log page shows is decided once, when the page opens: a day that was already logged
// opens on its summary, anything else on the logger. Saving re-renders the page on the server, and
// the first save of a past day creates its log — that must not swap the logger for the summary
// under someone still typing, which would unmount the logger and drop its unsaved edits.
export default function LogModeSwitch({
  startWithSummary,
  summary,
  logger,
}: {
  startWithSummary: boolean;
  summary: ReactNode;
  logger: ReactNode;
}) {
  const [showSummary] = useState(startWithSummary);
  return showSummary && summary ? summary : logger;
}
