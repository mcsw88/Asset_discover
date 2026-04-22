import { AssetKind } from './types';

/**
 * Scoring Weights & Penalties
 */
export const SCORING_CONFIG = {
  SOURCE_WEIGHTS: {
    json: 1.1,
    meta: 0.5, // Lowered for generic description/keywords
    dom: 0.7,
    script: 0.8,
    network: 0.9,
    oembed: 1.2,
    text: 0.6
  },
  KEY_MATCH_BONUS: 0.5,
  VALUE_MATCH_BONUS: 0.5,
  PATH_BONUS: {
    og: 0.4,
    twitter: 0.3,
    jsonld: 0.5,
    schema: 0.4,
    oembed: 0.6,
    title: 0.5
  },
  PENALTIES: {
    BASE64: -0.8,
    TOO_LONG: -0.5,
    TOO_SHORT: -0.3,
    UNLIKELY_EXT: -0.4,
    BOILERPLATE: -1.8 // Increased penalty
  }
};

// Generic boilerplate patterns to penalize
export const BOILERPLATE_PATTERNS = [
  /동영상, 공유, 카메라폰, 동영상폰, 무료, 올리기/i,
  /YouTube에서 마음에 드는 동영상과 음악을 감상하고/i,
  /Enjoy the videos and music you love/i,
  /upload original content, and share it all with friends/i,
  /Instagram.*사진.*비디오/i,
  /Instagram.*photos.*videos/i
];

export interface SignalPattern {
  regex: RegExp;
  weight: number;
  kind: AssetKind;
}

export const KEY_SIGNALS: SignalPattern[] = [
  { regex: /video|contentUrl|embedUrl|player|stream/i, weight: 1.0, kind: 'video' },
  { regex: /image|thumbnail|poster|photo|picture/i, weight: 1.0, kind: 'image' },
  { regex: /title|name|headline|caption|description|articleBody|summary|shortDescription/i, weight: 0.8, kind: 'text' },
  { regex: /keywords|tags|category/i, weight: 0.9, kind: 'tags' },
  { regex: /author|publisher|date/i, weight: 0.5, kind: 'meta' }
];

export const VALUE_SIGNALS: SignalPattern[] = [
  { regex: /\.(mp4|m4v|mov|webm|m3u8|mpeg|mpg)(\?.*)?$/i, weight: 1.0, kind: 'video' },
  { regex: /video\/|application\/vnd\.apple\.mpegurl/i, weight: 1.0, kind: 'video' },
  { regex: /googlevideo\.com\/videoplayback/i, weight: 1.0, kind: 'video' },
  { regex: /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i, weight: 1.0, kind: 'image' },
  { regex: /youtube\.com\/embed|vimeo\.com/i, weight: 0.9, kind: 'video' },
  { regex: /^#[a-zA-Z가-힣]\w+/, weight: 0.8, kind: 'tags' }
];

export const EXCLUDE_VALUE_PATTERNS = [
  /\/p\/[a-zA-Z0-9_-]+\/?$/i,      // Instagram Post
  /\/reel\/[a-zA-Z0-9_-]+\/?$/i,   // Instagram Reel
  /\/tv\/[a-zA-Z0-9_-]+\/?$/i,     // Instagram TV
  /\/shorts\/[a-zA-Z0-9_-]+\/?$/i, // YouTube Shorts
  /\/watch\?v=[a-zA-Z0-9_-]+/i,    // YouTube Watch
  /instagram\.com\/[a-zA-Z0-9._]+\/?$/i, // Profile link
  /twitter\.com\/[a-zA-Z0-9._]+\/status\/\d+/i, // Tweet link
  /facebook\.com\/.*\/posts\/\d+/i // FB Post link
];

export const MULTI_ASSET_SIGNALS = {
  KEYS: [
    /carousel/i,
    /gallery/i,
    /slide/i,
    /edge_sidecar_to_children/i,
    /display_resources/i,
    /media_contents/i,
    /video_versions/i,
    /image_versions/i,
    /items/i,
    /edges/i,
    /nodes/i
  ],
  CONTAINERS: [
    '.carousel',
    '.gallery',
    '.slideshow',
    '.swiper-slide',
    '.slick-slide',
    'article',
    'li'
  ],
  MAIN_CONTAINERS: [
    'article',
    'main',
    '[role="main"]',
    '#content',
    '.post-content',
    '.entry-content',
    '.post',
    '.article',
    '.main-content'
  ],
  EXCLUDE_SELECTORS: [
    'header',
    'footer',
    'nav',
    'aside',
    '.sidebar',
    '.related',
    '.recommendations',
    '.comments',
    '.profile',
    '.avatar'
  ]
};
