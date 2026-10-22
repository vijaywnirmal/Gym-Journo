"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function PlanMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-label">
      {/* GitHub-flavoured markdown: plans often lay out days or meals as tables. */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
          ol: ({ children, start }) => (
            <ol start={start} className="ml-4 list-decimal text-label">
              {children}
            </ol>
          ),
          table: ({ children }) => (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-separator px-2 py-1.5 font-semibold text-label">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-separator px-2 py-1.5 align-top text-label">{children}</td>,
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
