import { 
  AssetCandidate, 
  AssetDiscoveryResult, 
  ResolvedUrl, 
  PageData,
  MultiAssetDiagnostic,
  DiagnosticAsset,
  TargetIdentity,
  ExtractionScopeStatus,
  ContentScopeStatus
} from './types';
import { RecursiveScanner } from './scanner';
import { scoreCandidates } from './scorer';
import { PlaywrightLoader } from './loaders';
import { MULTI_ASSET_SIGNALS, SCORING_CONFIG, EXCLUDE_VALUE_PATTERNS } from './constants';
import * as cheerio from 'cheerio';

export async function discoverAssetsFromUrl(url: string): Promise<AssetDiscoveryResult> {
  const startTime = Date.now();
  const resolved = normalizeUrl(url);
  const loader = new PlaywrightLoader();
  
  const debug: AssetDiscoveryResult['debug'] = {
    matchedRules: [],
    visitedUrls: [url],
    visitedSources: [],
    timingMs: 0,
    decisions: []
  };

  try {
    // 1. Load Page
    const pageData = await loader.load(resolved);
    resolved.finalUrl = pageData.resolvedUrl;
    if (resolved.finalUrl !== url) debug.visitedUrls.push(resolved.finalUrl);
    debug.httpStatus = pageData.httpStatus;
    debug.rawTitle = pageData.meta['page_title'];

    // 1.1 Detect Block/Interstitial Page
    let status: 'success' | 'blocked' = 'success';
    const blockReason = detectBlockPage(pageData);
    if (blockReason) {
      debug.decisions?.push(`Block detected: ${blockReason}`);
      status = 'blocked';
    }

    const allCandidates: AssetCandidate[] = [];
    const $ = cheerio.load(pageData.html);

    // 1.2 Derive Target Identity
    const targetIdentity = deriveTargetIdentity(resolved.normalized, pageData);
    if (targetIdentity) {
      debug.decisions?.push(`Target Identity derived: ${targetIdentity.id} (${targetIdentity.type})`);
    }

    // 1.3 Identify Main Container Scope
    let mainContainer: any = null;
    let mainContainerSelector = '';
    
    // Strategy A: Find by Identity Match (Strongest)
    if (targetIdentity) {
      const identitySelectors = [
        `[data-id="${targetIdentity.id}"]`,
        `[id="${targetIdentity.id}"]`,
        `article:has(a[href*="${targetIdentity.id}"])`,
        `div:has(a[href*="${targetIdentity.id}"])`
      ];
      for (const sel of identitySelectors) {
        const el = $(sel).first();
        if (el.length > 0) {
          mainContainer = el;
          mainContainerSelector = `identity:${sel}`;
          break;
        }
      }
    }

    // Strategy B: Fallback to Signal-based Containers
    if (!mainContainer) {
      for (const selector of MULTI_ASSET_SIGNALS.MAIN_CONTAINERS) {
        const el = $(selector).first();
        if (el.length > 0) {
          mainContainer = el;
          mainContainerSelector = selector;
          break;
        }
      }
    }

    if (!mainContainer) {
      debug.decisions?.push('No main container found. Scoping failed.');
    } else {
      debug.decisions?.push(`Main container identified: ${mainContainerSelector}`);
    }

    // 1.5 Scan oEmbed (if applicable) - Keep oEmbed as it's logically scoped to the URL
    try {
      const oembedUrl = getOEmbedUrl(resolved.normalized);
      if (oembedUrl) {
        const isYouTube = resolved.normalized.includes('youtube.com') || resolved.normalized.includes('youtu.be');
        const oembedRes = await fetch(oembedUrl, {
          headers: {
            'User-Agent': isYouTube 
              ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
              : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          const scanner = new RecursiveScanner('oembed', targetIdentity);
          scanner.scan(oembedData, 'oembed').forEach(c => {
            c.scope = 'in_post'; // oEmbed for the URL is logically in-post
            allCandidates.push(c);
          });
          debug.visitedSources.push('oembed');
        }
      }
    } catch (e) {}

    // 2. Scan Meta Tags - ALWAYS include primary meta tags as in_post
    scanMetaTags(pageData.meta).forEach(c => {
      if (c.path.includes('og:') || c.path.includes('twitter:') || c.path.includes('page_title')) {
        c.scope = 'in_post';
        c.confidence = 0.9; // High confidence for primary meta
      } else {
        c.scope = 'out_of_post';
      }
      allCandidates.push(c);
    });
    debug.visitedSources.push('meta');

    // 3. Scan JSON-LD & Scripts
    // First, scan global JSON-LD as it often contains the main entity
    const globalScanner = new RecursiveScanner('json', targetIdentity);
    globalScanner.scan(pageData.jsonLd, 'jsonld-global').forEach(c => {
      c.scope = 'in_post';
      allCandidates.push(c);
    });
    debug.visitedSources.push('jsonld-global');

    // Scan raw script blobs for CDNs
    scanScriptBlobs(pageData.scripts).forEach(c => {
      c.scope = 'in_post';
      allCandidates.push(c);
    });
    debug.visitedSources.push('scripts-global');

    if (mainContainer) {
      const scopedJsonLd: any[] = [];
      mainContainer.find('script[type="application/ld+json"]').each((_: number, el: any) => {
        try {
          scopedJsonLd.push(JSON.parse($(el).html() || ''));
        } catch (e) {}
      });
      
      const scanner = new RecursiveScanner('json', targetIdentity);
      scanner.scan(scopedJsonLd, 'jsonld-scoped').forEach(c => {
        c.scope = 'in_post';
        allCandidates.push(c);
      });
      debug.visitedSources.push('jsonld-scoped');

      const scopedScripts: string[] = [];
      mainContainer.find('script').each((_: number, el: any) => {
        const content = $(el).html();
        if (content) scopedScripts.push(content);
      });
      
      const scriptScanner = new RecursiveScanner('script', targetIdentity);
      scriptScanner.scan(scopedScripts, 'script').forEach(c => {
        c.scope = 'in_post';
        allCandidates.push(c);
      });
      debug.visitedSources.push('script-scoped');

      // 4. Scan DOM Media - ONLY inside mainContainer
      scanDomMedia(mainContainer, $).forEach(c => {
        // DOM media inside main container is highly likely to be the content
        if (c.scope !== 'out_of_post') c.scope = 'in_post';
        allCandidates.push(c);
      });
      debug.visitedSources.push('dom-scoped');
    }

    // 5. Score ALL candidates first (don't filter yet)
    const scored = scoreCandidates(allCandidates);

    // 6. Filter for Summary: Keep in_post, likely_child, or high confidence
    const filteredForSummary = scored.filter(c => 
      c.scope === 'in_post' || 
      c.scope === 'likely_child' ||
      c.confidence > 0.5
    );

    debug.decisions?.push(`Filtered for summary: ${filteredForSummary.length} / ${scored.length}`);

    // 6.5 Multi-Asset Diagnostics
    const multiAsset = diagnoseMultiAssets(scored, debug, targetIdentity, mainContainerSelector);

    debug.timingMs = Date.now() - startTime;
    debug.matchedRules = Array.from(new Set(scored.flatMap(c => c.ruleIds || [])));

    // 7. Build Summary using filtered candidates
    const summary = buildSummary(filteredForSummary, debug, multiAsset);

    debug.rawTitle = pageData.meta['og:title'] || pageData.meta['page_title'];
    debug.rawDescription = pageData.meta['og:description'] || pageData.meta['description'];

    return {
      url: resolved,
      timestamp: new Date().toISOString(),
      status,
      blockReason: blockReason || undefined,
      candidates: scored,
      summary,
      multiAsset,
      debug,
      pageData
    };
  } catch (error: any) {
    debug.timingMs = Date.now() - startTime;
    return {
      url: resolved,
      timestamp: new Date().toISOString(),
      status: 'error',
      candidates: [],
      summary: { tags: [], hashtags: [] },
      debug
    };
  }
}

function detectBlockPage(page: PageData): 'bot_protection_or_waf' | 'login_required' | 'other' | null {
  const title = (page.meta['page_title'] || '').toLowerCase();
  const html = page.html.toLowerCase();
  const status = page.httpStatus;

  // 1. Status Code Based
  if ([403, 429, 503].includes(status)) {
    return 'bot_protection_or_waf';
  }

  // 2. Title Patterns
  const blockTitles = [
    'just a moment',
    'access denied',
    'checking your browser',
    'enable javascript',
    'attention required',
    'security check',
    'robot check'
  ];

  if (blockTitles.some(t => title.includes(t))) {
    return 'bot_protection_or_waf';
  }

  // 3. Body Patterns (Cloudflare, etc.)
  const blockBodyPatterns = [
    'cf-browser-verification',
    'ray id:',
    'please enable cookies',
    'unusual traffic from your computer'
  ];

  if (blockBodyPatterns.some(p => html.includes(p))) {
    return 'bot_protection_or_waf';
  }

  // 4. Login Walls (Platform Specific)
  const loginPatterns = [
    'login',
    '로그인',
    'create an account or log in',
    '계정을 만들거나 로그인',
    'log in to see photos and videos',
    '사진과 동영상을 보려면 로그인'
  ];

  if (loginPatterns.some(p => title.includes(p) || html.includes(p)) || page.resolvedUrl.includes('accounts/login')) {
    return 'login_required';
  }

  return null;
}

function getOEmbedUrl(url: string): string | null {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  }
  if (url.includes('instagram.com')) {
    // Instagram oEmbed requires an app token, so we skip it for now or use a generic one if available
    // return `https://graph.facebook.com/v10.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=...`;
  }
  if (url.includes('vimeo.com')) {
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
  }
  if (url.includes('tiktok.com')) {
    return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  }
  return null;
}

function normalizeUrl(url: string): ResolvedUrl {
  try {
    const u = new URL(url);
    // Platform-specific hint: Force Korean for YouTube to avoid geo-IP issues
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      u.searchParams.set('hl', 'ko');
    }
    return {
      original: url,
      normalized: u.toString(),
      hostname: u.hostname
    };
  } catch (e) {
    return { original: url, normalized: url, hostname: '' };
  }
}

