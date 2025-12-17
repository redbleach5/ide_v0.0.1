import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(str: string, lang?: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch (err) {
        // fall through to escape
      }
    }
    const escaped = md.utils.escapeHtml(str);
    return `<pre class="hljs"><code>${escaped}</code></pre>`;
  }
});

// Open links in new tab with rel safety
const defaultLinkRenderer = md.renderer.rules.link_open || ((tokens: Token[], idx: number, options: any, env: any, self: any) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens: Token[], idx: number, options: any, env: any, self: any): string => {
  const token = tokens[idx];
  const targetIndex = token.attrIndex('target');
  if (targetIndex < 0) {
    token.attrPush(['target', '_blank']);
  } else {
    token.attrs![targetIndex][1] = '_blank';
  }
  token.attrSet('rel', 'noopener noreferrer');
  return defaultLinkRenderer(tokens, idx, options, env, self);
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const sanitizedHtml = useMemo(() => {
    const rendered = md.render(content || '');
    return DOMPurify.sanitize(rendered);
  }, [content]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};
