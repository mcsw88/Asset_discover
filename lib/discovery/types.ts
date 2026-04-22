export type AssetKind = 'video' | 'image' | 'text' | 'tags' | 'meta';

export interface ResolvedUrl {
  original: string;
  normalized: string;
  hostname: string;
  finalUrl?: string;
}

export interface TargetIdentity {
  id: string;
  type: 'shortcode' | 'id' | 'slug' | 'unknown';
  canonicalUrl?: string;
  platformHint?: string;
}

export type AssetScopeStatus = 'in_post' | 'likely_child' | 'out_of_post' | 'unknown';
export type ContentScopeStatus = 'target_content_confirmed' | 'target_content_likely' | 'target_content_ambiguous';
export type ExtractionScopeStatus = 'fully_scoped' | 'partially_scoped' | 'noisy_scope' | 'failed_to_scope';

export interface AssetCandidate {
  kind: AssetKind;
  value: string;
  source: 'json' | 'meta' | 'dom' | 'script' | 'text' | 'oembed' | 'network';
  path: string;
  key?: string;
  normalizedKey?: string;
  score: number;
  confidence: number;
  ruleIds?: string[];
  scoreBreakdown?: Record<string, number>;
  dedupHash?: string;
  isBoilerplate?: boolean;
  scope?: AssetScopeStatus;
  matchedToTarget?: boolean;
}

export interface MultiAssetDiagnostic {
  assetMode: 'single' | 'multi' | 'unknown';
  detectedAssetCount: number;
  resolvedImageCount: number;
  resolvedVideoCount: number;
  assets: DiagnosticAsset[];
  status: 'multi_detected' | 'child_assets_detected' | 'partial_urls_found' | 'preview_only' | 'first_asset_only' | 'mixed_assets_detected' | 'none';
  scoping?: {
    mainContainerSelector?: string;
    inPostCount: number;
    outOfPostCount: number;
    likelyChildCount: number;
    extractionStatus?: ExtractionScopeStatus;
    targetContentStatus?: ContentScopeStatus;
  };
  targetIdentity?: TargetIdentity;
}

export interface DiagnosticAsset {
  index: number;
  assetType: 'image' | 'video' | 'unknown';
  imageUrl: string | null;
  previewImageUrl: string | null;
  sourceHint: string;
  confidence: number;
  scope: AssetScopeStatus;
  matchedToTarget?: boolean;
  rawCandidates: AssetCandidate[];
}

export interface AssetDiscoveryResult {
  url: ResolvedUrl;
  timestamp: string;
  status: 'success' | 'blocked' | 'error';
  blockReason?: 'bot_protection_or_waf' | 'login_required' | 'other';
  candidates: AssetCandidate[];
  summary: {
    topText?: AssetCandidate;
    topTitle?: AssetCandidate;
    topCaption?: AssetCandidate;
    tags: string[];
    hashtags: string[];
    topVideo?: AssetCandidate;
    topImage?: AssetCandidate;
    allAssets?: DiagnosticAsset[]; // Added for multi-asset support
  };
  multiAsset?: MultiAssetDiagnostic; // Added diagnostic field
  debug: {
    matchedRules: string[];
    visitedUrls: string[];
    visitedSources: string[];
    timingMs: number;
    decisions?: string[];
    httpStatus?: number;
    rawTitle?: string;
    rawDescription?: string;
  };
  pageData?: PageData;
}

export interface PageData {
  html: string;
  meta: Record<string, string>;
  jsonLd: any[];
  scripts: string[];
  resolvedUrl: string;
  httpStatus: number;
}
