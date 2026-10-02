import path from 'path';
import os from 'os';
import fs from 'fs';
import { PromptInjectionDefense, SecretRedactor } from '@meghai/security';

export interface BrowserPageContent {
  url: string;
  title: string;
  rawText: string;
  sanitizedText: string;
  links: Array<{ text: string; href: string }>;
  isUntrusted: true;
  extractedAt: string;
}

export interface BrowserOptions {
  allowLocalhost?: boolean;
  userAgent?: string;
  timeoutMs?: number;
}

export class SafeBrowserEngine {
  private baseSessionDir: string;
  private options: BrowserOptions;

  constructor(options: BrowserOptions = {}) {
    this.options = {
      allowLocalhost: false,
      userAgent: 'MeghAI-SecureBrowser/1.0 (+https://meghai.local)',
      timeoutMs: 15000,
      ...options,
    };
    this.baseSessionDir = path.join(
      process.env.LOCALAPPDATA || os.homedir(),
      'MeghAI',
      'browser_sessions'
    );
    if (!fs.existsSync(this.baseSessionDir)) {
      fs.mkdirSync(this.baseSessionDir, { recursive: true });
    }
  }

  /**
   * Validate that URL is safe against SSRF attacks (blocks private IP ranges and cloud metadata)
   */
  public validateUrl(rawUrl: string): { isValid: boolean; reason?: string; normalizedUrl?: string } {
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { isValid: false, reason: `Disallowed protocol: ${parsed.protocol}. Only http and https allowed.` };
      }

      const hostname = parsed.hostname.toLowerCase();

      if (!this.options.allowLocalhost) {
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname === '::1' ||
          hostname === '169.254.169.254' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          (hostname.startsWith('172.') && parseInt(hostname.split('.')[1], 10) >= 16 && parseInt(hostname.split('.')[1], 10) <= 31)
        ) {
          return { isValid: false, reason: `Access to private/local network address '${hostname}' is prohibited.` };
        }
      }

      return { isValid: true, normalizedUrl: parsed.toString() };
    } catch {
      return { isValid: false, reason: `Malformed URL: ${rawUrl}` };
    }
  }

  /**
   * Fetch and safely extract text and links from a web page
   */
  public async fetchAndExtract(url: string): Promise<BrowserPageContent> {
    const validation = this.validateUrl(url);
    if (!validation.isValid || !validation.normalizedUrl) {
      throw new Error(`Browser Security Error: ${validation.reason}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(validation.normalizedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.options.userAgent || 'MeghAI-SecureBrowser/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP fetch failed with status ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseAndSanitizeHtml(validation.normalizedUrl, html);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Browser request timed out after ${this.options.timeoutMs}ms: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Extract readable content and links from HTML, stripping scripts, styles, and dangerous tags
   */
  public parseAndSanitizeHtml(url: string, html: string): BrowserPageContent {
    // 1. Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Page';

    // 2. Strip scripts, styles, noscript, svg, and iframes
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');

    // 3. Extract links before stripping remaining tags
    const links: Array<{ text: string; href: string }> = [];
    const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(cleaned)) !== null) {
      const href = match[2];
      const linkText = match[3].replace(/<[^>]+>/g, '').trim();
      if (linkText && href && !href.startsWith('javascript:')) {
        try {
          const absoluteHref = new URL(href, url).toString();
          links.push({ text: linkText, href: absoluteHref });
        } catch {
          // Ignore invalid link targets
        }
      }
    }

    // 4. Strip all remaining HTML tags
    let rawText = cleaned.replace(/<[^>]+>/g, ' ');
    // Decode common HTML entities
    rawText = rawText
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // 5. Wrap in Untrusted External Content fence to defend against prompt injection
    const wrapped = PromptInjectionDefense.wrapUntrustedContent(
      rawText.slice(0, 15000), // Protect context window limit
      `Web URL: ${SecretRedactor.redact(url)}`,
      'EXTERNAL_WEB'
    );

    return {
      url,
      title,
      rawText: rawText.slice(0, 15000),
      sanitizedText: wrapped.content,
      links: links.slice(0, 50),
      isUntrusted: true,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Create an isolated profile directory for this browsing session
   */
  public createIsolatedProfile(sessionId: string): string {
    const profilePath = path.join(this.baseSessionDir, sessionId);
    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }
    return profilePath;
  }
}
