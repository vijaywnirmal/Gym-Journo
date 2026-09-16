"use client";

import ReactMarkdown from "react-markdown";

export default function PlanMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-neutral-200">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-3 mb-1 text-base font-bold text-neutral-100 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-sm font-semibold text-neutral-100">{children}</h3>
          ),
          p: ({ children }) => <p className="text-neutral-300">{children}</p>,
          strong: ({ children }) => <strong className="text-neutral-100">{children}</strong>,
          ul: ({ children }) => <ul className="ml-4 list-disc text-neutral-300">{children}</ul>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          hr: () => <hr className="my-3 border-neutral-800" />,
          em: ({ children }) => <em className="text-neutral-400">{children}</em>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
