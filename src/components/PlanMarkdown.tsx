"use client";

import ReactMarkdown from "react-markdown";

export default function PlanMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-label">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-3 mb-1 text-base font-bold text-label first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1 text-sm font-semibold text-label">{children}</h3>
          ),
          p: ({ children }) => <p className="text-label">{children}</p>,
          strong: ({ children }) => <strong className="text-label">{children}</strong>,
          ul: ({ children }) => <ul className="ml-4 list-disc text-label">{children}</ul>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          hr: () => <hr className="my-3 border-separator" />,
          em: ({ children }) => <em className="text-label-2">{children}</em>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
