import path from 'path';
import os from 'os';
import fs from 'fs';
import { PromptInjectionDefense, SecretRedactor } from '@meghai/security';
import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private activePage: Page | null = null;

  constructor(options: BrowserOptions = {}) {
    this.options = {
      allowLocalhost: false,
      userAgent: 'MeghAI-SecureBrowser/1.0 (+https://meghai.local)',
      timeoutMs: 15000,
      ...options
    };
    this.baseSessionDir = path.join(os.tmpdir(), 'meghai-browser-sessions');
  }

  private async isChromeRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV');
      return stdout.toLowerCase().includes('chrome.exe');
    } catch {
      return false;
    }
  }

  private async ensureConnection(): Promise<Page> {
    if (this.activePage && !this.activePage.isClosed()) {
      return this.activePage;
    }

    try {
      this.browser = await chromium.connectOverCDP('http://localhost:9222');
      this.context = this.browser.contexts()[0];
      this.activePage = this.context.pages()[0] || await this.context.newPage();
      return this.activePage;
    } catch (cdpError: any) {
      const running = await this.isChromeRunning();
      if (running) {
        throw new Error('Browser Automation Error: Chrome is already running but not listening on debugging port 9222. Please close Chrome and let MeghAI launch it, or manually start it with --remote-debugging-port=9222.');
      }

      try {
        this.browser = await chromium.launch({
          channel: 'chrome',
          headless: false,
          args: ['--remote-debugging-port=9222']
        });
        this.context = await this.browser.newContext();
        this.activePage = await this.context.newPage();
        return this.activePage;
      } catch (launchError: any) {
        throw new Error('Browser Automation Error: Could not launch Chrome or connect via Playwright. ' + launchError.message);
      }
    }
  }

      public validateUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
    try {
      let parsedUrl = url.trim();
      if (!parsedUrl.startsWith('http')) parsedUrl = 'https://' + parsedUrl;
      const parsed = new URL(parsedUrl);
      if (!this.options.allowLocalhost && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        return { isValid: false, error: 'Localhost not allowed' };
      }
      return { isValid: parsed.protocol === 'http:' || parsed.protocol === 'https:', normalizedUrl: parsed.href };
    } catch {
      return { isValid: false, error: 'Invalid URL' };
    }
  }

  public parseAndSanitizeHtml(url: string, html: string): BrowserPageContent {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Page';

    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ');

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
        } catch { }
      }
    }

    let rawText = cleaned.replace(/<[^>]+>/g, ' ');
    rawText = rawText.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

    const wrapped = PromptInjectionDefense.wrapUntrustedContent(rawText.slice(0, 15000), `Web URL: ${SecretRedactor.redact(url)}`, 'EXTERNAL_WEB');

    return {
      url, title, rawText: rawText.slice(0, 15000), sanitizedText: wrapped.content, links: links.slice(0, 50), isUntrusted: true, extractedAt: new Date().toISOString()
    };
  }

  public async getActiveTab(): Promise<{ id: string; url: string; title: string }> {
    const page = await this.ensureConnection();
    return { id: 'active', url: page.url(), title: await page.title() };
  }

  public async listTabs(): Promise<Array<{ id: string; url: string; title: string; isActive: boolean }>> {
    const page = await this.ensureConnection();
    const context = page.context();
    const pages = context.pages();
    const result = [];
    for (let i = 0; i < pages.length; i++) {
      result.push({
        id: `page-${i}`,
        url: pages[i].url(),
        title: await pages[i].title().catch(() => 'Unknown'),
        isActive: pages[i] === page
      });
    }
    return result;
  }

  public async switchTab(tabId: string): Promise<{ success: boolean; activeTabId: string }> {
    const page = await this.ensureConnection();
    const context = page.context();
    const pages = context.pages();
    const index = parseInt(tabId.replace('page-', ''), 10);
    if (!isNaN(index) && index >= 0 && index < pages.length) {
      this.activePage = pages[index];
      await this.activePage.bringToFront();
      return { success: true, activeTabId: tabId };
    }
    return { success: false, activeTabId: 'page-unknown' };
  }

  public async closeTab(tabId: string): Promise<{ success: boolean; remainingTabs: number }> {
    const page = await this.ensureConnection();
    const context = page.context();
    const pages = context.pages();
    const index = parseInt(tabId.replace('page-', ''), 10);
    if (!isNaN(index) && index >= 0 && index < pages.length) {
      await pages[index].close();
      if (this.activePage === pages[index]) {
        this.activePage = context.pages()[0] || null;
      }
      return { success: true, remainingTabs: context.pages().length };
    }
    return { success: false, remainingTabs: pages.length };
  }

  public async navigate(url: string): Promise<BrowserPageContent> {
    const page = await this.ensureConnection();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.options.timeoutMs });
    await page.waitForTimeout(1000);
    const html = await page.content();
    return this.parseAndSanitizeHtml(page.url(), html);
  }
  
  public async readPage(): Promise<BrowserPageContent> {
    const page = await this.ensureConnection();
    const html = await page.content();
    return this.parseAndSanitizeHtml(page.url(), html);
  }

  public async searchInPage(query: string): Promise<BrowserPageContent> {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return await this.navigate(url);
  }

  public async search(query: string): Promise<{ query: string; results: Array<{ title: string; url: string; snippet: string }>; content: BrowserPageContent }> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': this.options.userAgent || '' }});
      clearTimeout(timeout);
      const html = await response.text();
      const content = this.parseAndSanitizeHtml(url, html);
      const results = content.links.slice(0, 10).map(l => ({ title: l.text, url: l.href, snippet: '' }));
      return { query, results, content };
    } catch {
      return { query, results: [], content: this.parseAndSanitizeHtml(url, '') };
    }
  }

  public async click(selector: string): Promise<BrowserPageContent> {
    const page = await this.ensureConnection();
    await page.click(selector, { timeout: 5000 });
    await page.waitForTimeout(1000);
    const html = await page.content();
    return this.parseAndSanitizeHtml(page.url(), html);
  }
  
  public async clickFirstOrganicResult(): Promise<BrowserPageContent> {
    const page = await this.ensureConnection();
    const searchResultSelector = '#search a h3, .g a h3';
    await page.waitForSelector(searchResultSelector, { timeout: 5000 }).catch(() => {});
    const elements = await page.$$(searchResultSelector);
    if (elements.length > 0) {
      await elements[0].click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    } else {
      throw new Error('No organic search results found on the current page.');
    }
    const html = await page.content();
    return this.parseAndSanitizeHtml(page.url(), html);
  }

  public async type(selector: string, text: string): Promise<void> {
    const page = await this.ensureConnection();
    await page.fill(selector, text, { timeout: 5000 });
  }

  public async scroll(direction: 'up' | 'down'): Promise<void> {
    const page = await this.ensureConnection();
    await page.evaluate((dir) => {
      window.scrollBy(0, dir === 'down' ? window.innerHeight : -window.innerHeight);
    }, direction);
  }

  public async wait(ms: number): Promise<void> {
    const page = await this.ensureConnection();
    await page.waitForTimeout(ms);
  }

  public async extract(selector: string): Promise<string[]> {
    const page = await this.ensureConnection();
    const elements = await page.$$(selector);
    const results = [];
    for (const el of elements) {
      const text = await el.textContent();
      if (text) results.push(text.trim());
    }
    return results;
  }

  public async download(urlOrSelector: string): Promise<string> {
    const page = await this.ensureConnection();
    const [ download ] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      urlOrSelector.startsWith('http') ? page.goto(urlOrSelector) : page.click(urlOrSelector)
    ]);
    const path = await download.path();
    return path || 'Download failed or path unknown';
  }

  public async screenshot(): Promise<string> {
    const page = await this.ensureConnection();
    const screenshotBuffer = await page.screenshot({ type: 'png' });
    const screenshotPath = path.join(this.baseSessionDir, 'screenshot_' + Date.now() + '.png');
    if (!fs.existsSync(this.baseSessionDir)) fs.mkdirSync(this.baseSessionDir, { recursive: true });
    fs.writeFileSync(screenshotPath, screenshotBuffer);
    return screenshotPath;
  }
}


