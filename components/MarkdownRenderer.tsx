
import React, { useState, useEffect } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  children: string | null | undefined | any;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ children, className }) => {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    // 1. Strict Input Guard
    if (children === null || children === undefined) {
      setHtml('');
      return;
    }

    // Convert non-string input to string safely
    const content = typeof children === 'string' ? children : String(children);

    const parseContent = async () => {
      try {
        // 2. Async Handling:
        // Even if we pinned marked@12, environment might force v13+ which returns a Promise.
        // We MUST await it to get the string, otherwise rendering the Promise object crashes React (#31).
        const result = marked.parse(content);
        
        if (result instanceof Promise) {
          const resolvedHtml = await result;
          setHtml(resolvedHtml);
        } else if (typeof result === 'string') {
          setHtml(result);
        } else {
          // Fallback for unexpected return types
          console.warn("MarkdownRenderer: Unexpected result type", typeof result);
          setHtml(content);
        }
      } catch (error) {
        console.error('Markdown parsing error:', error);
        setHtml(content);
      }
    };

    parseContent();
  }, [children]);

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default MarkdownRenderer;
