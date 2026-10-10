import Markdown from 'react-markdown';
import { safeUrl } from '@/lib/safeUrl';

export function MarkdownPreview({ text }: { text: string }) {
  return <Markdown urlTransform={safeUrl} components={{
    a: ({ href, children }) => href
      ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">{children}</a>
      : <span>{children}</span>,
    img: ({ alt }) => <span>{alt}</span>,
  }}>{text}</Markdown>;
}
