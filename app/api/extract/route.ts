import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { 
  cleanInstagramCaptionCandidate, 
  extractCandidateTagsFromText, 
  extractHashtags,
  TagCandidate 
} from '@/lib/instagramCleanup';
import { parseTravelText, ParseResult } from '@/lib/travelTextParser';
import { discoverAssetsFromUrl } from '@/lib/discovery/engine';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface ExtractionResult {
  url: string;
  platform: string;
  fetch_status: 'success' | 'failed' | 'blocked' | 'error';
  block_reason?: string;
  http_status: number | null;
  final_url: string | null;
  page_title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  raw_caption_candidate: string | null;
  cleaned_caption_candidate: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  raw_video_urls: string[];
  hashtags: string[];
  normalized_hashtags: string[];
  candidate_tags_from_text: string[];
  summary?: any;
  travel_parsed_data?: ParseResult;
  errors: string[];
  warnings: string[];
  debug: Record<string, any>;
  cached?: boolean;
}

const getUrlId = (url: string) => {
  try {
    const u = new URL(url);
    const clean = (u.hostname + u.pathname).replace(/\/$/, '');
    return btoa(encodeURIComponent(clean)).replace(/[/+=]/g, '_').slice(0, 50);
  } catch {
    return btoa(encodeURIComponent(url)).replace(/[/+=]/g, '_').slice(0, 50);
  }
};

async function fetchFromApify(url: string, platform: string) {
  const apiKey = process.env.APIFY_API_KEY;
  if (!apiKey) return null;

  try {
    if (platform === 'instagram') {
      const response = await fetch('https://api.apify.com/v2/actor-tasks/apify~instagram-scraper-task/run-sync-get-dataset-items?token=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: [url],
          resultsLimit: 1
        })
      });
      const data = await response.json();
      return data[0] || null;
    }
  } catch (e) {
    console.error('Apify error:', e);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    
    const urlId = getUrlId(url);

    // 1. Check Cache
    try {
      const cacheDoc = await adminDb.collection('extractions').doc(urlId).get();
      if (cacheDoc.exists) {
        const cachedData = cacheDoc.data() as ExtractionResult;
        const updatedAt = (cachedData as any).updatedAt?.toDate();
        // 24h cache
        if (updatedAt && (Date.now() - updatedAt.getTime()) < 1000 * 60 * 60 * 24) {
          return NextResponse.json({ ...cachedData, cached: true });
        }
      }
    } catch (e) {
      console.error('Cache check failed', e);
    }

    const result: ExtractionResult = {
      url,
      platform: "unknown",
      fetch_status: "failed",
      http_status: null,
      final_url: null,
      page_title: null,
      meta_description: null,
      og_title: null,
      og_description: null,
      raw_caption_candidate: null,
      cleaned_caption_candidate: null,
      thumbnail_url: null,
      video_url: null,
      raw_video_urls: [],
      hashtags: [],
      normalized_hashtags: [],
      candidate_tags_from_text: [],
      errors: [],
      warnings: [],
      debug: {}
    };

    try {
      const parsedUrl = new URL(url);
      result.platform = parsedUrl.hostname.replace('www.', '').split('.')[0];
    } catch (e) {
      result.errors.push("Invalid URL format.");
      return NextResponse.json(result);
    }

    // 2. Try Apify for Instagram if key exists (Currently disabled as per request)
    const ENABLE_APIFY = false; 
    if (ENABLE_APIFY && result.platform === 'instagram' && process.env.APIFY_API_KEY) {
      const apifyData = await fetchFromApify(url, result.platform);
      if (apifyData) {
        result.fetch_status = 'success';
        result.raw_caption_candidate = apifyData.caption || apifyData.text || null;
        result.thumbnail_url = apifyData.displayUrl || apifyData.thumbnailUrl || null;
        result.video_url = apifyData.videoUrl || null;
        result.page_title = apifyData.ownerUsername ? `@${apifyData.ownerUsername} on Instagram` : 'Instagram Post';
        result.debug.apify = apifyData;
      }
    }

    // 3. Fallback to discovery engine
    if (result.fetch_status !== 'success') {
      const discoveryResult = await discoverAssetsFromUrl(url).catch(e => {
        result.warnings.push(`Discovery engine failed: ${e.message}`);
        return null;
      });

      if (discoveryResult) {
        result.debug.discovery = discoveryResult;
        result.fetch_status = discoveryResult.status === 'blocked' ? 'blocked' : 'success';
        result.block_reason = discoveryResult.blockReason;
        result.http_status = discoveryResult.debug.httpStatus || null;
        result.final_url = discoveryResult.url.normalized;
        result.page_title = discoveryResult.debug.rawTitle || null;
        
        result.og_title = discoveryResult.pageData?.meta['og:title'] || null;
        result.og_description = discoveryResult.pageData?.meta['og:description'] || null;
        result.meta_description = discoveryResult.pageData?.meta['description'] || null;

        if (!result.raw_caption_candidate) {
          result.raw_caption_candidate = discoveryResult.summary.topCaption?.value || 
                                        discoveryResult.summary.topText?.value || null;
        }
        
        if (!result.thumbnail_url) {
          result.thumbnail_url = discoveryResult.summary.topImage?.value || null;
        }
        if (!result.video_url) {
          result.video_url = discoveryResult.summary.topVideo?.value || null;
        }
        
        result.raw_video_urls = (discoveryResult.candidates || [])
          .filter((c: any) => c.kind === 'video')
          .map((c: any) => c.value);
          
        result.summary = discoveryResult.summary;
      }
    }

    // 4. Cleanup and Global Parsing
    if (result.raw_caption_candidate) {
      const cleanup = cleanInstagramCaptionCandidate(result.raw_caption_candidate);
      const travelParsed = parseTravelText(cleanup.cleanedText);
      
      result.cleaned_caption_candidate = travelParsed.cleanedText;
      result.travel_parsed_data = travelParsed;
      
      result.hashtags = extractHashtags(result.raw_caption_candidate).raw;
      result.normalized_hashtags = extractHashtags(result.cleaned_caption_candidate).normalized;
      result.candidate_tags_from_text = extractCandidateTagsFromText(result.cleaned_caption_candidate)
        .map((c: TagCandidate) => c.tag);
      
      result.debug.cleanupApplied = true;
      result.debug.cleanupRulesTriggered = cleanup.cleanupRulesTriggered;
    }

    // 5. Save Cache
    if (result.fetch_status === 'success') {
      try {
        await adminDb.collection('extractions').doc(urlId).set({
          ...result,
          updatedAt: FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.error('Cache save failed', e);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Extraction internal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
