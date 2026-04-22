import { PageData, ResolvedUrl } from './types';
import * as cheerio from 'cheerio';

export interface PageLoader {
  load(url: ResolvedUrl): Promise<PageData>;
}

/**
 * Playwright-based Loader (Stub/Mock for now, using fetch + cheerio)
 * In a real environment, this would use playwright-core or similar.
 */
export class PlaywrightLoader implements PageLoader {
  async load(url: ResolvedUrl): Promise<PageData> {
    const isYouTube = url.normalized.includes('youtube.com') || url.normalized.includes('youtu.be');
    
    const headers: Record<string, string> = {
      'User-Agent': isYouTube 
        ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    const response = await fetch(url.normalized, {
      cache: 'no-store',
      headers
    });

    // We don't throw on 403/429/503 because we want to detect block pages
    if (!response.ok && ![403, 429, 503].includes(response.status)) {
      throw new Error(`Failed to load page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract basic meta
    const meta: Record<string, string> = {};
    
    // Capture page title
    const pageTitle = $('title').text().trim();
    if (pageTitle) meta['page_title'] = pageTitle;

    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('itemprop');
      const content = $(el).attr('content');
      if (name && content) meta[name] = content;
    });

    // Extract JSON-LD
    const jsonLd: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        if (Array.isArray(data)) jsonLd.push(...data);
        else jsonLd.push(data);
      } catch (e) {}
    });

    // Extract scripts
    const scripts: string[] = [];
    $('script').each((_, el) => {
      const content = $(el).html();
      if (content && !$(el).attr('src')) scripts.push(content);
    });

    return {
      html,
      meta,
      jsonLd,
      scripts,
      resolvedUrl: response.url,
      httpStatus: response.status
    };
  }
}
