import { NextResponse } from 'next/server';
import { discoverAssetsFromUrl } from '@/lib/discovery/engine';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const result = await discoverAssetsFromUrl(url);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Discovery Error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Expected AssetDiscoveryResult JSON Shape:
 * 
 * {
 *   "url": {
 *     "original": "https://www.instagram.com/reel/C_...",
 *     "normalized": "https://www.instagram.com/reel/C_...",
 *     "hostname": "www.instagram.com",
 *     "finalUrl": "https://www.instagram.com/reels/C_..."
 *   },
 *   "timestamp": "2026-04-15T07:30:00.000Z",
 *   "candidates": [
 *     {
 *       "kind": "video",
 *       "value": "https://scontent.cdninstagram.com/v/...",
 *       "source": "json",
 *       "path": "jsonld[0].VideoObject.contentUrl",
 *       "key": "contentUrl",
 *       "normalizedKey": "contentUrl",
 *       "score": 3.2,
 *       "confidence": 0.85
 *     },
 *     ...
 *   ],
 *   "summary": {
 *     "topVideo": { ... },
 *     "topImage": { ... },
 *     "topText": { ... },
 *     "tags": ["travel", "newzealand"]
 *   },
 *   "debug": {
 *     "matchedRules": ["ogVideo", "contentUrl", "thumbnailUrl"],
 *     "visitedUrls": ["https://www.instagram.com/reel/C_..."],
 *     "timingMs": 450
 *   }
 * }
 */

/**
 * Test URLs for Manual Verification:
 * 
 * 1. Instagram Reel:
 *    https://www.instagram.com/reels/C_123456789/
 * 
 * 2. YouTube Shorts:
 *    https://www.youtube.com/shorts/abcdefghijk
 * 
 * 3. Generic Blog/Article:
 *    https://vercel.com/blog/nextjs-15
 */
