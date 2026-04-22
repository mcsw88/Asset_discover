import { AssetKind } from './types';

export interface Signal {
  pattern: RegExp;
  weight: number;
}

export const KEY_SIGNALS: Record<AssetKind, Signal[]> = {
  video: [
    { pattern: /video/i, weight: 0.8 },
    { pattern: /contentUrl/i, weight: 0.9 },
    { pattern: /embedUrl/i, weight: 0.9 },
    { pattern: /player/i, weight: 0.5 },
    { pattern: /movie/i, weight: 0.4 },
  ],
  image: [
    { pattern: /image/i, weight: 0.8 },
    { pattern: /thumbnail/i, weight: 0.7 },
    { pattern: /poster/i, weight: 0.6 },
    { pattern: /photo/i, weight: 0.5 },
    { pattern: /src/i, weight: 0.3 },
  ],
  text: [
    { pattern: /caption/i, weight: 0.9 },
    { pattern: /description/i, weight: 0.8 },
    { pattern: /articleBody/i, weight: 0.9 },
    { pattern: /headline/i, weight: 0.7 },
    { pattern: /summary/i, weight: 0.6 },
  ],
  tags: [
    { pattern: /keywords/i, weight: 0.9 },
    { pattern: /tags/i, weight: 0.9 },
    { pattern: /category/i, weight: 0.6 },
  ],
  meta: [
    { pattern: /author/i, weight: 0.5 },
    { pattern: /date/i, weight: 0.5 },
    { pattern: /publisher/i, weight: 0.5 },
  ]
};

export const VALUE_SIGNALS: Record<AssetKind, Signal[]> = {
  video: [
    { pattern: /\.(mp4|m4v|mov|webm|m3u8)$/i, weight: 1.0 },
    { pattern: /youtube\.com\/embed/i, weight: 0.9 },
    { pattern: /vimeo\.com/i, weight: 0.8 },
  ],
  image: [
    { pattern: /\.(jpg|jpeg|png|webp|gif|svg)$/i, weight: 1.0 },
    { pattern: /images\.unsplash\.com/i, weight: 0.7 },
  ],
  text: [
    { pattern: /.{50,}/, weight: 0.4 }, // Long strings are likely text
  ],
  tags: [
    { pattern: /^#\w+/, weight: 0.8 }, // Hashtags
  ],
  meta: []
};
