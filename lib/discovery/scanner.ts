import { AssetCandidate, AssetKind, TargetIdentity } from './types';
import { KEY_SIGNALS, VALUE_SIGNALS, MULTI_ASSET_SIGNALS, EXCLUDE_VALUE_PATTERNS } from './constants';
import { normalizeKey, extractUrls } from './utils';

export class RecursiveScanner {
  private candidates: AssetCandidate[] = [];
  private visited = new Set<any>();
  private multiAssetSignals: string[] = [];

  constructor(
    private source: 'json' | 'meta' | 'dom' | 'script' | 'oembed',
    private targetIdentity?: TargetIdentity
  ) {}

  /**
   * Iteratively scans an object or array for asset signals
   */
  scan(data: any, rootPath: string = ''): AssetCandidate[] {
    this.candidates = [];
    this.visited.clear();
    this.multiAssetSignals = [];
    
    const stack: { data: any; path: string; depth: number }[] = [
      { data, path: rootPath, depth: 0 }
    ];

    while (stack.length > 0) {
      const { data: currentData, path: currentPath, depth } = stack.pop()!;

      if (currentData === null || currentData === undefined || depth > 10) continue;

      if (typeof currentData === 'object') {
        if (this.visited.has(currentData)) continue;
        this.visited.add(currentData);

        if (Array.isArray(currentData)) {
          // Check if this array itself is a multi-asset container
          if (currentData.length > 1) {
            const lastPart = currentPath.split('.').pop() || '';
            if (MULTI_ASSET_SIGNALS.KEYS.some(regex => regex.test(lastPart))) {
              this.multiAssetSignals.push(currentPath);
            }
          }

          for (let i = currentData.length - 1; i >= 0; i--) {
            stack.push({
              data: currentData[i],
              path: `${currentPath}[${i}]`,
              depth: depth + 1
            });
          }
        } else {
          // Identity Pruning: If we are in a JSON object that has an 'id' or 'shortcode'
          // that doesn't match our target, we can skip this branch.
          if (this.targetIdentity && this.source === 'json') {
            const currentId = currentData.id || currentData.shortcode || currentData.code || currentData.slug;
            if (currentId && typeof currentId === 'string' && currentId !== this.targetIdentity.id) {
              // This is likely a related/recommended post block in the JSON
              continue;
            }
          }

          const entries = Object.entries(currentData);
          // Limit entries to avoid hanging on massive objects
          const limitedEntries = entries.slice(0, 500);
          
          for (let i = limitedEntries.length - 1; i >= 0; i--) {
            const [key, value] = limitedEntries[i];
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            const normKey = normalizeKey(key);

            // Check for multi-asset keys
            if (MULTI_ASSET_SIGNALS.KEYS.some(regex => regex.test(normKey))) {
              this.multiAssetSignals.push(nextPath);
            }

            // 1. Check Key Signals
            this.checkKey(key, normKey, value, nextPath);

            // 2. Check Value Signals
            this.checkValue(key, normKey, value, nextPath);

            // 3. Push to stack if object/array
            if (value && typeof value === 'object') {
              stack.push({
                data: value,
                path: nextPath,
                depth: depth + 1
              });
            }
          }
        }
      }
    }

    return this.candidates;
  }

  getMultiAssetSignals(): string[] {
    return this.multiAssetSignals;
  }

  private traverse() {
    // No longer used, replaced by iterative scan
  }

  private checkKey(rawKey: string, normKey: string, value: any, path: string) {
    // We only care about keys if the value is a string or number (potential asset value)
    if (typeof value !== 'string' && typeof value !== 'number') return;

    for (const signal of KEY_SIGNALS) {
      if (signal.regex.test(normKey)) {
        this.addCandidate(signal.kind, String(value), path, rawKey, normKey);
      }
    }
  }

  private checkValue(rawKey: string, normKey: string, value: any, path: string) {
    if (typeof value !== 'string') return;

    // Direct value matching
    for (const signal of VALUE_SIGNALS) {
      if (signal.regex.test(value)) {
        this.addCandidate(signal.kind, value, path, rawKey, normKey);
      }
    }

    // Extract URLs from text blobs if they look like they contain URLs
    // But don't recurse deeply
    if (value.length > 10 && value.includes('http') && !path.includes('.extracted')) {
      const urls = extractUrls(value);
      urls.forEach((url, i) => {
        // Just check the extracted URL once, don't recurse further
        for (const signal of VALUE_SIGNALS) {
          if (signal.regex.test(url)) {
            this.addCandidate(signal.kind, url, `${path}.extracted[${i}]`, rawKey, normKey);
          }
        }
      });
    }
  }

  private addCandidate(kind: AssetKind, value: string, path: string, key: string, normKey: string) {
    if (!value || value.length < 2) return;

    // Reject if it matches any exclusion pattern (e.g., post permalinks)
    if (EXCLUDE_VALUE_PATTERNS.some(regex => regex.test(value))) {
      return;
    }

    this.candidates.push({
      kind,
      value,
      source: this.source,
      path,
      key,
      normalizedKey: normKey,
      score: 0,
      confidence: 0
    });
  }
}
