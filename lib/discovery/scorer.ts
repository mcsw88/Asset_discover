import { AssetCandidate } from './types';
import { SCORING_CONFIG, KEY_SIGNALS, VALUE_SIGNALS, BOILERPLATE_PATTERNS } from './constants';
import { createHash } from 'crypto';

export function scoreCandidates(candidates: AssetCandidate[]): AssetCandidate[] {
  const scored = candidates.map(candidate => {
    let score = 0;
    const ruleIds: string[] = [];
    const scoreBreakdown: Record<string, number> = {};

    // 1. Source Weight
    const sourceW = SCORING_CONFIG.SOURCE_WEIGHTS[candidate.source] || 0.5;
    score += sourceW;
    scoreBreakdown['source'] = sourceW;

    // 2. Key Match Weight
    if (candidate.normalizedKey) {
      const keySignal = KEY_SIGNALS.find(s => s.kind === candidate.kind && s.regex.test(candidate.normalizedKey!));
      if (keySignal) {
        const bonus = keySignal.weight * SCORING_CONFIG.KEY_MATCH_BONUS;
        score += bonus;
        ruleIds.push(`key:${candidate.normalizedKey}`);
        scoreBreakdown[`key:${candidate.normalizedKey}`] = bonus;
      }
    }

    // 3. Value Match Weight
    const valueSignal = VALUE_SIGNALS.find(s => s.kind === candidate.kind && s.regex.test(candidate.value));
    if (valueSignal) {
      const bonus = valueSignal.weight * SCORING_CONFIG.VALUE_MATCH_BONUS;
      score += bonus;
      ruleIds.push(`value:${candidate.kind}`);
      scoreBreakdown[`value:${candidate.kind}`] = bonus;
    }

    // 4. Path/Context Weight
    Object.entries(SCORING_CONFIG.PATH_BONUS).forEach(([key, bonus]) => {
      if (candidate.path.toLowerCase().includes(key)) {
        score += bonus;
        ruleIds.push(`path:${key}`);
        scoreBreakdown[`path:${key}`] = bonus;
      }
    });

    // 5. Penalties
    if (candidate.value.startsWith('data:')) {
      score += SCORING_CONFIG.PENALTIES.BASE64;
      scoreBreakdown['penalty:base64'] = SCORING_CONFIG.PENALTIES.BASE64;
    }
    if (candidate.value.length > 2000 && candidate.kind !== 'text') {
      score += SCORING_CONFIG.PENALTIES.TOO_LONG;
      scoreBreakdown['penalty:too_long'] = SCORING_CONFIG.PENALTIES.TOO_LONG;
    }
    if (candidate.value.length < 5 && candidate.kind !== 'tags') {
      score += SCORING_CONFIG.PENALTIES.TOO_SHORT;
      scoreBreakdown['penalty:too_short'] = SCORING_CONFIG.PENALTIES.TOO_SHORT;
    }

    // Boilerplate Penalty
    const isBoilerplate = BOILERPLATE_PATTERNS.some(p => p.test(candidate.value));
    if (isBoilerplate) {
      score += SCORING_CONFIG.PENALTIES.BOILERPLATE;
      scoreBreakdown['penalty:boilerplate'] = SCORING_CONFIG.PENALTIES.BOILERPLATE;
    }

    // Calculate Confidence
    const maxPossibleScore = 4.0;
    const confidence = Math.min(1, Math.max(0, score / maxPossibleScore));

    // Dedup Hash
    const normalizedValue = candidate.value.trim().toLowerCase();
    const dedupHash = createHash('sha1').update(`${candidate.kind}:${normalizedValue}`).digest('hex');

    return {
      ...candidate,
      score: Number(score.toFixed(2)),
      confidence: Number(confidence.toFixed(2)),
      ruleIds,
      scoreBreakdown,
      dedupHash,
      isBoilerplate
    };
  });

  // Deduplication: keep max score for each hash
  const dedupedMap = new Map<string, AssetCandidate>();
  scored.forEach(c => {
    const existing = dedupedMap.get(c.dedupHash!);
    if (!existing || c.score > existing.score) {
      dedupedMap.set(c.dedupHash!, c);
    }
  });

  return Array.from(dedupedMap.values()).sort((a, b) => b.score - a.score);
}