function scanMetaTags(meta: Record<string, string>): AssetCandidate[] {
  const scanner = new RecursiveScanner('meta');
  return scanner.scan(meta, 'meta');
}

function scanJsonLd(jsonLd: any[]): AssetCandidate[] {
  const scanner = new RecursiveScanner('json');
  return scanner.scan(jsonLd, 'jsonld');
}

function scanDomMedia(container: any, $: cheerio.CheerioAPI): AssetCandidate[] {
  const candidates: AssetCandidate[] = [];

  // Identify Excluded Areas within the container
  const excluded = container.find(MULTI_ASSET_SIGNALS.EXCLUDE_SELECTORS.join(','));

  container.find('img, video, source').each((i: number, el: any) => {
    const $el = $(el);
    const src = $el.attr('src') || $el.attr('srcset')?.split(',')[0].trim().split(/\s+/)[0];
    if (!src) return;

    // Reject if it matches any exclusion pattern (e.g., post permalinks)
    if (EXCLUDE_VALUE_PATTERNS.some(regex => regex.test(src))) {
      return;
    }

    const kind = el.name === 'img' ? 'image' : 'video';
    
    // Scoping Logic - Since we are already inside the main container
    let scope: AssetCandidate['scope'] = 'in_post';
    const isExcluded = excluded.find(el).length > 0;

    if (isExcluded) scope = 'out_of_post';

    // Check for likely child (inside a repeating structure like li or carousel item)
    const parentCarousel = $el.closest(MULTI_ASSET_SIGNALS.CONTAINERS.join(','));
    if (parentCarousel.length > 0 && scope !== 'out_of_post') {
      scope = 'likely_child';
    }

    candidates.push({
      kind,
      value: src,
      source: 'dom',
      path: `dom.${el.name}[${i}].src`,
      scope,
      score: 0,
      confidence: 0
    });
  });

  return candidates;
}

