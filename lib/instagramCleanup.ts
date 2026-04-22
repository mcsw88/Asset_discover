export interface CleanupResult {
  cleanedText: string;
  cleanupRulesTriggered: string[];
  removedSegments: string[];
}

export interface TagCandidate {
  tag: string;
  score: number;
  reason: string;
}

/**
 * 인스타그램 특화 노이즈 제거 레이어
 */
export function cleanInstagramCaptionCandidate(text: string): CleanupResult {
  let cleanedText = text;
  const cleanupRulesTriggered = new Set<string>();
  const removedSegments: string[] = [];

  const applyRule = (ruleName: string, regex: RegExp) => {
    const matches = cleanedText.match(regex);
    if (matches && matches.length > 0) {
      cleanupRulesTriggered.add(ruleName);
      removedSegments.push(...matches.map(m => m.trim()));
      cleanedText = cleanedText.replace(regex, ' ');
    }
  };

  // 1. "on Instagram:" 프리픽스 (예: "대한 여행 on Instagram: ", "User on Instagram: '")
  const onInstaRegex = /^.*?on Instagram:\s*["']?/i;
  const onInstaMatch = cleanedText.match(onInstaRegex);
  if (onInstaMatch) {
    cleanupRulesTriggered.add('remove_on_instagram_prefix');
    removedSegments.push(onInstaMatch[0].trim());
    cleanedText = cleanedText.replace(onInstaRegex, '');
  }

  // 2. 계정명 + 날짜 패턴 (예: "trip_again_kor on March 31, 2026")
  applyRule('remove_account_date_pattern', /[\w.-]+\s+on\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}/gi);

  // 3. likes / comments 카운트 (예: "1,525 likes", "23 comments", "10 likes, 2 comments")
  applyRule('remove_likes_comments_count', /(?:[\d,.]+[KMB]?\s*(?:likes?|comments?)(?:,\s*)?)+/gi);

  // 4. 단순 날짜 표현 (예: "on March 31, 2026")
  applyRule('remove_date_phrase', /(?:on\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}/gi);

  // 5. UI성 텍스트
  applyRule('remove_ui_text', /\b(Close|More options|Load more comments)\b/gi);

  // 6. Mentions (@username)
  applyRule('remove_mentions', /@[\w.-]+/g);

  // 7. URLs
  applyRule('remove_urls', /https?:\/\/\S+/g);

  // 후처리: 끝에 남은 따옴표 제거 및 다중 공백 정리
  cleanedText = cleanedText.replace(/["']$/g, '');
  cleanedText = cleanedText.replace(/\s{2,}/g, ' ').trim();

  return {
    cleanedText,
    cleanupRulesTriggered: Array.from(cleanupRulesTriggered),
    removedSegments
  };
}

/**
 * 인스타그램 전용 Stopwords 및 일반 Stopwords
 */
const STOPWORDS_EN = new Set([
  "the", "and", "is", "in", "it", "to", "of", "for", "on", "with", "this", "that",
  "amazing", "wow", "best", "nice", "good", "great", "awesome", "must", "beautiful",
  "follow", "dm", "link", "bio", "sale", "event", "shop", "click", "promotion", "sponsored",
  "today", "video", "post", "photo", "pic", "instagram", "reels", "reel", "official", "travelgram",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
  "am", "pm", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "trip", "again", "kor" // 계정명 파편 예시
]);

const STOPWORDS_KO = new Set([
  "그리고", "근데", "진짜", "너무", "정말", "완전", "오늘", "지금",
  "좋아요", "팔로우", "맞팔", "선팔", "소통", "환영", "디엠", "링크",
  "이벤트", "할인", "구매", "사진", "영상", "게시물", "입니다", "있는", "하는", "에서", "으로", "까지", "부터"
]);

/**
 * 본문 기반 태그 후보 추출 (Score 기반)
 */
export function extractCandidateTagsFromText(text: string): TagCandidate[] {
  // 해시태그는 별도로 추출하므로 후보 추출 시에는 제거
  let cleanText = text.replace(/#\w+/g, ' ');
  // 알파벳, 한글, 공백만 남김
  cleanText = cleanText.replace(/[^a-zA-Z가-힣\s]/g, ' ');

  const tokens = cleanText.toLowerCase().split(/\s+/);
  const tokenCounts = new Map<string, number>();

  for (const token of tokens) {
    if (token.length <= 1) continue; // 1글자 토큰 제거
    if (/^\d+$/.test(token)) continue; // 숫자만 있는 토큰 제거
    if (STOPWORDS_EN.has(token) || STOPWORDS_KO.has(token)) continue; // 불용어 제거

    tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
  }

  const candidates: TagCandidate[] = [];
  for (const [token, count] of tokenCounts.entries()) {
    let score = 0.5;
    let reason = "text_keyword";

    // 반복 등장 시 가점
    if (count > 1) {
      score += 0.2;
      reason = "repeated_keyword";
    }

    // 길이가 긴 단어 (특히 한국어 명사) 가점
    if (token.length >= 3) {
      score += 0.1;
    }

    // 영어 토큰 감점 (한국어 혼용 환경에서 일반 영어 단어 배제 목적, 단 지명 등은 남을 수 있음)
    if (/^[a-z]+$/.test(token)) {
      score -= 0.1;
    }

    score = Math.min(Math.max(score, 0.1), 0.99); // 0.1 ~ 0.99 사이로 정규화

    candidates.push({ tag: token, score: Number(score.toFixed(2)), reason });
  }

  // 점수 내림차순 정렬
  candidates.sort((a, b) => b.score - a.score);

  return candidates.slice(0, 10);
}

export function extractHashtags(text: string) {
  if (!text) return { raw: [], normalized: [] };
  const matches = text.match(/#\w+/g) || [];
  const uniqueRaw = Array.from(new Set(matches));
  const normalized = uniqueRaw.map(tag => tag.replace('#', '').toLowerCase());
  return { raw: uniqueRaw, normalized };
}
