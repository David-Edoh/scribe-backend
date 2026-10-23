import { Injectable } from '@nestjs/common';
import MarkdownIt from 'markdown-it';

/**
 * Service for converting content between markdown and HTML formats
 * Ensures consistent handling of manuscript content for storage and retrieval
 */
@Injectable()
export class ContentConverterService {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true,
    });
  }

  /**
   * Convert markdown content to HTML
   * @param markdown The markdown string to convert
   * @returns HTML representation of the markdown
   */
  markdownToHtml(markdown: string): string {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    try {
      return this.md.render(markdown);
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      return markdown;
    }
  }

  /**
   * Check if content is already HTML
   * @param content The content to check
   * @returns True if content appears to be HTML, false otherwise
   */
  isHtml(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const trimmed = content.trim();
    return /^</.test(trimmed) && />$/.test(trimmed);
  }

  /**
   * Ensure content is in HTML format
   * If content is markdown, converts it to HTML
   * If content is already HTML, returns as-is
   * @param content The content to normalize
   * @returns HTML representation of the content
   */
  ensureHtml(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    const trimmed = content.trim();
    if (trimmed.startsWith('<')) {
      return trimmed;
    }

    return this.markdownToHtml(content);
  }
}