function scanScriptBlobs(scripts: string[]): AssetCandidate[] {
  const scanner = new RecursiveScanner('script');
  const candidates: AssetCandidate[] = [];

  scripts.forEach((script, i) => {
    // 1. Try to extract raw URLs directly (especially for CDNs like googlevideo or instagram)
    // Loosen regex to catch more variations of escaped URLs
    const urlRegex = /(?:https?|https?(?:%3A|:)(?:%2F|\/)(?:%2F|\/))[^\s"'<>\\]+/gi;
    const scriptToScan = script.length > 500000 ? script.substring(0, 500000) : script;
    
    let match;
    while ((match = urlRegex.exec(scriptToScan)) !== null) {
      let url = match[0];
      // Clean up escaped characters often found in JSON strings
      url = url.replace(/\\u0026/g, '&').replace(/\\/g, '');
      
      // Decode URL if it's URL-encoded before checking includes
      if (url.includes('%3F') || url.includes('%26') || url.includes('%3A')) {
        try { url = decodeURIComponent(url); } catch(e) {}
      }

      if (url.includes('googlevideo.com') || url.includes('.mp4') || url.includes('cdninstagram.com')) {
        candidates.push({
          value: url,
          kind: 'video',
          source: 'script',
          path: `script[${i}].raw_url`,
          scope: 'unknown',
          score: 0,
          confidence: 0.8
        });
      }
    }

    // 2. Look for JSON-like structures: { ... }
    const jsonRegex = /({[\s\S]*?})/g;
    while ((match = jsonRegex.exec(scriptToScan)) !== null) {
      const potentialJson = match[0];
      if (potentialJson.length < 50) continue; 

      try {
        if (potentialJson.includes('":')) {
          const data = JSON.parse(potentialJson);
          scanner.scan(data, `script[${i}].blob`).forEach(c => candidates.push(c));
        }
      } catch (e) {}
      if (candidates.length > 200) break;
    }
  });

  return candidates;
}

function buildSummary(
  candidates: AssetCandidate[], 
  debug: AssetDiscoveryResult['debug'],
  multiAsset?: MultiAssetDiagnostic
): AssetDiscoveryResult['summary'] {
  const top = (kind: string) => {
    const sorted = candidates
      .filter(c => c.kind === kind && !c.isBoilerplate)
      .sort((a, b) => {
        // Prioritize og: and twitter: tags for summary
        const aIsPrimary = a.path.includes('og:') || a.path.includes('twitter:');
        const bIsPrimary = b.path.includes('og:') || b.path.includes('twitter:');
        if (aIsPrimary && !bIsPrimary) return -1;
        if (!aIsPrimary && bIsPrimary) return 1;
        return b.score - a.score;
      });
    return sorted[0];
  };
  
  // Deterministic Title Extraction
  const titleCandidates = candidates
    .filter(c => c.kind === 'text' && (c.normalizedKey?.includes('title') || c.path.includes('title')))
    .sort((a, b) => {
      const getPriority = (c: AssetCandidate) => {
        if (c.path.includes('og:title')) return 10;
        if (c.path === 'title') return 9;
        if (c.source === 'json' || c.source === 'script') return 8;
        return 1;
      };
      return getPriority(b) - getPriority(a);
    });

  // Deterministic Caption/Description Extraction
  const captionCandidates = candidates
    .filter(c => c.kind === 'text' && !c.isBoilerplate && (
      c.normalizedKey?.includes('description') || 
      c.normalizedKey?.includes('caption') || 
      c.normalizedKey?.includes('articleBody') ||
      c.path.includes('description') ||
      c.path.includes('caption')
    ))
    .sort((a, b) => {
      const getPriority = (c: AssetCandidate) => {
        if (c.path.includes('og:description')) return 10;
        if (c.path.includes('description')) return 9;
        if (c.source === 'json' || c.source === 'script') return 8;
        return 1;
      };
      return getPriority(b) - getPriority(a);
    });

  const topTitle = titleCandidates[0];
  const topCaption = captionCandidates[0] || top('text');

  let sourceForHashtags = topCaption?.value || topTitle?.value || '';
  if (topCaption) {
    debug.decisions?.push(`Hashtag source selected: ${topCaption.path}`);
  } else if (topTitle) {
    debug.decisions?.push(`Hashtag source fallback to title: ${topTitle.path}`);
  }

  const hashtags = Array.from(new Set(
    (sourceForHashtags.match(/#[\w가-힣]+/g) || []).map(t => t.replace('#', ''))
  ));

  const tags = Array.from(new Set(
    candidates
      .filter(c => c.kind === 'tags' && c.confidence > 0.4 && !c.isBoilerplate)
      .map(c => c.value.replace(/^#/, ''))
      .filter(v => v.length > 1)
  )).slice(0, 10);

  return {
    topText: topTitle || topCaption, // Keep for backward compatibility
    topTitle,
    topCaption,
    tags,
    hashtags,
    topVideo: top('video'),
    topImage: top('image'),
    allAssets: multiAsset?.assets
  };
}

function diagnoseMultiAssets(
  candidates: AssetCandidate[], 
  debug: AssetDiscoveryResult['debug'],
  targetIdentity?: TargetIdentity,
  mainContainerSelector?: string
): MultiAssetDiagnostic {
  const assets: DiagnosticAsset[] = [];
  const decisions = debug.decisions || [];

  // Group candidates by their "index" or "order" if available in path
  const assetMap = new Map<number, AssetCandidate[]>();
  
  candidates.forEach(c => {
    if (c.kind !== 'image' && c.kind !== 'video') return;
    if (c.isBoilerplate || c.confidence < 0.2) return;

    // Try to extract index from path: e.g., "jsonld[2]", "items[1]"
    const indexMatch = c.path.match(/\[(\d+)\]/);
    const index = indexMatch ? parseInt(indexMatch[1]) : 0;
    
    if (!assetMap.has(index)) assetMap.set(index, []);
    assetMap.get(index)!.push(c);
  });

  const sortedIndices = Array.from(assetMap.keys()).sort((a, b) => a - b);
  
  sortedIndices.forEach((idx, i) => {
    const group = assetMap.get(idx)!;
    const bestImage = group.find(c => c.kind === 'image');
    const bestVideo = group.find(c => c.kind === 'video');

    // Determine aggregate scope for this asset index
    const scopes = group.map(c => c.scope || 'unknown');
    let scope: DiagnosticAsset['scope'] = 'unknown';
    if (scopes.includes('likely_child')) scope = 'likely_child';
    else if (scopes.includes('in_post')) scope = 'in_post';
    else if (scopes.includes('out_of_post')) scope = 'out_of_post';

    assets.push({
      index: i,
      assetType: bestVideo ? 'video' : (bestImage ? 'image' : 'unknown'),
      imageUrl: bestImage?.value || null,
      previewImageUrl: bestImage?.value || null,
      sourceHint: group[0].path,
      confidence: Math.max(...group.map(c => c.confidence)),
      scope,
      matchedToTarget: group.some(c => c.matchedToTarget),
      rawCandidates: group
    });
  });

  const mode = assets.length > 1 ? 'multi' : (assets.length === 1 ? 'single' : 'unknown');
  let status: MultiAssetDiagnostic['status'] = 'none';

  if (mode === 'multi') {
    const inPostAssets = assets.filter(a => a.scope === 'in_post' || a.scope === 'likely_child');
    const hasUrls = inPostAssets.filter(a => a.imageUrl).length;
    
    if (hasUrls === inPostAssets.length && inPostAssets.length > 0) status = 'child_assets_detected';
    else if (hasUrls > 0) status = 'partial_urls_found';
    else status = 'multi_detected';
  }

  // Determine Scoping Status
  let targetContentStatus: ContentScopeStatus = 'target_content_ambiguous';
  if (mainContainerSelector?.startsWith('identity:')) targetContentStatus = 'target_content_confirmed';
  else if (mainContainerSelector) targetContentStatus = 'target_content_likely';

  let extractionStatus: ExtractionScopeStatus = 'failed_to_scope';
  const inScopeCount = assets.filter(a => a.scope === 'in_post' || a.scope === 'likely_child').length;
  if (inScopeCount === assets.length && assets.length > 0) extractionStatus = 'fully_scoped';
  else if (inScopeCount > 0) extractionStatus = 'partially_scoped';
  else if (assets.length > 0) extractionStatus = 'noisy_scope';

  return {
    assetMode: mode,
    detectedAssetCount: assets.length,
    resolvedImageCount: assets.filter(a => a.assetType === 'image' && a.imageUrl).length,
    resolvedVideoCount: assets.filter(a => a.assetType === 'video').length,
    assets,
    status,
    scoping: {
      mainContainerSelector,
      inPostCount: assets.filter(a => a.scope === 'in_post').length,
      outOfPostCount: assets.filter(a => a.scope === 'out_of_post').length,
      likelyChildCount: assets.filter(a => a.scope === 'likely_child').length,
      extractionStatus,
      targetContentStatus
    },
    targetIdentity
  };
}

/**
 * Derives a target identity from URL and page data
 */
function deriveTargetIdentity(url: string, pageData: PageData): TargetIdentity | undefined {
  try {
    const u = new URL(url);
    
    // Instagram
    const instaMatch = url.match(/\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/);
    if (instaMatch) {
      return {
        id: instaMatch[2],
        type: 'shortcode',
        canonicalUrl: `https://www.instagram.com/p/${instaMatch[2]}/`,
        platformHint: 'instagram'
      };
    }

    // YouTube
    const ytMatch = url.match(/(?:v=|\/embed\/|\/shorts\/|\/watch\?v=)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return {
        id: ytMatch[1],
        type: 'id',
        canonicalUrl: `https://www.youtube.com/watch?v=${ytMatch[1]}`,
        platformHint: 'youtube'
      };
    }

    // Generic: Try to find canonical or shortlink in meta
    const canonical = pageData.meta['og:url'] || pageData.meta['canonical'];
    if (canonical && canonical !== url) {
      const cUrl = new URL(canonical);
      const lastPart = cUrl.pathname.split('/').filter(Boolean).pop();
      if (lastPart) {
        return {
          id: lastPart,
          type: 'slug',
          canonicalUrl: canonical
        };
      }
    }

  } catch (e) {}
  return undefined;
}
