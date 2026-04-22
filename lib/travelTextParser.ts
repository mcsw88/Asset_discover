export interface Rule {
  pattern: RegExp;
  label: string;
}

export interface ExtractedFacet {
  label: string;
  matches: string[];
}

export interface ParseResult {
  originalText: string;
  cleanedText: string;
  noise: ExtractedFacet[];
  anchors: string[];
  locationLinks: ExtractedFacet[];
  placeIdentities: ExtractedFacet[];
  features: ExtractedFacet[];
  experiences: ExtractedFacet[];
  priorities: ExtractedFacet[];
  conditions: ExtractedFacet[];
}

// ==========================================
// 1. Rule Definitions (고도화된 정규화 및 매핑)
// ==========================================

// F8: NOISE_RULES (본문 해석에 불필요한 노이즈 - 인스타 특화)
const NOISE_RULES: Rule[] = [
  { pattern: /내돈내산|협찬|광고\s*아님|솔직\s*후기|원고료/g, label: "NOISE_SPONSORSHIP" },
  { pattern: /구독|좋아요|알림\s*설정|링크\s*클릭|프로필\s*링크|디엠|DM/gi, label: "NOISE_PROMOTION" },
  { pattern: /^\s*[\#\#]+\s*$/g, label: "NOISE_FORMATTING" }
];

// F1: LOCATION_LINK_RULES (위치/접근성 링크)
const LOCATION_LINK_RULES: Rule[] = [
  { pattern: /역\s*(근처|앞|주변|인근)|역세권/g, label: "NEAR_STATION" },
  { pattern: /도보\s*\d+분|걸어서|뚜벅이/g, label: "WALKABLE" },
  { pattern: /가는\s*길|접근성(이)?\s*좋(은|다)/g, label: "GOOD_ACCESSIBILITY" },
  { pattern: /주차(장)?\s*(가능|넓|편리|널찍|무료)|발렛/g, label: "PARKING_AVAILABLE" }
];

// F2: PLACE_IDENTITY_RULES (장소의 정체성)
const PLACE_IDENTITY_RULES: Rule[] = [
  { pattern: /카페|커피숍|디저트\s*맛집|베이커리|에스프레소바/g, label: "IDENTITY_CAFE" },
  { pattern: /식당|맛집|밥집|레스토랑|오마카세|노포|파인다이닝/g, label: "IDENTITY_RESTAURANT" },
  { pattern: /호텔|숙소|펜션|리조트|게하|게스트하우스|풀빌라|글램핑/g, label: "IDENTITY_ACCOMMODATION" },
  { pattern: /공원|수목원|산책로|숲길|둘레길/g, label: "IDENTITY_PARK" },
  { pattern: /미술관|전시관|박물관|갤러리|팝업(스토어)?/g, label: "IDENTITY_EXHIBITION" },
  { pattern: /바다|해수욕장|해변/g, label: "IDENTITY_BEACH" },
  { pattern: /핫플(레이스)?/g, label: "IDENTITY_HOTPLACE" }
];

// F4: FEATURE_RULES (장소의 특징 - 의미적 통합 및 인스타 감성 키워드 추가)
const FEATURE_RULES: Rule[] = [
  { pattern: /야경이\s*(좋다|멋지다|예쁘다|끝내준다)|야경\s*맛집|시티뷰/g, label: "FEATURE_NIGHT_VIEW" },
  { pattern: /오션뷰|바다뷰|씨뷰/g, label: "FEATURE_OCEAN_VIEW" },
  { pattern: /마운틴뷰|숲뷰|리버뷰/g, label: "FEATURE_NATURE_VIEW" },
  { pattern: /조용(하다|한)|한적(하다|한)|차분(하다|한)|사람이\s*적(은|다)|여유롭(다|게)|프라이빗/g, label: "FEATURE_QUIET" },
  { pattern: /좌석이\s*넓|널찍|자리\s*간격이\s*넓|공간이\s*크|탁\s*트인|대형\s*카페|규모가\s*큰/g, label: "FEATURE_SPACIOUS" },
  { pattern: /테라스|루프탑|야외\s*좌석/g, label: "FEATURE_OUTDOOR_SEATING" },
  { pattern: /깔끔|깨끗|청결|관리가\s*잘/g, label: "FEATURE_CLEAN" },
  { pattern: /사진\s*찍기\s*좋|포토존|인생샷|뷰가\s*(좋|예쁘)|뷰\s*맛집|채광|햇살\s*맛집/g, label: "FEATURE_PHOTO_SPOT" },
  { pattern: /가성비|저렴|가격이\s*착|혜자/g, label: "FEATURE_COST_EFFECTIVE" },
  { pattern: /감성|힙한|분위기\s*좋은|이국적/g, label: "FEATURE_VIBE" },
  { pattern: /존맛|꿀맛|미친맛|퀄리티|맛있/g, label: "FEATURE_TASTY" }
];

// F3: EXPERIENCE_RULES (무엇을 하기 좋은가)
const EXPERIENCE_RULES: Rule[] = [
  { pattern: /산책하기\s*좋|걷기\s*좋/g, label: "EXP_WALKING" },
  { pattern: /데이트하기\s*좋|데이트\s*코스|연인과|소개팅/g, label: "EXP_DATING" },
  { pattern: /혼자\s*가기\s*좋|혼카|혼밥|혼자서|혼술/g, label: "EXP_SOLO" },
  { pattern: /힐링(하기|되는)|쉬어가기\s*좋|호캉스/g, label: "EXP_HEALING" },
  { pattern: /카공|작업하기\s*좋|노트북/g, label: "EXP_WORK_STUDY" },
  { pattern: /피크닉|캠핑/g, label: "EXP_PICNIC" },
  { pattern: /드라이브/g, label: "EXP_DRIVE" }
];

// F6: PRIORITY_RULES (강력한 추천/우선순위 신호)
const PRIORITY_RULES: Rule[] = [
  { pattern: /강추|무조건\s*가|꼭\s*가|인생\s*맛집|재방문|N번째/g, label: "PRIORITY_HIGH_RECOMMENDATION" },
  { pattern: /나만\s*알고\s*싶은|숨겨진|로컬\s*맛집|현지인\s*맛집/g, label: "PRIORITY_HIDDEN_GEM" },
  { pattern: /웨이팅(이)?\s*(필수|있|길)|오픈런|캐치테이블|테이블링/g, label: "PRIORITY_HIGH_DEMAND" }
];

// F7: CONDITION_RULES (언제, 누구와 가기 좋은가)
const CONDITION_RULES: Rule[] = [
  { pattern: /비\s*올\s*때|흐린\s*날|실내\s*데이트|비오는\s*날/g, label: "COND_RAINY_DAY" },
  { pattern: /아이와\s*함께|예스키즈존|가족(끼리|과)|아기랑/g, label: "COND_WITH_KIDS" },
  { pattern: /노키즈존/g, label: "COND_NO_KIDS" },
  { pattern: /반려견\s*동반|애견\s*동반|강아지랑/g, label: "COND_PET_FRIENDLY" },
  { pattern: /주말에|주말\s*나들이/g, label: "COND_WEEKEND" },
  { pattern: /평일에/g, label: "COND_WEEKDAY" },
  { pattern: /연말|크리스마스|기념일/g, label: "COND_SPECIAL_DAY" }
];

// ==========================================
// 2. Extractor Functions (고도화: 매칭된 텍스트 추적)
// ==========================================

function extractByRules(text: string, rules: Rule[]): ExtractedFacet[] {
  const extractedMap = new Map<string, Set<string>>();
  
  for (const rule of rules) {
    // Reset lastIndex
    rule.pattern.lastIndex = 0;
    const matches = text.match(rule.pattern);
    
    if (matches && matches.length > 0) {
      if (!extractedMap.has(rule.label)) {
        extractedMap.set(rule.label, new Set<string>());
      }
      matches.forEach(m => extractedMap.get(rule.label)!.add(m.trim()));
    }
  }
  
  const result: ExtractedFacet[] = [];
  extractedMap.forEach((matchSet, label) => {
    result.push({ label, matches: Array.from(matchSet) });
  });
  
  return result;
}

function applyNoiseRules(text: string): ExtractedFacet[] {
  return extractByRules(text, NOISE_RULES);
}

function removeNoiseText(text: string): string {
  let cleaned = text;
  for (const rule of NOISE_RULES) {
    cleaned = cleaned.replace(rule.pattern, ' ');
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * [핵심 공식] 문장을 해체하여 유의미한 키워드 덩어리만 추출하는 범용 함수
 * 어떤 링크의 텍스트가 들어오더라도 조사, 어미, 불용어를 깎아내어 데이터화 합니다.
 */
export function extractMeaningfulKeywords(text: string): string {
  // 1. 특수문자, 이모지 제거 (한글, 영문, 숫자, 공백만 남김)
  let cleanText = text.replace(/[^\w\s가-힣]/g, ' ');

  // 2. 범용적인 홍보/서술어/수식어 패턴 제거 (어떤 링크든 적용되도록)
  const removePatterns = [
    /꼭\s*가봐야\s*할/g, /소개합니다/g, /선사하는데요/g, /몰려드는\s*곳이며/g, 
    /만날\s*수\s*있습니다/g, /경험할\s*수\s*있어/g, /잊을\s*수\s*없는\s*곳인데요/g, 
    /안겨줍니다/g, /공유해\s*보세요/g, /태그해/g, /위치한/g, /그대로\s*보존돼/g, 
    /발을\s*들인\s*듯한\s*감동을/g, /성지로/g, /전\s*세계/g, /깎아지른/g, 
    /사이로/g, /타며/g, /비현실적인/g, /세계\s*최고\s*수준의/g, /한자리에서/g, 
    /한번\s*보면\s*절대/g, /끓어오르는/g, /지구\s*위/g, 
    /멋진\s*풍경을\s*함께\s*보고\s*싶은\s*친구를/g, /이\s*소식을/g,
    /느낄\s*수\s*있는/g, /즐길\s*수\s*있는/g, /볼\s*수\s*있는/g, /할\s*수\s*있는/g,
    /다녀왔어요/g, /다녀왔습니다/g, /추천합니다/g, /추천해요/g, /가보세요/g,
    /알려드립니다/g, /알려드릴게요/g, /준비했습니다/g, /준비했어요/g
  ];
  
  removePatterns.forEach(pattern => {
    cleanText = cleanText.replace(pattern, ' ');
  });

  // 3. 토큰화
  const tokens = cleanText.split(/\s+/);
  
  // 4. 불용어 사전 (의미 없는 명사, 대명사, 부사, 접속사 등)
  const stopWords = new Set([
    "이", "그", "저", "이런", "그런", "저런", "어떤", "무슨", "어느",
    "그리고", "그래서", "그러나", "하지만", "그런데", "또는", "혹은",
    "너무", "진짜", "정말", "완전", "아주", "매우", "몹시", "엄청",
    "가장", "제일", "훨씬", "더", "덜", "조금", "약간", "다소", "꽤",
    "수", "것", "곳", "때", "등", "중", "분", "명", "개", "번",
    "있는", "없는", "하는", "할", "된", "될", "본", "볼", "간", "갈",
    "꼭", "다시", "자주", "항상", "언제나", "가끔", "종종", "이미", "벌써",
    "아직", "미리", "먼저", "우리", "저희", "나", "너", "당신", "그대",
    "있습니다", "입니다", "합니다", "해요", "인데요", "어때요", "좋아요", "많아요", "있어요"
  ]);

  // 5. 조사 및 어미 제거 정규식
  // 명사 뒤에 붙는 조사나 동사/형용사 어미를 잘라냅니다.
  const suffixRegex = /(은|는|이|가|을|를|에|에서|로|으로|와|과|의|도|만|까지|부터|조차|치고|마저|에다|에다가|께서|한테|에게|더러|한테서|에게서|입니다|합니다|해요|인데요|습니다|다)$/;

  const resultTokens: string[] = [];

  for (let token of tokens) {
    if (!token) continue;
    
    // 조사/어미 제거 (최대 2번 반복, 예: "에서는" -> "에서" -> "")
    token = token.replace(suffixRegex, '');
    token = token.replace(suffixRegex, '');

    if (token.length > 0 && !stopWords.has(token)) {
      // 숫자만 있거나 단순 날짜/시간 표현 제외
      if (/^\d+$/.test(token) || /^\d+(년|월|일|시|분|초)$/.test(token)) continue;
      resultTokens.push(token);
    }
  }

  // 6. 띄어쓰기로 재조합하여 순수 키워드 덩어리 반환
  return resultTokens.join(' ');
}

function extractAnchors(text: string): string[] {
  // 간단한 지역명/랜드마크 앵커 추출 (예시)
  const anchorPattern = /(홍대|강남|성수|이태원|제주|부산|오사카|도쿄|후쿠오카|방콕|다낭|연남|한남|압구정)[^\s]*/g;
  const matches = text.match(anchorPattern) || [];
  return Array.from(new Set(matches));
}

// ==========================================
// 3. Main Parser Orchestrator
// ==========================================
export function parseTravelText(text: string): ParseResult {
  // 1. Noise Detection & Removal
  const noise = applyNoiseRules(text);
  const noNoiseText = removeNoiseText(text);

  // 2. 핵심 키워드 추출 (조사, 어미, 불용어 완전 해체)
  const cleanedText = extractMeaningfulKeywords(noNoiseText);

  // 3. Extract Facets from Cleaned Text
  // (Facets extraction should ideally run on the noNoiseText to catch full context like "비 올 때", 
  // but since we want the final output to be keyword-based, we'll run it on noNoiseText and return cleanedText)
  const anchors = extractAnchors(noNoiseText);
  const locationLinks = extractByRules(noNoiseText, LOCATION_LINK_RULES);
  const placeIdentities = extractByRules(noNoiseText, PLACE_IDENTITY_RULES);
  const features = extractByRules(noNoiseText, FEATURE_RULES);
  const experiences = extractByRules(noNoiseText, EXPERIENCE_RULES);
  const priorities = extractByRules(noNoiseText, PRIORITY_RULES);
  const conditions = extractByRules(noNoiseText, CONDITION_RULES);

  return {
    originalText: text,
    cleanedText,
    noise,
    anchors,
    locationLinks,
    placeIdentities,
    features,
    experiences,
    priorities,
    conditions
  };
}
