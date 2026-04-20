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
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    
    const result: ExtractionResult = {
      url,
      platform: "instagram",
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

    // 0. 범용 자산 발견 엔진 실행 (병렬로 실행 가능하지만 일단 순차적으로)
    const discoveryResult = await discoverAssetsFromUrl(url).catch(e => {
      result.warnings.push(`Discovery engine failed: ${e.message}`);
      return null;
    });
    if (discoveryResult) {
      result.debug.discovery = discoveryResult;
      result.summary = discoveryResult.summary;
      
      if (discoveryResult.status === 'blocked') {
        result.fetch_status = 'blocked';
        result.block_reason = discoveryResult.blockReason;
        result.http_status = discoveryResult.debug.httpStatus || null;
        result.page_title = discoveryResult.debug.rawTitle || null;
        result.warnings.push(`Access might be restricted: ${discoveryResult.blockReason}`);
        // Do not return here, continue to populate metadata from pageData if available
      }
    } else {
      result.summary = {
        topText: null,
        tags: [],
        hashtags: [],
        topVideo: null,
        topImage: null
      };
    }

    if (!discoveryResult || !discoveryResult.pageData) {
      result.errors.push("Discovery engine failed to fetch page data.");
      return NextResponse.json(result);
    }

    const pageData = discoveryResult.pageData;
    result.http_status = pageData.httpStatus;
    result.final_url = pageData.resolvedUrl;
    result.fetch_status = "success";

    // Legacy field population from discovery result
    result.page_title = pageData.meta['page_title'] || pageData.meta['title'] || null;
    result.meta_description = pageData.meta['description'] || null;
    result.og_title = pageData.meta['og:title'] || null;
    result.og_description = pageData.meta['og:description'] || null;

    if (result.page_title && result.page_title.toLowerCase().includes('login')) {
      result.warnings.push("Page title indicates a login wall. Meta tags might be empty.");
    }

    // Try JSON-LD for caption
    let jsonLdCaption: string | null = null;
    pageData.jsonLd.forEach(item => {
      if (item.articleBody) jsonLdCaption = item.articleBody;
      else if (item.caption) jsonLdCaption = typeof item.caption === 'string' ? item.caption : item.caption.text;
      else if (item.description) jsonLdCaption = item.description;
      else if (item.name && item['@type'] === 'VideoObject') jsonLdCaption = item.name;
    });

    let caption = null;
    let source = "none";

    const isLoginWall = (text: string | null) => text && text.includes('Create an account or log in');

    // Priority: Discovery Summary (Caption) > JSON-LD > OG > Meta > Title
    if (discoveryResult.summary.topCaption?.value) {
      caption = discoveryResult.summary.topCaption.value;
      source = `discovery:caption:${discoveryResult.summary.topCaption.source}`;
    } else if (discoveryResult.summary.topText?.value) {
      caption = discoveryResult.summary.topText.value;
      source = `discovery:text:${discoveryResult.summary.topText.source}`;
    } else if (jsonLdCaption) {
      caption = jsonLdCaption;
      source = "json-ld";
    } else if (result.og_description && !isLoginWall(result.og_description)) {
      caption = result.og_description;
      source = "og:description";
    } else if (result.meta_description && !isLoginWall(result.meta_description)) {
      caption = result.meta_description;
      source = "meta:description";
    } else if (result.og_title && !isLoginWall(result.og_title)) {
      caption = result.og_title;
      source = "og:title";
    } else if (result.page_title && !result.page_title.toLowerCase().includes('login')) {
      caption = result.page_title;
      source = "title";
    }

    result.raw_caption_candidate = caption ? caption.trim() : null;
    
    // Ensure we have a thumbnail and video for legacy display
    if (discoveryResult.summary.topImage) {
      result.thumbnail_url = discoveryResult.summary.topImage.value;
      result.debug.thumbnail = discoveryResult.summary.topImage.value;
    } else if (pageData.meta['og:image']) {
      result.thumbnail_url = pageData.meta['og:image'];
      result.debug.thumbnail = pageData.meta['og:image'];
    }

    if (discoveryResult.summary.topVideo) {
      result.video_url = discoveryResult.summary.topVideo.value;
    } else if (pageData.meta['og:video']) {
      result.video_url = pageData.meta['og:video'];
    } else if (pageData.meta['twitter:player']) {
      result.video_url = pageData.meta['twitter:player'];
    }

    // Collect all raw video URLs (like googlevideo.com, cdninstagram.com)
    const rawVideoUrls = new Set<string>();
    discoveryResult.candidates
      .filter(c => c.kind === 'video')
      .forEach(c => rawVideoUrls.add(c.value));
    
    if (pageData.meta['og:video']) rawVideoUrls.add(pageData.meta['og:video']);
    if (pageData.meta['twitter:player']) rawVideoUrls.add(pageData.meta['twitter:player']);
    
    result.raw_video_urls = Array.from(rawVideoUrls);

    result.debug.caption_source = source;
    result.debug.raw_meta = {
      page_title: result.page_title,
      meta_description: result.meta_description,
      og_title: result.og_title,
      og_description: result.og_description,
      json_ld_found: !!jsonLdCaption
    };
    result.debug.used_fields = Object.entries({
      page_title: result.page_title,
      meta_description: result.meta_description,
      og_title: result.og_title,
      og_description: result.og_description
    }).filter(([_, v]) => v !== null).map(([k]) => k);

    if (!result.raw_caption_candidate) {
      result.warnings.push("Could not find a valid caption/description in the meta tags.");
      if (isLoginWall(result.og_description) || isLoginWall(result.meta_description)) {
        result.warnings.push("Instagram is blocking the request and returning a login page. This is a known limitation of server-side scraping without auth.");
      }
    } else {
      // 1. 인스타 기본 노이즈 정제 (likes, comments, on Instagram 등)
      const cleanupResult = cleanInstagramCaptionCandidate(result.raw_caption_candidate);
      
      result.debug.cleanupApplied = true;
      result.debug.cleanupRulesTriggered = cleanupResult.cleanupRulesTriggered;
      result.debug.removedSegments = cleanupResult.removedSegments;

      // 2. 고도화된 여행 텍스트 파서 적용 (여기서 '내돈내산', '협찬' 등 추가 노이즈가 한 번 더 제거됨)
      const travelParsedData = parseTravelText(cleanupResult.cleanedText);
      result.travel_parsed_data = travelParsedData;

      // 최종 Cleaned Caption은 인스타 노이즈 + 여행 노이즈가 모두 제거된 텍스트
      result.cleaned_caption_candidate = travelParsedData.cleanedText;

      // 3. 해시태그 추출 (최종 클린 텍스트 기준)
      const tags = extractHashtags(result.cleaned_caption_candidate);
      
      // Merge with discovery hashtags
      const allHashtags = new Set([...tags.raw, ...(discoveryResult?.summary.hashtags || [])]);
      result.hashtags = Array.from(allHashtags);
      result.normalized_hashtags = Array.from(new Set([...tags.normalized, ...(discoveryResult?.summary.hashtags || []).map(t => t.toLowerCase())]));
      
      if (result.hashtags.length === 0) {
        result.warnings.push("No hashtags found in the cleaned caption.");
      }

      // 4. 태그 후보 추출
      const finalCandidates = travelParsedData.cleanedText.split(/\s+/).filter(t => t.length > 0);
      
      // Merge with discovery tags (meta keywords)
      const allTags = new Set([...finalCandidates, ...(discoveryResult?.summary.tags || [])]);
      result.candidate_tags_from_text = Array.from(allTags);
      
      // 기존 1-gram 스코어링 결과는 디버그용으로만 유지
      const candidateObjects = extractCandidateTagsFromText(cleanupResult.cleanedText);
      result.debug.candidate_tags_scored = candidateObjects;
    }

    return NextResponse.json(result);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
