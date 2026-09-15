import ReactMarkdown from "react-markdown";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-sm prose-zinc max-w-none dark:prose-invert">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
