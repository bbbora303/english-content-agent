import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import previewUnderstand from './assets/preview-understand.png';
import previewRoleplayA from './assets/preview-roleplay-a.png';
import previewRoleplayBLook from './assets/preview-roleplay-b-look.png';
import previewRoleplayBThink from './assets/preview-roleplay-b-think.png';
import previewRoleplayCLook from './assets/preview-roleplay-c-look.png';
import previewRoleplayCThink from './assets/preview-roleplay-c-think.png';

// 💡 [1단계 유형 미리보기 팝업] contentType별 대표 예시 이미지.
// "이 유형은 일반적으로 이렇게 생겼다"는 고정 참고자료이며, 업로드한 특정 페이지의 실제 결과가 아님.
// 💡 유형별 대표 예시 이미지. roleplay_a/roleplay_b/roleplay_c는 제목에 따라 표시 이름이
// 더 세분화되므로(Talk and Complete / Look and Talk / Think and Talk 등), 이미지도 그 세분화에
// 맞춰 여러 장을 매핑할 수 있게 준비해둔다. 아직 확보되지 않은 변형(예: roleplay_c 전체,
// roleplay_b의 Look and Talk 변형)은 null로 두고, 미리보기 팝업에서 "준비 중" 안내로 대체한다.
const TYPE_PREVIEW_IMAGES = {
  understand: { default: previewUnderstand },
  roleplay_a: { default: previewRoleplayA },
  roleplay_b: { lookAndTalk: previewRoleplayBLook, thinkAndTalk: previewRoleplayBThink, default: previewRoleplayBThink },
  roleplay_c: { lookAndTalk: previewRoleplayCLook, thinkAndTalk: previewRoleplayCThink, default: previewRoleplayCLook },
};

function getPreviewImageSrc(contentType, title) {
  const bucket = TYPE_PREVIEW_IMAGES[contentType];
  if (!bucket) return null;
  const t = String(title || '').toLowerCase();
  // 💡 제목이 특정 변형(Look and Talk / Think and Talk)과 일치하는데 그 변형 전용 이미지가
  // 없으면, 다른 변형 이미지로 잘못 대체하지 않고 null을 반환해 "준비 중"으로 표시한다.
  if (t.includes('look and talk')) return bucket.lookAndTalk || null;
  if (t.includes('think and talk')) return bucket.thinkAndTalk || null;
  return bucket.default || null;
}

// 💡 [유형 표시 이름] contentType은 내부 코드 분기용 값이고, 사용자에게 보여주는 이름은
// AI가 추출한 실제 제목 텍스트(title)를 함께 봐서 결정한다. roleplay_a/roleplay_c 분기는
// 이미 제목 키워드로 나뉜 상태이므로(analyzeImageWithAI의 parsedType 결정 로직 참고),
// 여기서는 그 결과에 맞는 표시 문구만 고른다. 제목이 알려진 키워드와 매칭 안 되면
// 추출된 원본 제목을 그대로 보여준다(사용자 확정 결정).
function getDisplayTypeName(contentType, title) {
  const t = String(title || '').toLowerCase();
  if (contentType === 'understand') return 'Understand';
  if (contentType === 'roleplay_a') {
    if (t.includes('talk and complete')) return 'Talk and Complete';
    return String(title || 'Talk and Complete');
  }
  if (contentType === 'roleplay_c') {
    if (t.includes('look and talk')) return 'Look and Talk - 2';
    if (t.includes('think and talk')) return 'Think and Talk - 2';
    return String(title || '');
  }
  if (contentType === 'roleplay_b') {
    if (t.includes('look and talk')) return 'Look and Talk - 1';
    if (t.includes('think and talk')) return 'Think and Talk - 1';
    return String(title || '');
  }
  return String(title || '');
}

// --- [IndexedDB 템플릿 저장 로직] ---
const DB_NAME = 'ContentBuilderDB_V6';
const STORE_NAME = 'templates';
 
function getIDB() {
  try {
    return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  } catch (e) {
    return null;
  }
}
 
function openDB() {
  return new Promise((resolve, reject) => {
    const idb = getIDB();
    if (!idb) return reject(new Error("이 환경에서는 브라우저 저장소를 지원하지 않습니다."));
    
    try {
      const request = idb.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
          e.target.result.createObjectStore(STORE_NAME, { keyPath: 'type' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}
 
async function saveTemplateDB(type, name, blob) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ type, name, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("DB 저장 실패:", e);
  }
}
 
async function loadAllTemplatesDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("DB 로드 실패:", e);
    return [];
  }
}
 
async function deleteTemplateDB(type) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(type);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("DB 삭제 실패:", e);
  }
}
 
// 💡 [동결] 언더스탠드 기본 템플릿 모형
const TEMPLATE_UNDERSTAND = [
  { view: "01", bubble: { width: 510, x: 190, y: 140, tail_dir: "bottom", tail_pos: 40, tail_tip: "right", bg_color: "#FFE5ED", border_color: "#E3C1CB" }, text: { type: "inline", eng: [{ sentence: "Hi, I'm Lisa.", kor: "안녕하세요, 저는 Lisa입니다.", audio_id: "L2_039_Bridge_A_1" }, { sentence: "I live in the Netherlands.", kor: "저는 네덜란드에 살아요.", audio_id: "L2_039_Bridge_A_2" }] } },
  { view: "02", bubble: { width: 433, x: 250, y: 120, tail_dir: "bottom", tail_pos: 55, tail_tip: "right", bg_color: "#FFFFFF", border_color: "#CCD0D6" }, text: { type: "lines", eng: [{ lines: [{ en: "I stay healthy because I", ko: "저는 항상 자전거를 타고 학교에 가기 때문에" }, { en: "always ride a bike to school.", ko: "건강하게 지내요." }], audio_id: "L2_039_Bridge_A_3" }] } },
  { view: "03", bubble: { width: 470, x: 268, y: 125, tail_dir: "bottom", tail_pos: 95, tail_tip: "right", bg_color: "#FFFFFF", border_color: "#CCD0D6" }, text: { type: "zipper", eng: [{ sentence: "Hi, I'm Julian from Greece.<br>", kor: "안녕하세요, 저는 그리스에 사는 Julian입니다.<br>", audio_id: "L2_039_Bridge_A_4" }, { sentence: "I'm 90 years old, and I'm healthy.", kor: "저는 90세이고, 건강합니다.", audio_id: "L2_039_Bridge_A_5" }] } },
  { view: "04", bubble: { width: 590, x: 190, y: 150, tail_dir: "bottom", tail_pos: 95, tail_tip: "right", bg_color: "#FFFAE2", border_color: "#C6BDA7" }, text: { type: "inline", eng: [{ sentence: "I eat healthy food with olive oil every day.", kor: "저는 올리브 오일을 곁들인 건강에 좋은 음식을 매일 먹습니다.", audio_id: "L2_039_Bridge_A_6" }] } }
];
 
// 💡 롤플레이 (A) 단일 뷰 초기 데이터 구조
const INIT_ROLEPLAY_DATA = {
  view: "01",
  type: "A",
  dialogues: [
    { speaker: "A", lines: [{ sentence: "Hello.", kor: "안녕.", audio_id: "", hasBlank: false, muteTargets: "0" }] }
  ],
  tableQuiz: {
    headers: [
      { text: "Name", audioId: "L1_012_CommB_01" },
      { text: "Activity", audioId: "L1_012_CommB_02" },
      { text: "How often?", audioId: "L1_012_CommB_03" }
    ],
    staticRow: [
      { text: "Minho", audioId: "" },
      { text: "playing basketball", audioId: "" },
      { text: "every day", audioId: "" }
    ],
    rowCount: 3
  }
};

// 💡 [표 퀴즈 열 너비 자동 계산] 마스터 템플릿(view01.js)의 autoSizeCustomTableColumns()와
// 동일한 알고리즘을 캔버스 미리보기에 포팅. 헤더/정적 예시 행(첫 번째 데이터 행) 텍스트 중
// 그 열에서 가장 긴 텍스트를 기준으로 폭을 정하고, 최소/최대 폭으로 clamp한 뒤 표 전체 폭에
// 맞게 비율대로 재분배한다. (마스터 JS는 실제 렌더링된 DOM을 scrollWidth로 측정한 뒤
// window.viewport.scale로 나눠 논리적 픽셀로 보정하지만, 여기서는 canvas 2D의 measureText로
// 직접 논리적 폭을 계산하므로 scale 보정이 필요 없다.)
const TABLE_QUIZ_MIN_COL_WIDTH = 60;
const TABLE_QUIZ_MAX_COL_WIDTH = 260;
const TABLE_QUIZ_CELL_PADDING = 24;
const TABLE_QUIZ_TOTAL_WIDTH = 530;
const TABLE_QUIZ_HEADER_FONT = '25px sans-serif';
const TABLE_QUIZ_STATIC_ROW_FONT = 'bold 22px sans-serif';

let __tableQuizMeasureCanvas = null;
function measureTextWidthPx(text, font) {
  if (!__tableQuizMeasureCanvas) __tableQuizMeasureCanvas = document.createElement('canvas');
  const ctx = __tableQuizMeasureCanvas.getContext('2d');
  ctx.font = font;
  return ctx.measureText(text || '').width;
}

function computeTableQuizColWidths(headers, staticRow) {
  const colCount = (headers || []).length;
  if (colCount === 0) return [];
  const naturalWidths = headers.map((h, i) => {
    const headerText = h?.text || '';
    const staticCol = staticRow?.[i];
    const staticText = typeof staticCol === 'string' ? staticCol : (staticCol?.text || '');
    const headerW = measureTextWidthPx(headerText, TABLE_QUIZ_HEADER_FONT);
    const staticW = measureTextWidthPx(staticText, TABLE_QUIZ_STATIC_ROW_FONT);
    return Math.max(headerW, staticW) + TABLE_QUIZ_CELL_PADDING;
  });
  const clampedWidths = naturalWidths.map(w => Math.min(TABLE_QUIZ_MAX_COL_WIDTH, Math.max(TABLE_QUIZ_MIN_COL_WIDTH, w)));
  const totalClamped = clampedWidths.reduce((a, b) => a + b, 0) || 1;
  return clampedWidths.map(w => (w / totalClamped) * TABLE_QUIZ_TOTAL_WIDTH);
}

// 💡 [zipper 실측 분리 로직 공용화] 문장이 컨테이너 폭에 걸려 여러 줄로 꺾일 때, 그 줄 너비만큼만
// 텍스트를 잘라서 "첫 줄"과 "나머지"로 나눈다. Understand의 placeZipperKorean() 포팅 코드와 동일한
// 원리(숨겨진 probe 요소에 실제로 렌더링해보고 Range.getClientRects()로 줄바꿈 지점을 실측)이며,
// 롤플레이 A형의 여러 줄(lines) 한글 배치에서도 재사용하기 위해 폰트 파라미터를 받는 공용 함수로 분리했다.
function splitTextForRowWidth(text, widthPx, fontFamily, fontSizePx, lineHeight, wordBreak) {
  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.width = `${widthPx}px`;
  probe.style.whiteSpace = 'normal';
  probe.style.fontFamily = fontFamily;
  probe.style.fontSize = `${fontSizePx}px`;
  probe.style.lineHeight = String(lineHeight);
  probe.style.wordBreak = wordBreak;
  probe.textContent = text;
  document.body.appendChild(probe);

  let result = { firstLine: text, rest: '' };
  const textNode = probe.firstChild;
  if (textNode && textNode.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    range.selectNodeContents(probe);
    const rects = range.getClientRects();
    if (rects.length > 1) {
      const firstTop = rects[0].top;
      const threshold = rects[0].height / 2;
      let splitIndex = -1;
      for (let i = 1; i <= text.length; i++) {
        const r = document.createRange();
        r.setStart(textNode, i - 1);
        r.setEnd(textNode, i);
        const cr = r.getClientRects()[0];
        if (cr && cr.top > firstTop + threshold) { splitIndex = i - 1; break; }
      }
      if (splitIndex > 0) {
        const firstLine = text.slice(0, splitIndex).replace(/\s+$/, '');
        const rest = text.slice(splitIndex).replace(/^\s+/, '');
        if (firstLine) result = { firstLine, rest };
      }
    }
  }
  probe.remove();
  return result;
}

// 💡 [강조 표현 색상] 마스터 템플릿(view01.css)에 이미 정의된 3색만 사용한다 — 임의의 색상을 허용하면
// 마스터 템플릿 CSS(.emp.col-N)가 모르는 색이라 ZIP 병합 결과에서 아예 반영되지 않는다 (2-27 참고).
const EMP_COLORS = [
  { cls: 'col-0', label: '빨강', hex: '#b42c13' },
  { cls: 'col-1', label: '파랑', hex: '#018f9e' },
  { cls: 'col-2', label: '분홍', hex: '#e0629d' },
];

// 💡 [강조 표현 UI 공용 로직] textarea에서 사용자가 마우스로 선택한 구간을
// <span class='emp col-N'>...</span>로 감싼다. 원본 텍스트에 raw HTML을 직접 타이핑하지 않아도
// 되게 하는 것이 목적 — roleplay(A형)·roleplay_b(B형) 양쪽에서 공용으로 쓴다.
function wrapSelectionWithEmpColor(currentValue, start, end, colorCls) {
  if (start == null || end == null || start === end) return null;
  const text = currentValue || '';
  return text.slice(0, start) + `<span class='emp ${colorCls}'>` + text.slice(start, end) + `</span>` + text.slice(end);
}

// 💡 [롤플레이 A형 빈칸 지정 전용] 마스터 템플릿(view01.html)의 buildRolePlay()는 hasBlank인 줄의
// eng 텍스트에서 정규식 `\[(.*?)\]`로 대괄호 구간을 찾아, 빈칸 모드에서는 투명색으로, 정답 모드에서는
// emp col-N 강조로 자동 변환한다 — 즉 이 대괄호 문법 자체가 "빈칸 지정"의 유일한 트리거다(2-28 이전
// 방식). emp span을 직접 끼워넣는 wrapSelectionWithEmpColor와는 별개 함수로 분리해서, 사용자가
// 텍스트를 선택해 버튼만 누르면 raw `[ ]`를 타이핑하지 않고도 빈칸 구간을 지정할 수 있게 한다.
function wrapSelectionWithBracket(currentValue, start, end) {
  if (start == null || end == null || start === end) return null;
  const text = currentValue || '';
  if (text.slice(start, end).includes('[') || text.slice(start, end).includes(']')) return null;
  return text.slice(0, start) + '[' + text.slice(start, end) + ']' + text.slice(end);
}

// 💡 [빈칸 강조색 미리보기 전용] 실제 export 데이터(line.sentence)에는 대괄호(`[ ]`)만 남기고,
// 색상은 별도 필드(line.blankColor, 0~2)로 관리한다 — 마스터 템플릿이 그 색상 인덱스를 읽어
// `emp col-N`을 적용하도록 마스터 템플릿 쪽에 별도 작업 요청을 함(작업 프롬프트 참고). 저작 도구
// 캔버스에서는 마스터의 "정답 모드" 렌더링과 동일하게 보이도록, 대괄호 구간을 미리보기용으로만
// emp span으로 감싸서 화면에 표시한다(대괄호 문자 자체는 화면에 안 보이고 색만 보임).
function renderBracketAsEmpPreview(text, blankColor) {
  if (!text) return text;
  const colorCls = `col-${Number.isInteger(blankColor) ? blankColor : 0}`;
  return text.replace(/\[(.*?)\]/g, (match, inner) => `<span class='emp ${colorCls}'>${inner}</span>`);
}

// 💡 롤플레이 (B형) 씬 기반 초기 데이터 모형 (표 퀴즈 없음)
const INIT_ROLEPLAY_B_SCENES = [
  {
    type: "B",
    sceneId: 0,
    rolePlayImage: "RolePlay_img_0.png",
    rolePlayImageSrc: "",
    panelBtnImage: "RolePlay_img_mini_0001.png",
    panelBtnImageSrc: "",
    panelBtnLabel: "클릭 시 첫 번째 상황의 대화를 볼 수 있습니다.",
    roleA: "A",
    roleB: "B",
    dialogues: [
      { speaker: "A", sentence: "I’m feeling <span class='emp col-2'>under the weather</span>.", kor: "몸이 좀 안 좋아.", audio_id: "L3_001_CommB_eg_01" }
    ]
  },
  {
    type: "B",
    sceneId: 1,
    rolePlayImage: "RolePlay_img_1.png",
    rolePlayImageSrc: "",
    panelBtnImage: "RolePlay_img_mini_0002.png",
    panelBtnImageSrc: "",
    panelBtnLabel: "클릭 시 두 번째 상황의 대화를 볼 수 있습니다.",
    roleA: "A",
    roleB: "B",
    dialogues: [
      { speaker: "A", sentence: "Look at that backpack. It looks really cool!", kor: "저 배낭 좀 봐. 정말 멋지다!", audio_id: "L3_002_CommB_eg_01" }
    ]
  },
  {
    type: "B",
    sceneId: 2,
    rolePlayImage: "RolePlay_img_2.png",
    rolePlayImageSrc: "",
    panelBtnImage: "RolePlay_img_mini_0003.png",
    panelBtnImageSrc: "",
    panelBtnLabel: "클릭 시 세 번째 상황의 대화를 볼 수 있습니다.",
    roleA: "A",
    roleB: "B",
    dialogues: [
      { speaker: "A", sentence: "Look at this cap. I think it’ll look good on you.", kor: "이 모자 좀 봐. 너한테 잘 어울릴 것 같아.", audio_id: "L3_003_CommB_eg_01" }
    ]
  },
  {
    type: "B",
    sceneId: 3,
    rolePlayImage: "RolePlay_img_3.png",
    rolePlayImageSrc: "",
    panelBtnImage: "RolePlay_img_mini_0004.png",
    panelBtnImageSrc: "",
    panelBtnLabel: "클릭 시 네 번째 상황의 대화를 볼 수 있습니다.",
    roleA: "A",
    roleB: "B",
    dialogues: [
      { speaker: "A", sentence: "I'm so thirsty.", kor: "목이 너무 말라.", audio_id: "L3_004_CommB_eg_01" }
    ]
  }
];

// 💡 [롤플레이 C형 — 실제 마스터 템플릿(view01.js/html) 확인 결과] 표 퀴즈 대신, 화면 하단
// 좌우 화살표+점(dots)으로 넘겨보는 여러 "페이지"(대화 갈래, 예: Yes/No 분기)를 갖는 구조임이
// 확인됨(`contentData.rolePlay.pages` 배열, 페이지마다 완결된 전체 대사 세트). 대사 자체의
// 턴/줄 구조는 A형과 동일해서 각 페이지는 INIT_ROLEPLAY_DATA.dialogues와 같은 형태를 쓴다.
const INIT_ROLEPLAY_C_PAGES = [
  {
    pageId: 0,
    dialogues: [
      { speaker: "A", lines: [{ sentence: "Have you heard about the new movie?", kor: "새로 나온 영화에 대해 들어봤어?", audio_id: "", hasBlank: false, muteTargets: "0" }] },
      { speaker: "B", lines: [{ sentence: "Yes, I have. I heard it has a great story.", kor: "응, 들었어. 이야기가 멋지다고 들었어.", audio_id: "", hasBlank: false, muteTargets: "0" }] },
      { speaker: "A", lines: [{ sentence: "Let's watch it together.", kor: "함께 보러 가자.", audio_id: "", hasBlank: false, muteTargets: "0" }] },
      { speaker: "B", lines: [{ sentence: "Sounds good! I'm looking forward to it.", kor: "좋아! 기대된다.", audio_id: "", hasBlank: false, muteTargets: "0" }] }
    ]
  },
  {
    pageId: 1,
    dialogues: [
      { speaker: "A", lines: [{ sentence: "Have you heard about the new movie?", kor: "새로 나온 영화에 대해 들어봤어?", audio_id: "", hasBlank: false, muteTargets: "0" }] },
      { speaker: "B", lines: [{ sentence: "No, I haven't.", kor: "아니, 못 들었어.", audio_id: "", hasBlank: false, muteTargets: "0" }] },
      { speaker: "A", lines: [{ sentence: "I heard it has a great story. I'm looking forward to it.", kor: "이야기가 멋지다고 들었어. 기대된다.", audio_id: "", hasBlank: false, muteTargets: "0" }] },
      { speaker: "B", lines: [{ sentence: "Sounds good! Let's watch it together.", kor: "좋아! 함께 보러 가자.", audio_id: "", hasBlank: false, muteTargets: "0" }] }
    ]
  }
];

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [templates, setTemplates] = useState({ understand: null, roleplay_a: null, roleplay_b: null, roleplay_c: null });
 
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [contentType, setContentType] = useState('understand');
  const [showTypePreview, setShowTypePreview] = useState(false);

  const [croppedViews, setCroppedViews] = useState([]);
  const [extractedDialogues, setExtractedDialogues] = useState([]);
  const [extractedTableQuiz, setExtractedTableQuiz] = useState(null);
  // 💡 [롤플레이 B 전용] 다중 씬 인식 결과 — 각 항목이 { src: "", dialogues: 그 씬의 대사 배열 }.
  // 씬 이미지(src)는 교과서 원본에서 자동으로 잘라내지 않고 항상 빈 값으로 둔다 — 콘텐츠 이미지가
  // 교과서 지면에 없는 경우도 많아 사용자가 직접 업로드하는 방식으로 결정됨(handleSceneImageUpload).
  // AI가 장면을 여러 개로 나눠 인식하지 못했을 때(단일 뷰)는 빈 배열로 두고 extractedDialogues로 폴백한다.
  const [extractedScenesB, setExtractedScenesB] = useState([]);
  // 💡 [롤플레이 C 전용] 화살표 분기 대화(8-1번 지시) 인식 결과 — AI가 갈래를 2개 이상의 views로
  // 나눠 인식했을 때, 각 항목이 { dialogues: 그 갈래의 대사 배열(turn/lines 형태) }. 갈래를 못
  // 나눴을 때(단일 view)는 빈 배열로 두고 extractedDialogues(단일 flat 목록)로 폴백한다.
  const [extractedPagesC, setExtractedPagesC] = useState([]);
  // 💡 [롤플레이 B 전용] AI가 추출한 '교체 표현 영역'(tips) — 페이지(지면)당 1묶음이라
  // 씬별로 나누지 않고 별도 상태로 두고, 편집 패널이 직접 읽어 읽기 전용으로 보여준다.
  // view 자동 전개(단일 슬롯형)는 추출 프롬프트가 이미 끝내두므로 여기서 추가로 조합하지 않는다.
  const [extractedTips, setExtractedTips] = useState([]);
 
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
 
  const [activeViewIdx, setActiveViewIdx] = useState(0);
  const [pageData, setPageData] = useState([]);
  
  const [activeTab, setActiveTab] = useState('view');
 
  const [globalData, setGlobalData] = useState({
    header: { letter: "B", text: "Talk and Complete", instruction: "평소 즐겨 하는 여가 활동에 대해 친구와 이야기한 후, 표를 완성해 봅시다.", color: "4", btn_aria_label: "영상 보기" },
    video_file_name: "",
    video_aria_label: "",
    more_content: { has_content: false, content_text: "" }
  });
 
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const [draggingBoxId, setDraggingBoxId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
 
  const [toastMsg, setToastMsg] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const zipperFlowRef = useRef(null);
  const [zipperKorFragments, setZipperKorFragments] = useState([]);
  // 💡 [롤플레이 A형] 한 턴 안 여러 줄(lines)의 한글을, zipper와 동일한 원리로 각 줄이 실제로
  // 렌더링된 위치(offsetLeft/Top)를 실측해서 그 줄 바로 아래에 절대위치로 배치하기 위한 참조/상태.
  const rolePlayScriptRef = useRef(null);
  const [roleplayKorFragments, setRoleplayKorFragments] = useState([]);
  // 💡 [롤플레이 C형 — A형 ref/state를 그대로 복제] 캔버스 렌더링·한글 배치는 A형과 물리적으로
  // 분리된 별도 블록을 쓰므로, DOM 참조와 실측 결과도 A형과 공유하지 않고 따로 둔다.
  const rolePlayScriptRefC = useRef(null);
  const [roleplayCKorFragments, setRoleplayCKorFragments] = useState([]);

  // 💡 [롤플레이 B 전용 구역] 마스터 템플릿(view01.js/css) 확인 결과, B형은 A형과 달리 실측
  // 기반 절대배치가 아니라 .sentence-group(flex-column) 구조로 영어 문장 바로 아래에 한글이
  // 자연스럽게 흐른다 — 별도의 측정 로직이 필요 없다(아래 JSX에서 직접 flex-column으로 렌더).

  // 💡 [강조 표현 색상 버튼] "텍스트 선택 → 색상 버튼 클릭"으로 <span class='emp col-N'>를 감싸기
  // 위해, 각 대사 textarea DOM 요소를 dialIdx(B형) / `${dialIdx}-${lineIdx}`(A형) 키로 보관한다.
  // React state가 아니라 ref로 두는 이유: 이 값은 렌더링에 영향을 주지 않고(버튼 클릭 시점에만
  // selectionStart/End를 읽음) 리렌더마다 새로 만들 필요가 없기 때문.
  const dialogueBSentenceRefs = useRef({});
  const dialogueLineSentenceRefs = useRef({});

  const applyEmpColorToSelection = (textareaEl, currentValue, colorCls, onChange) => {
    if (!textareaEl) return;
    const wrapped = wrapSelectionWithEmpColor(currentValue, textareaEl.selectionStart, textareaEl.selectionEnd, colorCls);
    if (wrapped == null) {
      showToast('강조할 부분을 먼저 마우스로 선택해주세요.');
      return;
    }
    onChange(wrapped);
  };

  // 💡 [롤플레이 A형 전용] 텍스트 선택 → 버튼 클릭으로 빈칸(대괄호) 구간을 지정한다.
  const applyBracketToSelection = (textareaEl, currentValue, onChange) => {
    if (!textareaEl) return;
    const start = textareaEl.selectionStart;
    const end = textareaEl.selectionEnd;
    if (start == null || end == null || start === end) {
      showToast('빈칸으로 지정할 부분을 먼저 마우스로 선택해주세요.');
      return;
    }
    const wrapped = wrapSelectionWithBracket(currentValue, start, end);
    if (wrapped == null) {
      showToast('선택한 구간에 이미 대괄호가 포함되어 있어요. 대괄호가 겹치지 않게 선택해주세요.');
      return;
    }
    onChange(wrapped);
  };

  const loadJSZip = () => {
    return new Promise((resolve, reject) => {
      if (window.JSZip) {
        resolve();
      } else {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      }
    });
  };
 
  const showToast = (msg) => { 
    setToastMsg(msg); 
    setTimeout(() => setToastMsg(null), 3000); 
  };
 
  useEffect(() => {
    loadAllTemplatesDB().then(savedData => {
      const loadedTemplates = { understand: null, roleplay_a: null, roleplay_b: null, roleplay_c: null };

      // 기획 롤백 복구를 위해 가이드 ZIP 디폴트 객체 매핑 안정적 보존
      loadedTemplates.understand = { name: "Understand_Default.zip", blob: new Blob() };
      loadedTemplates.roleplay_a = { name: "Roleplay_A_Default.zip", blob: new Blob() };
      loadedTemplates.roleplay_b = { name: "Roleplay_B_Default.zip", blob: new Blob() };
      loadedTemplates.roleplay_c = { name: "Roleplay_C_Default.zip", blob: new Blob() };
 
      if (savedData && savedData.length > 0) {
        savedData.forEach(item => {
          loadedTemplates[item.type] = { name: item.name, blob: item.blob };
        });
      }
      setTemplates(loadedTemplates);
    }).catch(e => console.log("DB Loading ignored:", e));
  }, []);
 
  // 💡 앱 진입 시 프록시 서버(server/index.js) 연결 상태를 미리 확인합니다.
  // 이미지 업로드 전에 서버가 꺼져있다는 걸 바로 알 수 있게 해줍니다.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then(res => {
        if (!cancelled) setServerStatus(res.ok ? 'online' : 'offline');
      })
      .catch(() => {
        if (!cancelled) setServerStatus('offline');
      });
    return () => { cancelled = true; };
  }, []);
 
  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current && currentPage === 2 && !isAdminMode) {
        const { width, height } = wrapperRef.current.getBoundingClientRect();
        const scaleX = (width - 40) / 1280;
        const scaleY = (height - 40) / 720;
        setScale(Math.min(scaleX, scaleY, 1));
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentPage, activeViewIdx, isAdminMode]);
 
  const cropImage = (imgSrc, xPct, yPct, wPct, hPct) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const startX = img.width * (xPct / 100);
        const startY = img.height * (yPct / 100);
        const cropW = img.width * (wPct / 100);
        const cropH = img.height * (hPct / 100);
        canvas.width = cropW; canvas.height = cropH;
        ctx.drawImage(img, startX, startY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imgSrc;
    });
  };
 
  // 💡 상대경로로 변경: 로컬 개발 땐 vite.config.js의 server.proxy 설정을 통해
  // localhost:3001(Express 서버)로 전달되고, Vercel 배포 후에는 같은 도메인의
  // /api/analyze-image(서버리스 함수)로 자동으로 연결됩니다.
  const AI_PROXY_URL = '/api/analyze-image';
 
  const analyzeImageWithAI = async (base64Str, mimeType) => {
    setIsAnalyzing(true);
    try {
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: base64Str, mimeType })
      };
 
      let response;
      let lastErrorBody = null;
      let lastNetworkError = null;
      const delays = [1000, 2000, 4000, 8000, 16000];
      const maxAttempts = delays.length + 1; // 최초 시도 1회 + 재시도 5회
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          response = await fetch(AI_PROXY_URL, options);
          lastNetworkError = null;
          if (response.ok) break;
          lastErrorBody = await response.json().catch(() => ({}));
          if (attempt === maxAttempts - 1) throw new Error(lastErrorBody.error || response.statusText);
        } catch (err) {
          // fetch 자체가 실패한 경우(TypeError: Failed to fetch)는 서버가 꺼져있거나
          // 연결이 안 되는 상황이므로 원인을 구분할 수 있게 별도로 기록해둡니다.
          lastNetworkError = err;
          if (attempt === maxAttempts - 1) throw err;
        }
        await new Promise(res => setTimeout(res, delays[attempt]));
      }
 
      if (lastNetworkError) throw lastNetworkError;
      const aiData = await response.json();

      // 💡 AI는 여전히 'understand'/'roleplay'/'roleplay_b' 3종만 판정한다(분류 로직 자체는 불변).
      // 'roleplay'로 판정된 경우(=AI가 이미 "교체 표현 영역 없음"을 확정한 상태), 저작 도구가
      // 표 퀴즈(tableQuiz) 데이터 유무로 한 번 더 나눈다 — 있으면 roleplay_a(A형), 없으면
      // roleplay_c(C형). 제목 텍스트("Look and Talk" 등)는 더 이상 분류 기준이 아니고, 화면에
      // 보여줄 이름(getDisplayTypeName)을 고르는 용도로만 쓴다.
      //
      // 우선순위 확정(사용자 결정): 1순위 = 표 퀴즈 유무(있으면 A), 2순위 = 교체 표현 영역(Tips)
      // 유무(없으면 C, 있으면 B). 단, 이 순서가 안전하려면 "표 퀴즈와 Tips 박스가 한 지면에
      // 동시에 존재하지 않는다"는 도메인 전제가 필요하다 — 현재 AI 프롬프트는 tips가 감지되면
      // (roleplay_b 경로) 그 경로에서 표 퀴즈를 아예 추출 시도하지 않으므로, 만약 실제로 두 요소가
      // 공존하는 지면이 나오면 표 퀴즈 데이터를 못 받아 이 우선순위를 적용할 수 없다. 사용자가
      // "그럴 일은 없다"고 확인했으므로 지금은 이 전제 하에 그대로 둔다 — 실제로 그런 지면이
      // 나오면 lib/analyzePrompt.js의 B형 추출 지시문(9번)에 표 퀴즈 체크를 추가해야 한다.
      const rawType = aiData.contentType === 'roleplay_b' ? 'roleplay_b' : (aiData.contentType === 'roleplay' ? 'roleplay' : 'understand');
      let parsedType = rawType;
      if (rawType === 'roleplay') {
        const hasTableQuiz = !!(aiData.tableQuiz && Array.isArray(aiData.tableQuiz.headers) && aiData.tableQuiz.headers.length > 0);
        parsedType = hasTableQuiz ? 'roleplay_a' : 'roleplay_c';
      }
      setContentType(parsedType);
 
      if (aiData.instruction || aiData.title || aiData.letter) {
         setGlobalData(prev => ({
             ...prev,
             header: { 
                 ...prev.header, 
                 instruction: aiData.instruction || prev.header.instruction,
                 text: aiData.title || prev.header.text,
                 letter: aiData.letter || prev.header.letter
             }
         }));
      }
 
      if (parsedType === 'roleplay_a') {
          // 💡 [A형 — 기존 로직 그대로 유지] 컷 구분 없는 단일 뷰 대화 추출.
          let dials = [];
          if (aiData.views && aiData.views[0] && aiData.views[0].eng) {
              dials = (aiData.views[0].eng || []).map((item, idx) => ({
                  speaker: item.speaker || (idx % 2 === 0 ? "A" : "B"),
                  sentence: item.sentence || item.en || "",
                  kor: item.kor || item.ko || "",
                  audio_id: "",
                  hasBlank: false,
                  muteTargets: "0"
              }));
          }
          if (dials.length === 0) dials = INIT_ROLEPLAY_DATA.dialogues;
          setExtractedDialogues(dials);
          setExtractedScenesB([]);
          setExtractedPagesC([]);
          setExtractedTips([]); // A형은 교체 표현 영역(tips) 개념이 없음

          // 💡 이미지에 표 퀴즈가 함께 있으면 헤더/고정 행 텍스트도 같이 읽어온다. 오디오 ID는
          // 이미지만으로 알 수 없어 항상 빈 값으로 두고(사용자가 직접 입력), rowCount(학생이 채울
          // 빈칸 행 개수)도 이미지에서 신뢰성 있게 추론하기 어려워 건드리지 않는다(기본값 3 유지).
          if (aiData.tableQuiz && Array.isArray(aiData.tableQuiz.headers) && aiData.tableQuiz.headers.length > 0) {
              const extractedHeaders = aiData.tableQuiz.headers.map(h => ({ text: String(h || ''), audioId: '' }));
              const extractedStaticRow = extractedHeaders.map((_, i) => ({ text: String((aiData.tableQuiz.staticRow || [])[i] || ''), audioId: '' }));
              setExtractedTableQuiz({ headers: extractedHeaders, staticRow: extractedStaticRow });
          } else {
              setExtractedTableQuiz(null);
          }
      } else if (parsedType === 'roleplay_c') {
          // 💡 [C형] AI가 화살표 분기(8-1번 지시)를 인식하면 갈래 개수만큼 views를 나눠서 돌려준다 —
          // 이 경우 views.length > 1이며, 각 view는 "공통 대사부터 그 갈래 끝까지" 전부 담은 완결된
          // 대화다. views가 1개뿐이면(분기 없는 일반 A형류 지면) 기존처럼 flat 목록 하나로 취급하고,
          // startEditing()에서 1번 페이지로 쓰고 2번 페이지는 복제해서 채운다.
          // parsedType이 'roleplay_c'가 됐다는 것 자체가 이미 "aiData.tableQuiz 없음"을 뜻하므로
          // (분류 로직 참고), 표 퀴즈 추출은 시도하지 않는다 — C형에는 애초에 그 개념이 없다.
          const viewsArrayC = Array.isArray(aiData?.views) ? aiData.views : [];

          if (viewsArrayC.length > 1) {
              const pages = viewsArrayC.map((v) => ({
                  dialogues: (v.eng || []).map((item, idx) => ({
                      speaker: item.speaker || (idx % 2 === 0 ? "A" : "B"),
                      lines: [{ sentence: item.sentence || item.en || "", kor: item.kor || item.ko || "", audio_id: "", hasBlank: false, muteTargets: "0" }]
                  }))
              }));
              setExtractedPagesC(pages);
              setExtractedDialogues([]);
          } else {
              let dials = [];
              if (viewsArrayC[0] && viewsArrayC[0].eng) {
                  dials = (viewsArrayC[0].eng || []).map((item, idx) => ({
                      speaker: item.speaker || (idx % 2 === 0 ? "A" : "B"),
                      sentence: item.sentence || item.en || "",
                      kor: item.kor || item.ko || "",
                      audio_id: "",
                      hasBlank: false,
                      muteTargets: "0"
                  }));
              }
              setExtractedDialogues(dials);
              setExtractedPagesC([]);
          }
          setExtractedScenesB([]);
          setExtractedTips([]); // C형은 교체 표현 영역(tips) 개념이 없음
          setExtractedTableQuiz(null); // C형은 표 퀴즈 개념이 없음
      } else if (parsedType === 'roleplay_b') {
          // 💡 [B형 전용 구역] AI가 씬을 2개 이상으로 나눠 인식했으면 씬별 대사로 분리 매핑한다.
          // 씬 이미지는 교과서 지면에 실제 콘텐츠 이미지가 없는 경우도 많아(사용자 확인),
          // 더 이상 교과서 원본에서 자동으로 잘라내 채우지 않는다 — 항상 빈 틀로 두고
          // 사용자가 직접 업로드하게 한다(handleSceneImageUpload).
          // 💡 단일 슬롯형은 추출 프롬프트가 이미 tips 개수만큼 views를 전개해서 반환하므로,
          // 여기서는 그 views를 그대로 씬으로 매핑하기만 하면 된다(추가 전개 로직 불필요).
          // tips(교체 표현 후보)는 씬별이 아니라 페이지 전역이라 별도 상태(extractedTips)로 둔다.
          const viewsArray = Array.isArray(aiData?.views) ? aiData.views : [];
          setExtractedTips(Array.isArray(aiData?.tips) ? aiData.tips.map(String) : []);

          if (viewsArray.length > 1) {
              const scenes = viewsArray.map((v) => {
                  const dials = (v.eng || []).map((item, idx) => ({
                      speaker: item.speaker || (idx % 2 === 0 ? "A" : "B"),
                      sentence: item.sentence || item.en || "",
                      kor: item.kor || item.ko || "",
                      audio_id: ""
                  }));
                  return { src: "", dialogues: dials };
              });
              setExtractedScenesB(scenes);
              setExtractedDialogues([]);
              setExtractedPagesC([]);
          } else {
              let dials = [];
              if (viewsArray[0] && viewsArray[0].eng) {
                  dials = (viewsArray[0].eng || []).map((item, idx) => ({
                      speaker: item.speaker || (idx % 2 === 0 ? "A" : "B"),
                      sentence: item.sentence || item.en || "",
                      kor: item.kor || item.ko || "",
                      audio_id: ""
                  }));
              }
              if (dials.length === 0) dials = INIT_ROLEPLAY_B_SCENES[0].dialogues;
              setExtractedDialogues(dials);
              setExtractedScenesB([]);
              setExtractedPagesC([]);
          }
          setExtractedTableQuiz(null);
      } else {
          const processedViews = [];
          const viewsArray = Array.isArray(aiData?.views) ? aiData.views : (Array.isArray(aiData) ? aiData : []);
          for (let i = 0; i < (viewsArray.length || 0); i++) {
            const v = viewsArray[i] || {};
            const croppedDataUrl = await cropImage(base64Str, v.x_percent || 0, v.y_percent || 0, v.width_percent || 100, v.height_percent || 100);
            processedViews.push({ uniqueId: `img_${Date.now()}_${i}`, src: croppedDataUrl, originalInfo: v.originalInfo || `컷 ${i+1}`, inferredType: v.textType || 'inline', extractedEng: v.eng || [] });
          }
          if (processedViews.length === 0) {
              processedViews.push({ uniqueId: `img_${Date.now()}_fallback`, src: base64Str, originalInfo: "전체 화면 (자동 할당)", inferredType: 'inline', extractedEng: [] });
          }
          setCroppedViews(processedViews);
          setExtractedTips([]); // understand는 tips 개념이 없음
          setExtractedPagesC([]);
      }
      showToast("✨ AI 분석 완료!");
    } catch (error) {
      console.error('AI 분석 실패:', error);
      // "Failed to fetch"는 서버 응답 에러가 아니라 브라우저가 프록시 서버(3001)에
      // 아예 연결하지 못했다는 뜻입니다 (서버 미실행 / 잘못된 URL / 방화벽 등).
      const isNetworkError = error instanceof TypeError && /fetch/i.test(error.message || '');
      const friendlyMessage = isNetworkError
        ? `서버(${AI_PROXY_URL})에 연결할 수 없습니다. 로컬 개발 중이라면 터미널에서 서버가 켜져 있는지 확인하세요 (npm run server 또는 npm run dev:all).`
        : (error.message || '알 수 없는 오류');
      showToast(`⚠️ AI 분석 통신 불가: ${friendlyMessage} (이해형 기본 모형으로 대체)`);
      setContentType('understand');
      const fallbackViews = [];
      const mockTypes = ['inline', 'lines', 'zipper', 'inline'];
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * 50; const y = 20 + Math.floor(i / 2) * 35; 
        const croppedDataUrl = await cropImage(base64Str, x, y, 50, 35);
        fallbackViews.push({ uniqueId: `mock_${Date.now()}_${i}`, src: croppedDataUrl, originalInfo: `가상 컷 ${i+1}`, inferredType: mockTypes[i], extractedEng: [{ sentence: "This is a sample sentence.", kor: "가상 샘플 문장입니다.", audio_id: `L2_039_Bridge_${i+1}` }] });
      }
      setCroppedViews(fallbackViews);
      setExtractedTips([]);
      setExtractedPagesC([]);
    } finally {
      setIsAnalyzing(false);
    }
  };
 
  // 💡 [롤플레이 B 전용 구역] 대사 필드는 speaker/sentence/kor/audio_id로 통일한다.
  // (한때 편집 함수만 role/text[]/translation[]/audio[] 배열 구조를 썼던 불일치가 있었으나,
  // 초기 데이터·AI 매핑과 동일한 flat 구조로 맞춰 화면 표시/추출 시 값이 사라지는 문제를 없앴다.)
  const handleDialogueBChange = (dialIdx, field, value) => {
    if (contentType !== 'roleplay_b') return;
    setPageData(prev => prev.map((scene, sIdx) => {
      if (sIdx !== activeViewIdx) return scene;
      const updatedDialogues = [...(scene.dialogues || [])];
      updatedDialogues[dialIdx] = { ...updatedDialogues[dialIdx], [field]: value };
      return { ...scene, dialogues: updatedDialogues };
    }));
  };

  const handleSceneBPropChange = (field, value) => {
    if (contentType !== 'roleplay_b') return;
    setPageData(prev => prev.map((scene, sIdx) => {
      if (sIdx !== activeViewIdx) return scene;
      return { ...scene, [field]: value };
    }));
  };

  const addDialogueB = () => {
    if (contentType !== 'roleplay_b') return;
    setPageData(prev => prev.map((scene, sIdx) => {
      if (sIdx !== activeViewIdx) return scene;
      const targetSpeaker = (scene.dialogues || []).length % 2 === 0 ? "A" : "B";
      return {
        ...scene,
        dialogues: [...(scene.dialogues || []), { speaker: targetSpeaker, sentence: "", kor: "", audio_id: "" }]
      };
    }));
  };

  const handleDialogueBDelete = (dialIdx) => {
    if (contentType !== 'roleplay_b') return;
    setPageData(prev => prev.map((scene, sIdx) => {
      if (sIdx !== activeViewIdx) return scene;
      return { ...scene, dialogues: (scene.dialogues || []).filter((_, dIdx) => dIdx !== dialIdx) };
    }));
  };

  // 💡 씬 추가/삭제. 새 씬은 현재 씬 개수를 기준으로 sceneId/기본 리소스명을 채번한다.
  const addSceneB = () => {
    if (contentType !== 'roleplay_b') return;
    setPageData(prev => {
      const nextIdx = (prev || []).length;
      // 💡 B형은 "교체 후보(tips)만 씬별로 갈아끼우고 나머지 대사는 모든 씬이 동일"한 구조라,
      // 새 씬을 빈 대사로 시작하지 않고 씬 1의 대사를 그대로 복제해 넣는다 — 사용자는 그중
      // 교체 표현만 선택해서 바꿔 넣으면 된다(대사 전체를 새로 타이핑할 필요 없음).
      const baseDialogues = (prev && prev[0] && prev[0].dialogues && prev[0].dialogues.length > 0)
        ? prev[0].dialogues.map(d => ({ ...d }))
        : [{ speaker: "A", sentence: "", kor: "", audio_id: "" }];
      const newScene = {
        type: "B",
        sceneId: nextIdx,
        rolePlayImage: `RolePlay_img_${nextIdx}.png`,
        rolePlayImageSrc: "",
        panelBtnImage: `RolePlay_img_mini_000${nextIdx + 1}.png`,
        panelBtnLabel: `클릭 시 ${nextIdx + 1}번째 상황의 대화를 볼 수 있습니다.`,
        roleA: "A",
        roleB: "B",
        dialogues: baseDialogues,
        id: `scene_b_${Date.now()}_${nextIdx}`
      };
      const next = [...(prev || []), newScene];
      setActiveViewIdx(next.length - 1);
      return next;
    });
  };

  const deleteSceneB = (idx) => {
    if (contentType !== 'roleplay_b') return;
    setPageData(prev => {
      if ((prev || []).length <= 1) {
        showToast("⚠️ 최소 1개의 씬은 남아있어야 합니다.");
        return prev;
      }
      const next = (prev || []).filter((_, sIdx) => sIdx !== idx);
      setActiveViewIdx(current => Math.min(current, next.length - 1));
      return next;
    });
  };

  // 💡 [롤플레이 C형 전용] 표 퀴즈 대신 여러 "페이지"(대화 갈래, 예: Yes/No 분기)를 갖는다
  // (실제 마스터 템플릿 view01.js/html 확인 결과, contentData.rolePlay.pages 배열). 새 페이지는
  // 빈 대사가 아니라 현재 1번 페이지의 대사를 복제해서 시작한다 — B형 씬 복제 관례(2-32)와
  // 동일하게, 사용자가 매번 대사 전체를 새로 타이핑하지 않고 갈리는 부분만 고치게 하기 위함.
  const addPageC = () => {
    if (contentType !== 'roleplay_c') return;
    setPageData(prev => {
      const nextIdx = (prev || []).length;
      const baseDialogues = (prev && prev[0] && prev[0].dialogues && prev[0].dialogues.length > 0)
        ? JSON.parse(JSON.stringify(prev[0].dialogues))
        : JSON.parse(JSON.stringify(INIT_ROLEPLAY_C_PAGES[0].dialogues));
      const newPage = { pageId: nextIdx, dialogues: baseDialogues, id: `page_c_${Date.now()}_${nextIdx}` };
      const next = [...(prev || []), newPage];
      setActiveViewIdx(next.length - 1);
      return next;
    });
  };

  const deletePageC = (idx) => {
    if (contentType !== 'roleplay_c') return;
    setPageData(prev => {
      if ((prev || []).length <= 1) {
        showToast("⚠️ 최소 1개의 페이지는 남아있어야 합니다.");
        return prev;
      }
      const next = (prev || []).filter((_, pIdx) => pIdx !== idx);
      setActiveViewIdx(current => Math.min(current, next.length - 1));
      return next;
    });
  };
 
  // 💡 [Vercel 배포 대비] 서버리스 함수의 요청 본문 크기 제한(4.5MB)에 걸리지 않도록,
  // 업로드된 이미지를 전송 전에 canvas로 리사이즈·압축합니다. 긴 변 기준 1600px로 축소하고
  // JPEG 82% 품질로 저장하면, 웬만한 교과서 사진은 1~2MB 안팎으로 줄어듭니다.
  const resizeImageForUpload = (dataUrl, maxDimension = 1600, quality = 0.82) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          } else {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  };
 
  // 💡 [수정] 원본 파일이 이 기준(바이트)을 넘을 때만 리사이즈합니다.
  // base64로 변환하면 원본보다 약 1.37배 커지고, Vercel 요청 본문 한도가 4.5MB이므로
  // 안전 여유를 두고 3MB(=3 * 1024 * 1024)를 기준으로 잡았습니다.
  // (3MB 원본 → base64 약 4.1MB, JSON 포장 감안해도 4.5MB 안에 여유 있게 들어옵니다.)
  const RESIZE_THRESHOLD_BYTES = 3 * 1024 * 1024;
 
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        // 기준 이하 용량이면 리사이즈 없이 원본 그대로 사용
        if (file.size <= RESIZE_THRESHOLD_BYTES) {
          setUploadedImage(event.target.result);
          analyzeImageWithAI(event.target.result, file.type);
          return;
        }
        try {
          const resizedDataUrl = await resizeImageForUpload(event.target.result);
          setUploadedImage(resizedDataUrl);
          analyzeImageWithAI(resizedDataUrl, 'image/jpeg');
        } catch (err) {
          // 리사이즈 실패 시(드문 경우) 원본이라도 그대로 시도
          console.error('이미지 리사이즈 실패, 원본으로 진행:', err);
          setUploadedImage(event.target.result);
          analyzeImageWithAI(event.target.result, file.type);
        }
      };
      reader.readAsDataURL(file);
    }
  };
 
  const dragStart = (e, position) => { dragItem.current = position; };
  const dragEnter = (e, position) => { dragOverItem.current = position; };
  const drop = () => {
    const copyListItems = [...(croppedViews || [])];
    const dragItemContent = copyListItems[dragItem.current];
    copyListItems.splice(dragItem.current, 1);
    copyListItems.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = null; dragOverItem.current = null;
    setCroppedViews(copyListItems);
  };
 
  const deleteView = (indexToRemove) => setCroppedViews(prev => (prev || []).filter((_, idx) => idx !== indexToRemove));
  const addView = () => setCroppedViews(prev => [...(prev || []), { uniqueId: `img_${Date.now()}`, src: uploadedImage || '', originalInfo: `추가된 컷 ${(prev || []).length + 1}`, inferredType: 'inline', extractedEng: [] }]);
 
  const startEditing = () => {
    if (!templates[contentType]) {
      showToast(`⚠️ [관리자 모드]에서 '${contentType.toUpperCase()}' 원본 템플릿 ZIP 파일을 먼저 등록해주세요!`);
      return;
    }
 
    if (contentType === 'roleplay_b') {
      // 💡 다중 씬 추출(extractedScenesB)이 있으면 그걸로 씬 배열 전체(이미지 포함)를 구성한다 —
      // 이 경우는 AI가 이미 씬마다 다른 대사(단일 슬롯형 자동 전개)를 뽑아준 것이므로 그대로 쓴다.
      //
      // 없으면(다중 선택지형이라 view가 1개만 오거나, AI 분석을 안 거친 경우) 기본 더미 씬으로
      // 폴백하는데, 이때 씬들이 서로 다른 대사를 갖고 있으면 안 된다 — B형은 "교체 후보(tips)만
      // 씬별로 갈아끼우고 나머지 대사는 모든 씬이 동일"한 구조이므로, 씬 1의 대사(추출됐으면
      // extractedDialogues, 아니면 기본 예시)를 모든 씬에 똑같이 복제해 넣는다. 그래야 사용자가
      // 교체 후보(Tips) 블록을 참고해 씬마다 해당 단어/구만 선택 → 색상 버튼으로 바꿔치기하면
      // 되고, 대사 전체를 씬마다 새로 타이핑할 필요가 없다.
      const baseDialoguesForFallback = extractedDialogues.length > 0
        ? extractedDialogues.map(item => ({
            speaker: item.speaker || "A",
            sentence: item.sentence || "",
            kor: item.kor || "",
            audio_id: item.audio_id || ""
          }))
        : INIT_ROLEPLAY_B_SCENES[0].dialogues;
      const initialScenes = extractedScenesB.length > 0
        ? extractedScenesB.map((scene, idx) => ({
            type: "B",
            sceneId: idx,
            rolePlayImage: `RolePlay_img_${idx}.png`,
            rolePlayImageSrc: scene.src || "",
            panelBtnImage: `RolePlay_img_mini_000${idx + 1}.png`,
            panelBtnImageSrc: "",
            panelBtnLabel: `클릭 시 ${idx + 1}번째 상황의 대화를 볼 수 있습니다.`,
            roleA: "A",
            roleB: "B",
            dialogues: scene.dialogues.length > 0 ? scene.dialogues : [{ speaker: "A", sentence: "", kor: "", audio_id: "" }],
            id: `scene_b_${Date.now()}_${idx}`
          }))
        : INIT_ROLEPLAY_B_SCENES.map((scene, idx) => ({
            ...scene,
            id: `scene_b_${Date.now()}_${idx}`,
            dialogues: baseDialoguesForFallback.map(d => ({ ...d }))
          }));
      setPageData(initialScenes);
    } else if (contentType === 'roleplay_a') {
      // 💡 extractedDialogues는 A/B형이 공유하는 평평한 중간 포맷(1항목=1줄)이라, 롤플레이 A형이 쓰는
      // "턴 안에 여러 줄" 중첩 구조({ speaker, lines: [...] })로 감싸서 넣어준다.
      const initialDialogues = extractedDialogues.length > 0
        ? extractedDialogues.map(item => ({
            speaker: item.speaker || "A",
            lines: [{ sentence: item.sentence || "", kor: item.kor || "", audio_id: item.audio_id || "", hasBlank: item.hasBlank || false, muteTargets: item.muteTargets !== undefined ? item.muteTargets : "0" }]
          }))
        : INIT_ROLEPLAY_DATA.dialogues;
      // 💡 이미지에서 표 퀴즈 헤더/고정 행 텍스트를 읽어냈으면 그걸 쓰고, 못 읽었으면(표가 없거나
      // AI가 인식 못함) 기본 예시(INIT_ROLEPLAY_DATA.tableQuiz)로 채워서 편집 패널에서 바로 고칠 수 있게 한다.
      const initialTableQuiz = extractedTableQuiz
        ? { ...INIT_ROLEPLAY_DATA.tableQuiz, headers: extractedTableQuiz.headers, staticRow: extractedTableQuiz.staticRow }
        : INIT_ROLEPLAY_DATA.tableQuiz;
      setPageData([{ ...INIT_ROLEPLAY_DATA, dialogues: initialDialogues, tableQuiz: initialTableQuiz, id: `box_${Date.now()}_roleplay` }]);
    } else if (contentType === 'roleplay_c') {
      // 💡 [C형 — 실제 마스터 템플릿 구조] 표 퀴즈가 아니라 여러 "페이지"(대화 갈래) 배열이다.
      const now = Date.now();
      if (extractedPagesC.length > 0) {
        // 💡 AI가 화살표 분기(8-1번 지시)를 갈래별 views로 인식한 경우 — 각 view가 이미
        // "공통 대사 + 그 갈래 끝까지"를 전부 담은 완결된 대화라, 그대로 페이지로 매핑하면 된다.
        setPageData(extractedPagesC.map((page, idx) => ({
          pageId: idx,
          dialogues: page.dialogues,
          id: `page_c_${now}_${idx}`
        })));
      } else {
        // 💡 AI가 갈래를 구분하지 못했을 때(단일 flat 대사만 줌) — extractedDialogues를 1번
        // 페이지로 쓰고, 2번 페이지는 그 내용을 복제해서 시작한다(사용자가 두 번째 갈래로 고쳐
        // 쓰면 됨) — B형 addSceneB의 "씬 1 대사 복제" 관례(2-32)와 동일한 이유.
        const initialDialogues = extractedDialogues.length > 0
          ? extractedDialogues.map(item => ({
              speaker: item.speaker || "A",
              lines: [{ sentence: item.sentence || "", kor: item.kor || "", audio_id: item.audio_id || "", hasBlank: item.hasBlank || false, muteTargets: item.muteTargets !== undefined ? item.muteTargets : "0" }]
            }))
          : INIT_ROLEPLAY_C_PAGES[0].dialogues;
        setPageData([
          { pageId: 0, dialogues: initialDialogues, id: `page_c_${now}_0` },
          { pageId: 1, dialogues: JSON.parse(JSON.stringify(initialDialogues)), id: `page_c_${now}_1` }
        ]);
      }
    } else {
      const initialData = (croppedViews || []).map((crop, idx) => {
        const tpl = TEMPLATE_UNDERSTAND[idx] || {
          bubble: { width: 400, x: 400, y: 300, tail_dir: "bottom", tail_pos: 50, tail_tip: "right", bg_color: "#FFFFFF", border_color: "#000000" }
        };
        
        let adaptedText = { type: crop.inferredType, eng: JSON.parse(JSON.stringify(crop.extractedEng || [])) };
 
        if (adaptedText.eng && adaptedText.eng.length > 0) {
            if (adaptedText.type === 'lines') {
                if (!adaptedText.eng[0].lines) {
                    const linesArr = (adaptedText.eng || []).map(item => ({
                        en: item.sentence || item.en || item.eng || '',
                        ko: item.kor || item.ko || item.korean || ''
                    }));
                    adaptedText.eng = [{ lines: linesArr, audio_id: adaptedText.eng[0].audio_id || "" }];
                } else {
                    adaptedText.eng[0].lines = (adaptedText.eng[0].lines || []).map(line => ({
                        en: line.en || line.sentence || line.eng || '',
                        ko: line.ko || line.kor || line.korean || ''
                    }));
                }
            } else { 
                if (adaptedText.eng[0].lines) {
                    adaptedText.eng = (adaptedText.eng[0].lines || []).map((line, lIdx) => ({
                        sentence: line.en || line.sentence || line.eng || '',
                        kor: line.ko || line.kor || line.korean || '',
                        audio_id: lIdx === 0 ? (adaptedText.eng[0].audio_id || "") : ""
                    }));
                } else {
                    adaptedText.eng = (adaptedText.eng || []).map(item => ({
                        sentence: item.sentence || item.en || item.eng || '',
                        kor: item.kor || item.ko || item.korean || '',
                        audio_id: item.audio_id || ''
                    }));
                }
            }
        }
 
        if(!adaptedText.eng || adaptedText.eng.length === 0) {
            if (tpl.text && tpl.text.eng) adaptedText.eng = JSON.parse(JSON.stringify(tpl.text.eng));
            else if (crop.inferredType === 'lines') adaptedText.eng = [{ lines: [{en: "Text", ko: "텍스트"}], audio_id: "" }];
            else adaptedText.eng = [{ sentence: "Text", kor: "텍스트", audio_id: "" }];
        }
 
        adaptedText.eng = (adaptedText.eng || []).map((item, eIdx) => {
           const tplEng = tpl.text?.eng?.[eIdx] || {};
           return { ...item, audio_id: tplEng.audio_id || '' };
        });
 
        return { ...tpl, view: `0${idx + 1}`.slice(-2), bgSrc: crop.src, text: adaptedText, id: `box_${Date.now()}_${idx}`, image_aria_label: "" };
      });
      setPageData(initialData);
    }
    
    setCurrentPage(2);
    setActiveViewIdx(0);
  };
 
  const activeData = pageData[activeViewIdx];

  // 💡 롤플레이 A형 표 퀴즈 열 너비: 헤더/정적 예시 행 텍스트 길이에 맞춰 매 렌더링마다 재계산.
  const tableQuizColWidths = computeTableQuizColWidths(activeData?.tableQuiz?.headers || [], activeData?.tableQuiz?.staticRow || []);

  // 💡 [수정 10] 실제 마스터 템플릿(view0X.js)의 placeZipperKorean() 로직을 그대로 포팅.
  // zipper 문장들이 문장 경계와 상관없이 자연스럽게 흐르며 줄바꿈될 때, 각 문장(.zline-sentence-el)이
  // 실제로 몇 줄에 걸치는지 getClientRects()로 측정해서, 그 줄마다 한글 해석을 알맞은 만큼 나눠
  // 절대위치로 배치합니다. (문장 자체는 절대 쪼개지 않아 hover/클릭 그룹이 유지됩니다)
  useLayoutEffect(() => {
    if (!activeData || activeData.text?.type !== 'zipper') {
      setZipperKorFragments(prev => (prev.length > 0 ? [] : prev));
      return;
    }
    const flowEl = zipperFlowRef.current;
    if (!flowEl) return;
 
    const splitTextForWidth = (text, widthPx) => {
      const probe = document.createElement('div');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.left = '0';
      probe.style.top = '0';
      probe.style.width = `${widthPx}px`;
      probe.style.whiteSpace = 'normal';
      probe.style.fontFamily = 'NanumGothicBold, sans-serif';
      probe.style.fontSize = '17px';
      probe.style.lineHeight = '1.2';
      probe.style.wordBreak = 'keep-all';
      probe.textContent = text;
      flowEl.appendChild(probe);
 
      let result = { firstLine: text, rest: '' };
      const textNode = probe.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const range = document.createRange();
        range.selectNodeContents(probe);
        const rects = range.getClientRects();
        if (rects.length > 1) {
          const firstTop = rects[0].top;
          const threshold = rects[0].height / 2;
          let splitIndex = -1;
          for (let i = 1; i <= text.length; i++) {
            const r = document.createRange();
            r.setStart(textNode, i - 1);
            r.setEnd(textNode, i);
            const cr = r.getClientRects()[0];
            if (cr && cr.top > firstTop + threshold) { splitIndex = i - 1; break; }
          }
          if (splitIndex > 0) {
            const firstLine = text.slice(0, splitIndex).replace(/\s+$/, '');
            const rest = text.slice(splitIndex).replace(/^\s+/, '');
            if (firstLine) result = { firstLine, rest };
          }
        }
      }
      probe.remove();
      return result;
    };
 
    const measure = () => {
      if (!flowEl.isConnected) return;
      const s = scale || 1;
      const flowRect = flowEl.getBoundingClientRect();
      const flowWidthLogical = flowRect.width / s;
      const sentenceEls = flowEl.querySelectorAll('.zline-sentence-el');
      const newFragments = [];
 
      sentenceEls.forEach((sentenceEl) => {
        const idx = Number(sentenceEl.dataset.idx);
        const korText = activeData.text.eng?.[idx]?.kor;
        if (!korText) return;
        const rects = sentenceEl.getClientRects();
        if (!rects || rects.length === 0) return;
 
        let remainder = korText;
        for (let i = 0; i < rects.length && remainder; i++) {
          const rect = rects[i];
          const offsetLeft = (rect.left - flowRect.left) / s;
          const availWidth = Math.max(60, flowWidthLogical - offsetLeft);
          const isLastLine = (i === rects.length - 1);
          let text;
          if (isLastLine) {
            text = remainder;
            remainder = '';
          } else {
            const { firstLine, rest } = splitTextForWidth(remainder, availWidth);
            text = firstLine;
            remainder = rest;
          }
          const offsetTop = (rect.bottom - flowRect.top) / s;
          newFragments.push({ key: `${idx}-${i}`, top: offsetTop, left: offsetLeft, maxWidth: availWidth, text });
        }
      });
 
      setZipperKorFragments(newFragments);
    };
 
    measure();
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(() => requestAnimationFrame(measure));
    }
  }, [activeData, scale, contentType]);

  // 💡 [롤플레이 A형] 한 턴(같은 화자) 안에 여러 줄이 있을 때, 각 줄의 한글을 그 줄 바로 아래에
  // 배치. zipper와 동일하게 실제 렌더링된 DOM 위치를 측정해서 절대위치로 끼워넣는다 — 브라우저가
  // 각 줄(.rp-line-eng)을 컨테이너 폭에 맞춰 자동 줄바꿈하므로, 그려보기 전에는 위치를 알 수 없다.
  useLayoutEffect(() => {
    if (contentType !== 'roleplay_a' || !activeData) {
      setRoleplayKorFragments(prev => (prev.length > 0 ? [] : prev));
      return;
    }
    const containerEl = rolePlayScriptRef.current;
    if (!containerEl) return;

    const measure = () => {
      if (!containerEl.isConnected) return;
      const s = scale || 1;
      const newFragments = [];

      containerEl.querySelectorAll('[data-turn-idx]').forEach((turnEl) => {
        const dialIdx = Number(turnEl.dataset.turnIdx);
        const turn = activeData.dialogues?.[dialIdx];
        if (!turn) return;
        const lines = (turn.lines && turn.lines.length > 0)
          ? turn.lines
          : [{ sentence: turn.sentence || '', kor: turn.kor || '' }];

        const contentEl = turnEl.querySelector('.rp-turn-content');
        if (!contentEl) return;
        const contentRect = contentEl.getBoundingClientRect();

        turnEl.querySelectorAll('.rp-line-eng').forEach((lineEl, lineIdx) => {
          const line = lines[lineIdx];
          if (!line || !line.kor) return;
          // 💡 getBoundingClientRect()는 문장이 2줄로 꺾일 때 두 줄을 하나로 뭉뚱그린 박스를 줘서
          // 위치가 어긋난다. getClientRects()로 실제 줄마다 박스를 따로 받아, zipper처럼 한글도
          // 그만큼 나눠서 각 줄 바로 아래에 배치한다.
          const rects = lineEl.getClientRects();
          if (!rects || rects.length === 0) return;

          // 💡 마스터(view01.js placeMultiLineTranslation)와 동일한 수치로 맞춤:
          // left는 +3px 보정(TRANSLATION_LEFT_NUDGE), top은 JS의 +18px과 .translation span의
          // CSS margin-top:10px(절대배치 요소라도 margin-top만큼 더 밀림)을 합친 +28px, 각 줄의
          // 사용 가능 너비는 컨테이너 남은 폭이 아니라 그 줄(rect) 자체의 렌더링 폭을 기준으로 한다.
          let remainder = line.kor;
          for (let i = 0; i < rects.length && remainder; i++) {
            const rect = rects[i];
            const left = (rect.left - contentRect.left) / s + 3;
            const availWidth = Math.max(60, rect.width / s);
            const isLastRow = (i === rects.length - 1);
            let text;
            if (isLastRow) {
              text = remainder;
              remainder = '';
            } else {
              const { firstLine, rest } = splitTextForRowWidth(remainder, availWidth, 'NanumGothicBold, sans-serif', 15, 1.8, 'keep-all');
              text = firstLine;
              remainder = rest;
            }
            const top = (rect.top - contentRect.top) / s + 28;
            newFragments.push({ key: `${dialIdx}-${lineIdx}-${i}`, turnIdx: dialIdx, left, top, text, maxWidth: availWidth });
          }
        });
      });

      setRoleplayKorFragments(newFragments);
    };

    measure();
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(() => requestAnimationFrame(measure));
    }
  }, [activeData, scale, contentType]);

  // 💡 [롤플레이 C형 — A형 실측 로직을 그대로 복제] rolePlayScriptRefC/roleplayCKorFragments라는
  // 별도 ref/state를 써서, A형의 DOM 실측과 완전히 독립적으로 동작한다.
  useLayoutEffect(() => {
    if (contentType !== 'roleplay_c' || !activeData) {
      setRoleplayCKorFragments(prev => (prev.length > 0 ? [] : prev));
      return;
    }
    const containerEl = rolePlayScriptRefC.current;
    if (!containerEl) return;

    const measure = () => {
      if (!containerEl.isConnected) return;
      const s = scale || 1;
      const newFragments = [];

      containerEl.querySelectorAll('[data-turn-idx]').forEach((turnEl) => {
        const dialIdx = Number(turnEl.dataset.turnIdx);
        const turn = activeData.dialogues?.[dialIdx];
        if (!turn) return;
        const lines = (turn.lines && turn.lines.length > 0)
          ? turn.lines
          : [{ sentence: turn.sentence || '', kor: turn.kor || '' }];

        const contentEl = turnEl.querySelector('.rp-turn-content');
        if (!contentEl) return;
        const contentRect = contentEl.getBoundingClientRect();

        turnEl.querySelectorAll('.rp-line-eng').forEach((lineEl, lineIdx) => {
          const line = lines[lineIdx];
          if (!line || !line.kor) return;
          const rects = lineEl.getClientRects();
          if (!rects || rects.length === 0) return;

          let remainder = line.kor;
          for (let i = 0; i < rects.length && remainder; i++) {
            const rect = rects[i];
            const left = (rect.left - contentRect.left) / s + 3;
            const availWidth = Math.max(60, rect.width / s);
            const isLastRow = (i === rects.length - 1);
            let text;
            if (isLastRow) {
              text = remainder;
              remainder = '';
            } else {
              const { firstLine, rest } = splitTextForRowWidth(remainder, availWidth, 'NanumGothicBold, sans-serif', 15, 1.8, 'keep-all');
              text = firstLine;
              remainder = rest;
            }
            const top = (rect.top - contentRect.top) / s + 28;
            newFragments.push({ key: `${dialIdx}-${lineIdx}-${i}`, turnIdx: dialIdx, left, top, text, maxWidth: availWidth });
          }
        });
      });

      setRoleplayCKorFragments(newFragments);
    };

    measure();
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(() => requestAnimationFrame(measure));
    }
  }, [activeData, scale, contentType]);

  const handleMouseDown = (e, id) => {
    if (contentType === 'roleplay_a' || contentType === 'roleplay_b' || contentType === 'roleplay_c') return;
    e.preventDefault();
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
    if(!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDraggingBoxId(id);
    setDragOffset({ x: (e.clientX - rect.left) / (rect.width / 1280) - activeData.bubble.x, y: (e.clientY - rect.top) / (rect.height / 720) - activeData.bubble.y });
  };
  
  const handleMouseMove = (e) => {
    if (!draggingBoxId || !containerRef.current || contentType === 'roleplay_a' || contentType === 'roleplay_b' || contentType === 'roleplay_c') return;
    const rect = containerRef.current.getBoundingClientRect();
    let newX = (e.clientX - rect.left) / (rect.width / 1280) - dragOffset.x;
    let newY = (e.clientY - rect.top) / (rect.height / 720) - dragOffset.y;
    setPageData(prev => (prev || []).map(data => data.id === draggingBoxId ? { ...data, bubble: { ...data.bubble, x: Math.round(newX), y: Math.round(newY) } } : data));
  };
  
  const handleMouseUp = () => setDraggingBoxId(null);
  
  const updateBubbleProp = (field, value) => setPageData(prev => (prev || []).map((data, idx) => idx === activeViewIdx ? { ...data, bubble: { ...data.bubble, [field]: value } } : data));
  const updateViewProp = (field, value) => setPageData(prev => (prev || []).map((data, idx) => idx === activeViewIdx ? { ...data, [field]: value } : data));
 
  // 💡 [복원] 말풍선 꼬리(포인터)의 위치/회전을 계산합니다. (구버전 260601_v1_5에서 발견 및 복원)
  // bubble.tail_dir(꼬리 방향: top/bottom/left/right), bubble.tail_pos(꼬리 위치 %)를 기반으로
  // SVG 꼬리 요소에 적용할 style 객체를 반환합니다. 실제 곡선 모양(path)은 JSX에서 tail_tip 값으로 그립니다.
  const getTailStyle = (bubble) => {
    const dir = bubble?.tail_dir || 'bottom'; const pos = bubble?.tail_pos || 50;
    const style = { position: 'absolute', width: 45, height: 38, zIndex: 2, pointerEvents: 'none' };
    if (dir === 'bottom') { style.bottom = -36; style.left = `${pos}%`; style.transform = 'translateX(-50%)'; }
    else if (dir === 'top') { style.top = -33; style.left = `${pos}%`; style.transform = 'translateX(-50%) scaleY(-1)'; }
    else if (dir === 'left') { style.left = -33; style.top = `${pos}%`; style.transform = 'translateY(-50%) rotate(90deg)'; }
    else if (dir === 'right') { style.right = -33; style.top = `${pos}%`; style.transform = 'translateY(-50%) rotate(-90deg)'; }
    return style;
  };
 
  const handleTextTypeChange = (newType) => {
    setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx || contentType === 'roleplay_a' || contentType === 'roleplay_b' || contentType === 'roleplay_c') return data;
      let newEng = [...(data.text?.eng || [])];
      const oldType = data.text?.type || 'inline';
      if ((oldType === 'inline' || oldType === 'zipper') && newType === 'lines') {
        const lines = newEng.map(item => ({ en: item.sentence || '', ko: item.kor || '' }));
        newEng = [{ lines: lines.length ? lines : [{en: '', ko: ''}], audio_id: newEng[0]?.audio_id || '' }];
      } else if (oldType === 'lines' && (newType === 'inline' || newType === 'zipper')) {
        const firstBlock = newEng[0] || {};
        newEng = (firstBlock.lines || []).map((line, lineIdx) => ({ sentence: line.en || '', kor: line.ko || '', audio_id: lineIdx === 0 ? (firstBlock.audio_id || '') : '' }));
        if(newEng.length === 0) newEng = [{ sentence: '', kor: '', audio_id: '' }];
      }
      return { ...data, text: { ...data.text, type: newType, eng: newEng } };
    }));
  };
 
  const handleSentenceChange = (engIdx, field, value) => {
    setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx) return data;
      if (contentType === 'roleplay_a' || contentType === 'roleplay_c') {
          const newDialogues = [...(data.dialogues || [])];
          newDialogues[engIdx] = { ...newDialogues[engIdx], [field]: value };
          return { ...data, dialogues: newDialogues };
      } else {
          const newEng = [...(data.text?.eng || [])];
          newEng[engIdx] = { ...newEng[engIdx], [field]: value };
          return { ...data, text: { ...data.text, eng: newEng } };
      }
    }));
  };
  
  const handleLinesChange = (engIdx, lineIdx, field, value) => {
    if (contentType === 'roleplay_a' || contentType === 'roleplay_b' || contentType === 'roleplay_c') return;
    setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx) return data;
      const newEng = [...(data.text?.eng || [])];
      const newLines = [...(newEng[engIdx].lines || [])];
      newLines[lineIdx] = { ...newLines[lineIdx], [field]: value };
      newEng[engIdx] = { ...newEng[engIdx], lines: newLines };
      return { ...data, text: { ...data.text, eng: newEng } };
    }));
  };
  
  const addSentence = () => setPageData(prev => (prev || []).map((data, idx) => {
     if (idx !== activeViewIdx) return data;
     if (contentType === 'roleplay_a' || contentType === 'roleplay_c') {
         return { ...data, dialogues: [...(data.dialogues || []), { speaker: "A", lines: [{ sentence: "", kor: "", audio_id: "", hasBlank: false, muteTargets: "0" }] }] };
     }
     return { ...data, text: { ...data.text, eng: [...(data.text?.eng || []), { sentence: "", kor: "", audio_id: "" }] } };
  }));

  // 💡 [롤플레이 A형/C형 공용] 한 턴(같은 화자) 안에 오디오/빈칸이 독립적인 줄을 여러 개 담을 수 있도록
  // dialogues[i].lines 배열 단위로 조작하는 함수들. 턴 자체의 추가/삭제/화자 변경은 기존 addSentence/
  // removeSentence/handleSentenceChange가 그대로 담당한다.
  // A형과 C형은 데이터 구조·편집 동작이 동일해서 이 CRUD 헬퍼는 공유하고, 화면에 직접 보이는
  // 캔버스 렌더링·속성편집 패널 JSX만 별도로 복제한다(추후 C형이 실제로 다른 데이터 조작이
  // 필요해지면 그때 이 함수들도 분리한다).
  const handleDialogueLineChange = (dialIdx, lineIdx, field, value) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx || (contentType !== 'roleplay_a' && contentType !== 'roleplay_c')) return data;
      const newDialogues = [...(data.dialogues || [])];
      const turn = newDialogues[dialIdx];
      if (!turn) return data;
      const newLines = [...(turn.lines || [])];
      newLines[lineIdx] = { ...newLines[lineIdx], [field]: value };
      newDialogues[dialIdx] = { ...turn, lines: newLines };
      return { ...data, dialogues: newDialogues };
  }));

  const addDialogueLine = (dialIdx) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx || (contentType !== 'roleplay_a' && contentType !== 'roleplay_c')) return data;
      const newDialogues = [...(data.dialogues || [])];
      const turn = newDialogues[dialIdx];
      if (!turn) return data;
      newDialogues[dialIdx] = { ...turn, lines: [...(turn.lines || []), { sentence: "", kor: "", audio_id: "", hasBlank: false, muteTargets: "0" }] };
      return { ...data, dialogues: newDialogues };
  }));

  const removeDialogueLine = (dialIdx, lineIdx) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx || (contentType !== 'roleplay_a' && contentType !== 'roleplay_c')) return data;
      const newDialogues = [...(data.dialogues || [])];
      const turn = newDialogues[dialIdx];
      if (!turn) return data;
      const newLines = (turn.lines || []).filter((_, i) => i !== lineIdx);
      if (newLines.length === 0) return data; // 턴에는 최소 1줄이 남아있어야 함(0줄이면 턴 삭제를 이용)
      newDialogues[dialIdx] = { ...turn, lines: newLines };
      return { ...data, dialogues: newDialogues };
  }));
  
  const addLine = (engIdx) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx || contentType === 'roleplay_a' || contentType === 'roleplay_c') return data;
      const newEng = [...(data.text?.eng || [])];
      newEng[engIdx].lines.push({ en: "", ko: "" });
      return { ...data, text: { ...data.text, eng: newEng } };
  }));
  
  const removeSentence = (engIdx) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx) return data;
      if (contentType === 'roleplay_a' || contentType === 'roleplay_c') {
          return { ...data, dialogues: (data.dialogues || []).filter((_, i) => i !== engIdx) };
      }
      return { ...data, text: { ...data.text, eng: (data.text?.eng || []).filter((_, i) => i !== engIdx) } };
  }));
  
  const removeLine = (engIdx, lineIdx) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx || contentType === 'roleplay_a' || contentType === 'roleplay_c') return data;
      const newEng = [...(data.text?.eng || [])];
      newEng[engIdx].lines = (newEng[engIdx].lines || []).filter((_, i) => i !== lineIdx);
      return { ...data, text: { ...data.text, eng: newEng } };
  }));
 
  // 💡 [복원] '공통 설정' 탭 전체(헤더/영상/더보기 등)에서 사용하는 범용 업데이트 함수.
  // category가 있으면 그 하위 객체의 필드를, category가 null이면 globalData 최상위 필드를 갱신합니다.
  // (video_file_name, video_aria_label처럼 header 하위가 아닌 필드 갱신에 필요)
  const updateGlobalData = (category, field, value) => {
    setGlobalData(prev => {
      if (category) {
        return { ...prev, [category]: { ...prev[category], [field]: value } };
      }
      return { ...prev, [field]: value };
    });
  };
 
  // 💡 [복원] Understand 유형 전용 - 개별 컷의 배경 이미지를 사용자가 새 파일로 교체합니다.
  // 구버전(260601_v1_5, 260622_v1_0)에는 있었으나 최근 리팩토링 과정에서 정의만 삭제되고
  // JSX의 <input onChange={handleBgSwap}>는 그대로 남아 있어 ReferenceError를 일으키고 있었습니다.
  const handleBgSwap = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setPageData(prev => (prev || []).map((data, idx) => idx === activeViewIdx ? { ...data, bgSrc: event.target.result } : data));
      reader.readAsDataURL(file);
    }
  };

  // 💡 [롤플레이 B 전용] 씬 상황극 이미지 업로드. handleBgSwap과 동일한 FileReader 패턴을 쓰되,
  // 실제 이미지 데이터(rolePlayImageSrc)와 파일명(rolePlayImage, ZIP export 경로용)을 분리해서 저장한다.
  // 하단 썸네일(panelBtnImageSrc)은 별도 업로드를 요구하지 않고 resizeImageForUpload로 축소 생성한다.
  const handleSceneImageUpload = (e) => {
    if (contentType !== 'roleplay_b') return;
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const fullSrc = event.target.result;
      let thumbSrc = fullSrc;
      try {
        thumbSrc = await resizeImageForUpload(fullSrc, 200, 0.85);
      } catch (err) {
        console.warn('썸네일 생성 실패, 원본 이미지를 그대로 사용합니다:', err);
      }
      setPageData(prev => (prev || []).map((scene, idx) => idx === activeViewIdx ? { ...scene, rolePlayImageSrc: fullSrc, panelBtnImageSrc: thumbSrc } : scene));
    };
    reader.readAsDataURL(file);
  };
 
  const handleTableQuizChange = (field, colIndex, prop, value) => {
      setPageData(prev => (prev || []).map((data, idx) => {
          if (idx !== activeViewIdx) return data;
          const newTableQuiz = JSON.parse(JSON.stringify(data.tableQuiz || {}));
 
          if (field === 'headers') {
              if(!newTableQuiz.headers) newTableQuiz.headers = [];
              if(!newTableQuiz.headers[colIndex]) newTableQuiz.headers[colIndex] = { text: "", audioId: "" };
              newTableQuiz.headers[colIndex][prop] = value;
          } else if (field === 'staticRow') {
              if(!newTableQuiz.staticRow) newTableQuiz.staticRow = [];
              if (typeof newTableQuiz.staticRow[colIndex] === 'string') {
                  newTableQuiz.staticRow[colIndex] = { text: newTableQuiz.staticRow[colIndex], audioId: "" };
              }
              if(!newTableQuiz.staticRow[colIndex]) newTableQuiz.staticRow[colIndex] = { text: "", audioId: "" };
              newTableQuiz.staticRow[colIndex][prop] = value;
          }
          return { ...data, tableQuiz: newTableQuiz };
      }));
  };
 
  const addTableQuizRow = () => {
      setPageData(prev => (prev || []).map((data, idx) => {
          if (idx !== activeViewIdx) return data;
          const newTableQuiz = JSON.parse(JSON.stringify(data.tableQuiz || {}));
          newTableQuiz.rowCount = Number(newTableQuiz.rowCount || 3) + 1;
          return { ...data, tableQuiz: newTableQuiz };
      }));
  };
 
  const removeTableQuizRow = () => {
      setPageData(prev => (prev || []).map((data, idx) => {
          if (idx !== activeViewIdx) return data;
          const newTableQuiz = JSON.parse(JSON.stringify(data.tableQuiz || {}));
          if (Number(newTableQuiz.rowCount || 3) > 1) {
              newTableQuiz.rowCount = Number(newTableQuiz.rowCount || 3) - 1;
          }
          return { ...data, tableQuiz: newTableQuiz };
      }));
  };
 
  // 💡 [복원] 관리자 마스터 ZIP + 편집된 데이터를 병합해 최종 콘텐츠 ZIP으로 추출합니다.
  // 구버전(콘텐츠_양산_에이전트_260622_v1_0)에서 복원한 로직이며, 현재 상태 구조(templates/pageData/globalData)와
  // 필드명을 대조 확인하여 그대로 이식했습니다.
  const handleExportZip = async () => {
    const templateRecord = templates[contentType];
    if (!templateRecord || !templateRecord.blob) {
      showToast("관리자 템플릿이 등록되지 않아 추출할 수 없습니다.");
      return;
    }
 
    showToast("📦 원본 ZIP 파일을 분석하여 무결점 덮어쓰기를 진행 중입니다...");
 
    try {
        await loadJSZip();
        if(!window.JSZip) throw new Error("JSZip 라이브러리를 불러올 수 없습니다.");
 
        const originalZip = await new window.JSZip().loadAsync(templateRecord.blob);
        const newZip = new window.JSZip();
 
        const entries = [];
        originalZip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && !relativePath.includes("__MACOSX")) {
                entries.push(zipEntry);
            }
        });
 
        let rootDir = "";
        let minDepth = Infinity;
        entries.forEach(entry => {
            if (entry.name.endsWith(".html")) {
                const parts = entry.name.split('/');
                if (parts.length < minDepth) {
                    minDepth = parts.length;
                    const lastSlashIndex = entry.name.lastIndexOf("/");
                    rootDir = lastSlashIndex !== -1 ? entry.name.substring(0, lastSlashIndex + 1) : "";
                }
            }
        });
 
        const filePromises = entries.map(async (entry) => {
            if (entry.name.startsWith(rootDir)) {
                const newPath = entry.name.substring(rootDir.length);
                const content = await entry.async('arraybuffer');
                newZip.file(newPath, content);
            }
        });
        await Promise.all(filePromises);
 
        let fileContent = "";
 
        if (contentType === 'roleplay_a') {
            const rowCount = Number(pageData[0]?.tableQuiz?.rowCount || 3);
            // 💡 [자동 생성] hiddenText는 공통 설정 탭의 '지시문(instruction)'을 그대로 재사용해 구성.
            // 레슨마다 달라지는 주제 설명은 instruction에 이미 담겨 있으므로, 여기에 고정 안내 문구만 덧붙인다.
            const roleplayInstruction = String(globalData.header.instruction || "").trim();
            const roleplayHiddenText = roleplayInstruction
                ? `${roleplayInstruction} 롤플레이 활동이 어려울 경우, 선생님께 도움을 요청해 보세요.`
                : "롤플레이 활동이 어려울 경우, 선생님께 도움을 요청해 보세요.";

            const roleplayExportData = {
                pageInfo: {
                    hiddenText: roleplayHiddenText,
                    title: {
                        head: String(globalData.header.letter || ""),
                        text: String(globalData.header.text || ""),
                        color: String(globalData.header.color || "")
                    },
                    instruction: roleplayInstruction
                },
                howToPlay: [
                    { step: 1, tail: "left", lines: ["버튼을 눌러 예시 대화를", "확인하고 이야기해 보세요."] },
                    { step: 2, tail: "top", lines: ["역할을 선택해 보세요."] },
                    { step: 3, tail: "bottom", lines: ["내가 맡은 역할의 대사를", "가리고 말해 보세요."] },
                    // 💡 특정 레슨 주제(예: 여가 활동)를 가정한 문구 대신, 모든 콘텐츠에 공통 적용 가능한 범용 문구로 변경.
                    { step: 4, tail: "top", lines: ["예시 대화를 참고하여 친구들과 대화한 후,", "표에 알맞은 내용을 써 보세요."] }
                ],
                rolePlay: {
                    toggleBtn: { ariaLabel: "클릭 시 대화창 바꾸기" },
                    // 🚀 [추출 최적화] 불필요한 구형 껍데기(blankData 등) 완벽 제거 및 순수 Flat 포맷 내보내기
                    // 💡 한 턴(같은 화자) 안에 오디오/빈칸이 독립적인 줄이 여러 개 있을 수 있으므로,
                    // turn.lines 배열을 강제로 1개로 접지 않고 있는 그대로 매핑한다.
                    dialogues: (pageData[0]?.dialogues || []).map(item => {
                        const rawLines = (item.lines && item.lines.length > 0)
                            ? item.lines
                            : [{ sentence: item.sentence, kor: item.kor, audio_id: item.audio_id, hasBlank: item.hasBlank, muteTargets: item.muteTargets }];

                        const lines = rawLines.map(line => {
                            const lineObj = {
                                hasBlank: line.hasBlank,
                                audio: String(line.audio_id || ""),
                                eng: String(line.sentence || ""),
                                kor: String(line.kor || "")
                            };

                            if (line.hasBlank) {
                                // 💡 마스터 템플릿은 blankAudio 필드를 읽지 않고, "{audio_id}_묵음.mp3"라는
                                // 고정 네이밍 규칙으로 묵음 파일을 찾는다(view01.html 오디오 경로 생성 로직 참고).
                                lineObj.muteTargets = line.muteTargets !== undefined && String(line.muteTargets).trim() !== ""
                                    ? String(line.muteTargets).split(',').map(s => Number(s.trim()))
                                    : [0];
                                // 💡 [빈칸 강조색] eng 안의 `[대괄호]` 구간을 정답 모드에서 몇 번 색상(emp col-N)으로
                                // 강조할지 지정. 마스터 템플릿이 기존에 col-0로 하드코딩했던 부분을 이 값을 읽어
                                // 쓰도록 별도 수정이 필요함(작업 프롬프트 참고) — 그 전까지는 값을 내보내기만 하고
                                // 무시될 수 있음.
                                lineObj.blankColor = Number.isInteger(line.blankColor) ? line.blankColor : 0;
                            }

                            return lineObj;
                        });

                        return { speaker: String(item.speaker || "A"), lines };
                    })
                },
                tableQuiz: {
                    headers: pageData[0]?.tableQuiz?.headers || [],
                    staticRow: (pageData[0]?.tableQuiz?.staticRow || []).map(col => ({
                        text: typeof col === 'string' ? col : (col.text || ""),
                        audioId: typeof col === 'string' ? "" : (col.audioId || "")
                    })),
                    rowCount: rowCount,
                    answers: []
                }
            };
            fileContent = `const contentData = ${JSON.stringify(roleplayExportData, null, 2)};\n`;

        } else if (contentType === 'roleplay_c') {
            // 💡 [C형 — 실제 마스터 템플릿(view01.js/html) 확인 결과 반영] 표 퀴즈가 아니라, 여러
            // "페이지"(대화 갈래, 예: Yes/No 분기)를 좌우 화살표+점(dots)으로 넘겨보는 구조.
            // contentData.rolePlay.pages 배열(각 pageId/dialogues)로 내보내고, tableQuiz 필드는
            // 아예 넣지 않는다(실제 데이터 기반 동적 렌더링으로 확인됨 — 정적 HTML 아님).
            const roleplayInstruction = String(globalData.header.instruction || "").trim();
            const roleplayHiddenText = roleplayInstruction
                ? `${roleplayInstruction} 롤플레이 활동이 어려울 경우, 선생님께 도움을 요청해 보세요.`
                : "롤플레이 활동이 어려울 경우, 선생님께 도움을 요청해 보세요.";

            const formatDialogues = (dialogues) => (dialogues || []).map(item => {
                const rawLines = (item.lines && item.lines.length > 0)
                    ? item.lines
                    : [{ sentence: item.sentence, kor: item.kor, audio_id: item.audio_id, hasBlank: item.hasBlank, muteTargets: item.muteTargets }];

                const lines = rawLines.map(line => {
                    const lineObj = {
                        hasBlank: line.hasBlank,
                        audio: String(line.audio_id || ""),
                        eng: String(line.sentence || ""),
                        kor: String(line.kor || "")
                    };

                    if (line.hasBlank) {
                        lineObj.muteTargets = line.muteTargets !== undefined && String(line.muteTargets).trim() !== ""
                            ? String(line.muteTargets).split(',').map(s => Number(s.trim()))
                            : [0];
                        lineObj.blankColor = Number.isInteger(line.blankColor) ? line.blankColor : 0;
                    }

                    return lineObj;
                });

                return { speaker: String(item.speaker || "A"), lines };
            });

            const roleplayExportData = {
                pageInfo: {
                    hiddenText: roleplayHiddenText,
                    title: {
                        head: String(globalData.header.letter || ""),
                        text: String(globalData.header.text || ""),
                        color: String(globalData.header.color || "")
                    },
                    instruction: roleplayInstruction
                },
                howToPlay: [
                    { step: 1, tail: "left", lines: ["버튼을 눌러 예시 대화를", "확인하고 이야기해 보세요."] },
                    { step: 2, tail: "top", lines: ["역할을 선택해 보세요."] },
                    { step: 3, tail: "bottom", lines: ["내가 맡은 역할의 대사를", "가리고 말해 보세요."] },
                    { step: 4, tail: "top", lines: ["화면 하단의 화살표를 눌러", "다른 대화 갈래도 확인해 보세요."] }
                ],
                rolePlay: {
                    toggleBtn: { ariaLabel: "클릭 시 대화창 바꾸기" },
                    pages: (pageData || []).map((page, idx) => ({
                        pageId: idx,
                        dialogues: formatDialogues(page.dialogues)
                    }))
                }
            };
            fileContent = `const contentData = ${JSON.stringify(roleplayExportData, null, 2)};\n`;

        } else if (contentType === 'roleplay_b') {
            const formattedBData = pageData.map((scene, sIdx) => ({
                type: "B",
                sceneId: sIdx,
                rolePlayImage: String(scene.rolePlayImage || `RolePlay_img_${sIdx}.png`),
                panelBtnImage: String(scene.panelBtnImage || `RolePlay_img_mini_000${sIdx + 1}.png`),
                panelBtnLabel: String(scene.panelBtnLabel || "클릭 시 대화를 볼 수 있습니다."),
                roleA: String(scene.roleA || "A"),
                roleB: String(scene.roleB || "B"),
                dialogues: (scene.dialogues || []).map(item => ({
                    role: String(item.speaker || "A"),
                    text: [String(item.sentence || "")],
                    translation: [String(item.kor || "")],
                    audio: [String(item.audio_id || "")]
                }))
            }));
 
            fileContent = `// =============================================================================\n` +
                          `// [Role Play 콘텐츠 데이터] - 저작 에이전트 자동 추출\n` +
                          `// =============================================================================\n\n` +
                          `const globalText = {\n` +
                          `    visuallyHidden: "짝과 함께 제시된 표현과 의미를 활용하여 대화를 나누어보는 활동입니다.",\n` +
                          `    actTitleHeader: "${globalData.header.letter || "B"}",\n` +
                          `    actTitle: "${globalData.header.text || "Think and Talk"}",\n` +
                          `    actInstruction: "${globalData.header.instruction || ""}",\n` +
                          `    howToPlayBtn: "How to play",\n` +
                          `    howToPlayLabel: "클릭 시 HowToPlay 창 열기",\n` +
                          `    howToPlayImage: "big_pop_HowToPlay.png",\n` +
                          `    howToPlaySteps: [\n` +
                          `        { step: 1, text: ["걱정하는 상황을", "선택해 보세요."] },\n` +
                          `        { step: 2, text: ["역할을 선택해 보세요."] },\n` +
                          `        { step: 3, text: ["각 대사들의", "해석을 확인하세요."] },\n` +
                          `        { step: 4, text: ["내가 맡은 역할의", "대사를 가리고", "말해 보세요."] }\n` +
                          `    ]\n` +
                          `};\n\n` +
                          `const rolePlayData = ${JSON.stringify(formattedBData, null, 2)};\n`;

            // 💡 [씬 이미지 임베드] 마스터 템플릿(view01.js renderRolePlay)이 실제로
            // `./images/view01/{rolePlayImage}`, `./images/view01/{panelBtnImage}` 경로에서
            // 이미지를 로드하는 것을 확인함 — 씬마다 업로드된 실제 이미지 데이터
            // (rolePlayImageSrc/panelBtnImageSrc)를 그 경로로 zip에 심는다.
            (pageData || []).forEach((scene) => {
              if (scene.rolePlayImageSrc && scene.rolePlayImageSrc.startsWith('data:image')) {
                newZip.file(`images/view01/${scene.rolePlayImage}`, scene.rolePlayImageSrc.split(',')[1], { base64: true });
              }
              if (scene.panelBtnImageSrc && scene.panelBtnImageSrc.startsWith('data:image')) {
                newZip.file(`images/view01/${scene.panelBtnImage}`, scene.panelBtnImageSrc.split(',')[1], { base64: true });
              }
            });

        } else {
            const exportGlobalData = globalData;
            // 💡 [수정 5] 문장(eng)이 전부 비어있으면 말풍선 데이터 자체를 null로 내보내
            // 최종 콘텐츠에서 빈 말풍선이 그려지지 않도록 합니다.
            const isBubbleTextEmpty = (text) => {
              if (!text) return true;
              if (text.type === 'lines') {
                const lines = text.eng?.[0]?.lines || [];
                return lines.length === 0 || lines.every(l => !String(l?.en || '').trim());
              }
              const eng = text.eng || [];
              return eng.length === 0 || eng.every(item => !String(item?.sentence || '').trim());
            };
 
            const exportPageData = (pageData || []).map(data => {
              const bubbleEmpty = isBubbleTextEmpty(data.text);
              return {
                image_url: `./images/view${data.view}/image.png`,
                image_aria_label: data.image_aria_label || "이미지 설명",
                bubble: bubbleEmpty ? null : { width: data.bubble.width, x: data.bubble.x, y: data.bubble.y, tail_dir: data.bubble.tail_dir, tail_pos: data.bubble.tail_pos, tail_tip: data.bubble.tail_tip || 'right', bg_color: data.bubble.bg_color, border_color: data.bubble.border_color },
                text: { type: data.text.type, eng: data.text.eng }
              };
            });
            fileContent = `// [1. 공통 데이터]\nconst GLOBAL_DATA = ${JSON.stringify(exportGlobalData, null, 2)};\n\n// [2. 개별 페이지 데이터]\nconst PAGE_DATA = ${JSON.stringify(exportPageData, null, 2)};\n`;
 
            (pageData || []).forEach((data) => {
              if (data.bgSrc && data.bgSrc.startsWith('data:image')) {
                const base64Data = data.bgSrc.split(',')[1];
                newZip.file(`images/view${data.view}/image.png`, base64Data, { base64: true });
              }
            });
        }
 
        // 💡 [버그 수정] view_pageinfo.js는 실제 사이트의 "페이지(HTML 파일)" 목록이다. understand는
        // 컷(cut)마다 실제로 별도 view0X.html 파일이 되므로 pageData 항목 수만큼 맞지만, roleplay/
        // roleplay_b는 대화·씬이 몇 개든 항상 view01.html 한 페이지짜리 단일 활동이다 — 씬 전환은
        // 마스터 템플릿 자체의 패널 버튼(panel-btns)이 페이지 이동 없이 처리한다. 그런데 이전엔
        // contentType 구분 없이 pageData(씬/대화 배열)를 그대로 매핑해서, roleplay_b에서 씬이 여러 개면
        // view_pageinfo가 씬 개수만큼 부풀려졌고, 그 결과 마스터 템플릿이 "여러 페이지가 있다"고 오인해
        // 불필요한 페이지 이동 네비게이션 바(.nav-html)를 그려버렸다.
        const viewPageInfoData = (contentType === 'roleplay_a' || contentType === 'roleplay_b' || contentType === 'roleplay_c')
          ? [{ url: "view01.html" }]
          : (pageData || []).map(data => ({ url: `view${data.view}.html` }));
        const viewPageInfoContent = `const view_pageinfo = ${JSON.stringify(viewPageInfoData, null, 2)};\n`;
 
        let targetDataJsPath = "js/data.js";
        let targetPageInfoPath = "js/view_pageinfo.js";
 
        entries.forEach(entry => {
            if (entry.name.endsWith("data.js") && entry.name.includes("js/")) {
                targetDataJsPath = entry.name.startsWith(rootDir) ? entry.name.substring(rootDir.length) : entry.name;
            }
            if (entry.name.endsWith("view_pageinfo.js") && entry.name.includes("js/")) {
                targetPageInfoPath = entry.name.startsWith(rootDir) ? entry.name.substring(rootDir.length) : entry.name;
            }
        });
 
        newZip.file(targetDataJsPath, fileContent);
        newZip.file(targetPageInfoPath, viewPageInfoContent);
 
        const blob = await newZip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = contentType === 'roleplay_a' ? 'roleplay(A)_content.zip' : (contentType === 'roleplay_b' ? 'roleplay(B)_content.zip' : (contentType === 'roleplay_c' ? 'roleplay(C)_content.zip' : 'understand_content.zip'));
        a.click();
        URL.revokeObjectURL(url);
        showToast("✅ 완벽한 구조의 ZIP 패키지 추출이 완료되었습니다!");
    } catch (error) {
        console.error("ZIP Export Error:", error);
        showToast(`❌ ZIP 추출 오류: ${error.message}`);
    }
  };
 
  const handleTemplateUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await saveTemplateDB(type, file.name, file);
        setTemplates(prev => ({ ...prev, [type]: { name: file.name, blob: file } }));
        showToast(`'${type}' 유형 원본 ZIP 템플릿이 영구 저장되었습니다.`);
      } catch (err) {
        showToast("템플릿 저장 중 오류가 발생했습니다.");
      }
    }
  };
 
  const handleTemplateDelete = async (type) => {
    try {
      await deleteTemplateDB(type);
      setTemplates(prev => ({ ...prev, [type]: null }));
      showToast(`'${type}' 유형 템플릿이 삭제되었습니다.`);
    } catch (err) {
      showToast("템플릿 삭제 중 오류가 발생했습니다.");
    }
  };
 
  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-800 relative">
      
      {toastMsg ? (
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl z-[9999] animate-fade-in font-bold text-sm select-none">
          {String(toastMsg)}
        </div>
      ) : null}
 
      {serverStatus === 'offline' ? (
        <div className="w-full bg-red-600 text-white text-xs font-bold text-center py-1.5 z-50 shrink-0">
          ⚠️ 서버(API)에 연결할 수 없습니다. 로컬 개발 중이라면 터미널에서 <code className="bg-red-700 px-1 rounded">npm run server</code> (또는 <code className="bg-red-700 px-1 rounded">npm run dev:all</code>)를 실행했는지 확인하세요.
        </div>
      ) : null}
 
      <header className="bg-emerald-700 text-white p-3 shadow-md flex justify-between items-center z-50 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">📚 콘텐츠 저작 파이프라인</h1>
          {!isAdminMode ? (
            <div className="text-xs bg-emerald-800 px-3 py-1 rounded-full shadow-inner border border-emerald-600">
              {currentPage === 1 ? "1단계: 교과서 업로드 및 레이아웃 분석" : "2단계: 에디터 및 추출"}
            </div>
          ) : null}
        </div>
 
        <div className="flex bg-emerald-900 rounded-full p-1 cursor-pointer" onClick={() => { setIsAdminMode(!isAdminMode); setCurrentPage(1); }}>
          <div className={`px-4 py-1 text-xs font-bold rounded-full transition-all duration-300 ${!isAdminMode ? 'bg-white text-emerald-800 shadow-md' : 'text-emerald-300'}`}>작업자 (에디터)</div>
          <div className={`px-4 py-1 text-xs font-bold rounded-full transition-all duration-300 ${isAdminMode ? 'bg-red-500 text-white shadow-md' : 'text-emerald-300'}`}>관리자 (템플릿 관리)</div>
        </div>
      </header>
 
      {/* 관리자 모형 템플릿 업로드 화면 */}
      {isAdminMode && (
        <div className="flex-1 p-8 overflow-y-auto bg-gray-100 flex justify-center items-start">
          <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-xl max-w-5xl w-full">
            <h2 className="text-2xl font-bold mb-2 text-red-600 flex items-center gap-2">🛠️ 원본 마스터 ZIP 라이브러리 (교과서 제작 핵심 소스 관리)</h2>
            <p className="text-gray-500 text-sm mb-8">업로드한 ZIP 파일은 브라우저 DB에 영구 저장되므로 매번 올릴 필요가 없습니다. 여기에 등재되는 ZIP 원본들은 기획자들이 제공하는 최종 UI 번들 뼈대입니다. 추출 버튼을 눌렀을 때 엔진이 이 ZIP을 껍데기 삼아 내부의 `data.js`만 동적으로 치환 조립하여 새로운 교과서 노드를 배포해 냅니다.</p>
            
            <div className="grid grid-cols-4 gap-6">
              {['understand', 'roleplay_a', 'roleplay_b', 'roleplay_c'].map((type) => {
                const meta = {
                  understand: { badge: 'U', badgeClass: 'bg-blue-100 text-blue-600', title: 'Understand 유형', desc: '말풍선 이해도 향상 코믹 콘텐츠용 마스터 소스', btnClass: 'bg-blue-600 hover:bg-blue-700' },
                  roleplay_a: { badge: 'RA', badgeClass: 'bg-purple-100 text-purple-600', title: 'Roleplay(A) 유형', desc: '역할극 대화형 콘텐츠(예: talk and complete)의 마스터 소스', btnClass: 'bg-purple-600 hover:bg-purple-700' },
                  roleplay_b: { badge: 'RB', badgeClass: 'bg-teal-100 text-teal-600', title: 'Roleplay(B) 유형', desc: '표 퀴즈를 전면 비활성화한 씬 기반 다중 장면극 마스터 소스', btnClass: 'bg-teal-600 hover:bg-teal-700' },
                  roleplay_c: { badge: 'RC', badgeClass: 'bg-fuchsia-100 text-fuchsia-600', title: 'Roleplay(C) 유형', desc: '표 퀴즈 대신 여러 대화 갈래(페이지)를 넘겨보는 분기형 대화 마스터 소스', btnClass: 'bg-fuchsia-600 hover:bg-fuchsia-700' },
                }[type];
                return (
                <div key={type} className="border border-gray-200 rounded-xl p-5 bg-gray-50 flex flex-col items-center justify-between text-center relative hover:border-gray-300 transition shadow-sm">
                  {templates[type] && (
                    <button onClick={() => handleTemplateDelete(type)} className="absolute top-3 right-3 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded hover:bg-red-500 hover:text-white transition">삭제</button>
                  )}
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl mb-3 ${meta.badgeClass}`}>
                    {meta.badge}
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 mb-1">{meta.title}</h3>
                  <p className="text-xs text-gray-400 h-8 mb-4">{meta.desc}</p>

                  <input type="file" accept=".zip" onChange={(e) => handleTemplateUpload(e, type)} className="hidden" id={`zip-${type}`} />
                  <label htmlFor={`zip-${type}`} className={`w-full py-2 text-white text-sm font-bold rounded-lg cursor-pointer transition block ${templates[type] ? 'bg-emerald-500 hover:bg-emerald-600' : meta.btnClass}`}>
                    {templates[type] ? `✅ ${templates[type].name.slice(0, 15)}...` : 'ZIP 마스터 템플릿 등록'}
                  </label>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
 
      {/* 1단계: 교과서 투입 및 AI 레이아웃 자동 판별 */}
      {!isAdminMode && currentPage === 1 && (
        <div className="flex-1 overflow-y-auto p-8 flex justify-center items-center bg-gray-50">
          <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-xl max-w-4xl w-full">
            <h2 className="text-2xl font-bold mb-1">📖 1단계: 종이 교과서 이미지 투입 및 판별</h2>
            <p className="text-gray-500 text-sm mb-6">사용자가 생성하고 싶은 종이 교과서 PDF 및 이미지를 업로드하세요. AI Vision 분석 파이프라인이 텍스트, 말풍선 좌표 및 레이아웃을 자동 분할하여 최적의 인터랙티브 콘텐츠 템플릿을 추천합니다.</p>
 
            <div className="grid grid-cols-2 gap-8">
              {/* 왼쪽 투입 */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 bg-gray-50 flex flex-col justify-center items-center text-center hover:bg-emerald-50 transition">
                <span className="text-4xl mb-4">📥</span>
                <p className="font-bold text-sm mb-2 text-gray-700">교과서 파일 업로드</p>
                <p className="text-xs text-gray-500 mb-6">PDF / PNG / JPG 등 1280x720 규격 이미지</p>
                
                <div className="space-y-2 w-full">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 mx-auto cursor-pointer" />
                </div>
              </div>
 
              {/* 오른쪽 결과 */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between min-h-[300px] shadow-sm">
                {isAnalyzing ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-bold text-emerald-600 animate-pulse">Claude AI 분석 중...</p>
                  </div>
                ) : uploadedImage ? (
                  <div className="flex-1 flex flex-col justify-between animate-fade-in">
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 mb-3">📊 AI 자동 추천 분석 스펙</h3>
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg space-y-2 mb-4">
                        <div className="flex justify-between items-center text-xs border-b border-gray-200 pb-2">
                          <span className="text-gray-500">콘텐츠 타입</span>
                          <span className="flex items-center gap-1.5">
                            <span className="font-bold text-teal-600 uppercase">{getDisplayTypeName(contentType, globalData.header.text)}</span>
                            <button
                              type="button"
                              onClick={() => setShowTypePreview(true)}
                              className="text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded px-1.5 py-0.5 transition"
                              title="이 유형의 완성 화면 예시 보기"
                            >
                              👁 미리보기
                            </button>
                            {/* TODO: 유형 변경 버튼 자리 — 유형 간 데이터 매핑 정의 후 추가 예정 */}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs border-b border-gray-200 pb-2"><span className="text-gray-500">헤더 발문 자산</span><span className="font-bold text-gray-800">{globalData.header.letter} - {globalData.header.text}</span></div>
                        <div className="flex justify-between text-xs border-b border-gray-200 pb-2"><span className="text-gray-500">지시문 내용</span><span className="font-bold text-gray-800 max-w-[200px] truncate">{globalData.header.instruction}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">정렬 뷰 개수</span><span className="font-bold text-indigo-600">{contentType === 'understand' ? croppedViews.length : '1 Scene (동적 멀티전환)'}</span></div>
                      </div>
                    </div>
 
                    <button onClick={startEditing} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md text-sm transition">
                      2단계 저작자 캔버스 진입 🚀
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                    왼쪽 패널에서 종이 교과서 이미지를 업로드해 주세요.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💡 [1단계] 유형 미리보기 라이트박스 — 판정된 contentType의 완성 화면 대표 예시를 보여줌 */}
      {showTypePreview && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6"
          onClick={() => setShowTypePreview(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 shrink-0">
              <h3 className="text-sm font-bold text-gray-800">
                {getDisplayTypeName(contentType, globalData.header.text)} 완성 예시
              </h3>
              <button
                type="button"
                onClick={() => setShowTypePreview(false)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto">
              {getPreviewImageSrc(contentType, globalData.header.text) ? (
                <img src={getPreviewImageSrc(contentType, globalData.header.text)} alt={`${contentType} 완성 화면 예시`} className="w-full h-auto rounded-lg border border-gray-200" />
              ) : (
                <div className="py-16 text-center text-sm text-gray-400">이 유형의 예시 이미지는 아직 준비 중입니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2단계: 인터랙티브 캔버스 저작 공간 */}
      {!isAdminMode && currentPage === 2 && activeData && (
        <div className="flex-1 flex overflow-hidden bg-gray-300 animate-none" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
          <div className="flex-1 flex flex-col relative min-w-0 bg-gray-300">
            <div className="p-2 bg-white border-b flex justify-between items-center z-20 shrink-0 shadow-sm">
               <div className="flex items-center gap-2"><button onClick={() => setCurrentPage(1)} className="px-4 py-1.5 text-sm font-bold rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 border transition">← 뒤로가기</button></div>
               <div className="flex gap-2 overflow-x-auto px-2">
                 {contentType === 'understand' && (pageData || []).map((data, idx) => (
                    <button key={data.id} onClick={() => setActiveViewIdx(idx)} className={`px-5 py-1.5 text-sm font-bold rounded-full transition whitespace-nowrap ${activeViewIdx === idx ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'}`}>View {String(data.view || '')}</button>
                  ))}
                  {contentType === 'roleplay_a' && (
                    <button className="px-5 py-1.5 text-sm font-bold rounded-full bg-purple-600 text-white shadow-md whitespace-nowrap">{getDisplayTypeName(contentType, globalData.header.text)}</button>
                  )}
                  {contentType === 'roleplay_c' && (
                    <>
                      {(pageData || []).map((page, idx) => (
                        <button key={page.id} onClick={() => setActiveViewIdx(idx)} className={`px-5 py-1.5 text-sm font-bold rounded-full transition whitespace-nowrap ${activeViewIdx === idx ? 'bg-fuchsia-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'}`}>Page {idx + 1}</button>
                      ))}
                      <button onClick={addPageC} className="px-4 py-1.5 text-sm font-bold rounded-full whitespace-nowrap border-2 border-dashed border-fuchsia-400 text-fuchsia-600 hover:bg-fuchsia-50 transition">+ 페이지 추가</button>
                    </>
                  )}
                  {contentType === 'roleplay_b' && (
                    <>
                      {(pageData || []).map((scene, idx) => (
                        <button key={scene.id} onClick={() => setActiveViewIdx(idx)} className={`px-5 py-1.5 text-sm font-bold rounded-full transition whitespace-nowrap ${activeViewIdx === idx ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'}`}>Scene 0{idx + 1}</button>
                      ))}
                      <button onClick={addSceneB} className="px-4 py-1.5 text-sm font-bold rounded-full whitespace-nowrap border-2 border-dashed border-teal-400 text-teal-600 hover:bg-teal-50 transition">+ 씬 추가</button>
                    </>
                  )}
               </div>
            </div>
 
            <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4" ref={wrapperRef}>
               <div ref={containerRef} className="bg-white shadow-2xl relative border border-gray-200 select-none" style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: 'center center', flexShrink: 0, overflow: 'hidden' }}>
                 
                 {/* 헤더 발문 영역 */}
                 <div className="absolute top-[27px] w-full px-[37px] flex flex-col items-start pointer-events-none z-10">
                   <div className="flex items-center gap-2 pointer-events-auto">
                     <div style={{ position: 'relative', height: 35, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif', fontSize: 20, padding: '0 5px', color: contentType === 'understand' ? '#2f964e' : '#09769d', borderTop: `solid 3.5px ${contentType === 'understand' ? '#d3ea95' : '#c9e6f4'}`, borderBottom: `solid 3.5px ${contentType === 'understand' ? '#d3ea95' : '#c9e6f4'}` }}>
                       <span style={{ fontSize: 17, fontWeight: 'bold' }}>
                         <span style={{ fontSize: 16, backgroundColor: contentType === 'understand' ? '#088d3b' : '#0580ac', color: '#fff', borderRadius: 20, padding: '0 10px', marginRight: 5 }}>{globalData.header.letter}</span>
                         {globalData.header.text}
                       </span>
                     </div>
                   </div>
                   <div className="flex items-center gap-3 mt-2 pointer-events-auto">
                     <span style={{ fontFamily: 'sans-serif', fontSize: 28, fontWeight: 'bold', color: '#000' }}>{globalData.header.instruction}</span>
                     {/* 💡 [수정 1] understand 유형은 비디오 버튼, roleplay(A/B)는 How to play 버튼으로 분기 */}
                     {/* 260601 원본 그대로: 실제 서비스 에셋 이미지(btn_video.png) 사용 */}
                     {contentType === 'understand' ? (
                       <button
                         style={{ position: 'relative', verticalAlign: 'middle', width: 35, height: 34, background: 'url(https://aidtcdn-dev.aitextbook.co.kr/lcms/m2_engl_00_l2/tbset/common1/images/btn/btn_video.png) 0 0 / 35px 34px no-repeat', marginLeft: 10, cursor: 'pointer', border: 'none', padding: 0 }}
                         aria-label={globalData.header.btn_aria_label || '영상 보기'}
                         title={globalData.header.btn_aria_label || '영상 보기'}
                       ></button>
                     ) : (
                       <button style={{ marginLeft: 15, height: 40, padding: '0 15px', backgroundColor: '#9c76ea', color: '#fff', borderRadius: 50, border: 'none', fontWeight: 'bold', fontSize: 18, cursor: 'pointer' }}>? How to play</button>
                     )}
                   </div>
                 </div>
 
                 {/* 1. Understand 모드 캔버스 */}
                 {contentType === 'understand' && (
                   <>
                     {/* 교과서 배경화면 매칭 */}
                     <div className="absolute left-[333px] top-[193px] w-[614px] h-[354px] bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
                       <img src={activeData.bgSrc || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=1280"} alt="Background" className="w-full h-full object-fill" />
                     </div>
 
                     {/* 💡 [수정 4] view가 2개 이상일 때, 메인 이미지 좌우에 이전/다음 컷 이동 화살표 + 썸네일 표시 */}
                     {/* 썸네일 필터(opacity/contrast/brightness/grayscale)는 실제 템플릿의
                         .custom-nav > .btn-nav[data-type="image"] 스타일과 동일하게 맞췄습니다. */}
                     {(pageData || []).length > 1 && (
                       <>
                         {activeViewIdx > 0 && (
                           <>
                             <div className="absolute left-[100px] top-[328px] w-[149px] h-[84px] rounded-xl overflow-hidden border-[3px] border-[#cfd4d9] bg-gray-100">
                               <img src={pageData[activeViewIdx - 1]?.bgSrc} alt="이전 컷" className="w-full h-full object-cover" style={{ filter: 'opacity(0.85) contrast(0.65) brightness(1.15) grayscale(0.15)' }} />
                             </div>
                             <button onClick={() => setActiveViewIdx(activeViewIdx - 1)} className="absolute left-[271px] top-[336px] w-[40px] h-[68px] flex items-center justify-center cursor-pointer" aria-label="이전 컷 보기">
                               <svg width="24" height="40" viewBox="0 0 24 40"><polyline points="18,4 6,20 18,36" fill="none" stroke="#5cb85c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                             </button>
                           </>
                         )}
                         {activeViewIdx < pageData.length - 1 && (
                           <>
                             <button onClick={() => setActiveViewIdx(activeViewIdx + 1)} className="absolute left-[969px] top-[336px] w-[40px] h-[68px] flex items-center justify-center cursor-pointer" aria-label="다음 컷 보기">
                               <svg width="24" height="40" viewBox="0 0 24 40"><polyline points="6,4 18,20 6,36" fill="none" stroke="#5cb85c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                             </button>
                             <div className="absolute left-[1031px] top-[328px] w-[149px] h-[84px] rounded-xl overflow-hidden border-[3px] border-[#cfd4d9] bg-gray-100">
                               <img src={pageData[activeViewIdx + 1]?.bgSrc} alt="다음 컷" className="w-full h-full object-cover" style={{ filter: 'opacity(0.85) contrast(0.65) brightness(1.15) grayscale(0.15)' }} />
                             </div>
                           </>
                         )}
                       </>
                     )}
 
                     {/* 인터랙티브 드래그 가능 말풍선 (260601 원본 padding/색상 값 그대로 적용) */}
                     <div onMouseDown={(e) => handleMouseDown(e, activeData.id)} style={{ position: 'absolute', left: activeData.bubble.x, top: activeData.bubble.y, width: activeData.bubble.width, minHeight: 80, padding: activeData.text?.type === 'zipper' ? '5px 10px 42px 17px' : '20px 10px 52px 17px', borderRadius: 20, backgroundColor: activeData.bubble.bg_color || '#FFFFFF', border: `3px solid ${activeData.bubble.border_color || '#000000'}`, zIndex: 2 }} className={`cursor-move flex flex-col ${draggingBoxId === activeData.id ? 'ring-4 ring-emerald-500 shadow-2xl' : 'shadow-lg'}`}>
 
                       {/* 말풍선 꼬리(포인터) — 꼬리 방향/위치는 getTailStyle, 뾰족한 끝 방향은 tail_tip으로 결정 */}
                       <svg className="bubble-tail-svg" style={getTailStyle(activeData.bubble)} viewBox="0 0 60 50">
                           {(() => {
                              const tailTip = activeData.bubble?.tail_tip || 'right';
                              const pathD = tailTip === 'left' ? "M 55,0 Q 45,35 5,45 Q 25,20 25,0" : "M 5,0 Q 15,35 55,45 Q 35,20 35,0";
                              return (
                                <>
                                  <path d={`${pathD} Z`} fill={activeData.bubble?.bg_color || '#FFFFFF'} />
                                  <path d={pathD} fill="none" stroke={activeData.bubble?.border_color || '#000000'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                              )
                           })()}
                       </svg>
 
                       <div style={{ fontFamily: 'sans-serif', fontSize: 27, fontWeight: 'bold', lineHeight: activeData.text?.type === 'lines' ? 1.5 : 0.85, color: '#000', wordBreak: 'keep-all' }}>
                         {activeData.text?.type === 'lines' ? (
                           // 💡 실제 템플릿(view01.js)과 동일: lines 그룹 전체가 1개 오디오, 줄마다 en(block) + ko(그 바로 뒤)
                           (activeData.text?.eng?.[0]?.lines || []).map((line, lIdx) => (
                             <div key={lIdx} style={{ marginTop: lIdx === 0 ? 0 : 8 }}>
                               <div style={{ display: 'block' }}>{String(line.en || "텍스트")}</div>
                               {line.ko ? <div style={{ display: 'block', fontSize: 18, fontWeight: 'bold', color: '#06c', marginTop: 2 }}>{String(line.ko)}</div> : null}
                             </div>
                           ))
                         ) : activeData.text?.type === 'zipper' ? (
                           // 💡 [수정 10 - 실제 템플릿 로직 그대로] 문장들을 문장 경계와 상관없이 자연스럽게
                           // 흐르도록(inline) 배치하고, 각 문장은 절대 쪼개지 않아 hover/클릭 그룹이 유지됩니다.
                           // 한글 해석은 useLayoutEffect의 실측 로직(zipperKorFragments)이 절대위치로 배치합니다.
                           <div ref={zipperFlowRef} style={{ position: 'relative', wordBreak: 'keep-all' }}>
                             {(activeData.text?.eng || []).map((item, engIdx) => (
                               <span
                                 key={engIdx}
                                 className="zline-sentence-el"
                                 data-idx={engIdx}
                                 style={{ display: 'inline', lineHeight: 2.2 }}
                                 dangerouslySetInnerHTML={{ __html: String(item.sentence || "텍스트") + ' ' }}
                               />
                             ))}
                             {zipperKorFragments.map(frag => (
                               <div key={frag.key} style={{ position: 'absolute', top: frag.top, left: frag.left, maxWidth: frag.maxWidth, fontFamily: 'NanumGothicBold, sans-serif', fontSize: 17, color: '#06c', lineHeight: 1.2, margin: 0, pointerEvents: 'none' }}>
                                 {frag.text}
                               </div>
                             ))}
                           </div>
                         ) : (
                           // 💡 inline: 실제 템플릿처럼 전체를 한 줄(nowrap)로 이어붙임 — 넘치면 잘릴 수 있으니
                           // 글자 수가 너무 길면 애초에 inline이 아니라 zipper로 판정되어야 함을 눈으로 확인 가능
                           <>
                             <div style={{ whiteSpace: 'nowrap' }}>
                               {(activeData.text?.eng || []).map((item, engIdx) => (
                                 <span key={engIdx} dangerouslySetInnerHTML={{ __html: String(item.sentence || "텍스트 ") }} style={{ display: 'inline', marginRight: 5 }} />
                               ))}
                             </div>
                             {(activeData.text?.eng || []).some(item => item.kor) ? (
                               <div style={{ fontSize: 18, fontWeight: 'bold', color: '#06c', marginTop: 4, whiteSpace: 'normal' }}>
                                 {(activeData.text?.eng || []).map(item => item.kor).filter(Boolean).join(' ')}
                               </div>
                             ) : null}
                           </>
                         )}
                       </div>
 
                       {/* 해석 버튼 (모든 유형 공통, 원본과 동일) */}
                       <button style={{ position: 'absolute', left: 17, bottom: 10, minWidth: 75, height: 32, fontSize: 14, fontWeight: 'bold', color: '#fff', backgroundColor: '#24a683', borderRadius: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 15px 2px', pointerEvents: 'none', border: 'none' }}>해석</button>
                     </div>
 
                     {/* 💡 [수정 3] 공통 설정 > 내용 더 보기 토글(globalData.more_content.has_content)과 미리보기 연동 */}
                     {/* 260601 원본 그대로: 정확한 좌표(left:96.5, top:563.15)와 색상(#ee6f00), 실제 화살표 아이콘 에셋 사용 */}
                     {globalData.more_content.has_content ? (
                       <button style={{ position: 'absolute', left: 96.5, top: 563.15, minWidth: 140, minHeight: 35, fontFamily: 'sans-serif', fontSize: 18, color: '#fff', backgroundColor: '#ee6f00', borderRadius: 50, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 5px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                         내용 더 보기<span style={{ width: 10, height: 16, marginLeft: 5, background: 'url(https://aidtcdn-dev.aitextbook.co.kr/lcms/m2_engl_00_l2/tbset/common1/images/icon/icon_arrow_0.svg) 0 0 / 10px 16px no-repeat' }}></span>
                       </button>
                     ) : null}
                   </>
                )}
 
                 {/* 🗣️ 롤플레이 뷰어 (A형 및 B형 분기 렌더링) */}
                 {(contentType === 'roleplay_a' || contentType === 'roleplay_b' || contentType === 'roleplay_c') && (
                     <div style={{ position: 'relative', width: '100%', height: '100%', paddingTop: '100px' }}>
                        {/* 💡 [C형 전용 좌표] 마스터 템플릿 CSS 확정값: .btn-eg{left:1064,top:250,z-index:2} —
                            C형은 대사 박스(left:156,top:237,width:968)가 넓어서, e.g. 배지가 그 박스
                            우상단 안쪽(box right 1124 - 60 여백)에 위치해야 한다. A/B형은 기존 좌표 유지. */}
                        <div style={{ position: 'absolute', top: contentType === 'roleplay_c' ? 250 : 210, left: contentType === 'roleplay_c' ? 1064 : 40, width: 45, height: 35, backgroundColor: '#b5eae6', borderRadius: 20, display: 'flex', justifyItems: 'center', justifyContent: 'center', alignItems: 'center', color: '#008b8b', fontWeight: 'bold', fontSize: 18, zIndex: 2 }}>e.g.</div>
 
                        <div style={{ position: 'absolute', left: 404.6, top: 143.75, width: 183, height: 80, border: '2px solid #e2e8f0', borderRadius: '40px', backgroundColor: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                           <button style={{ padding: '5px 10px', color: '#9ca3af', fontWeight: 'bold', border: 'none', background: 'transparent' }}>A</button>
                           <button style={{ padding: '5px 10px', color: '#9ca3af', fontWeight: 'bold', border: 'none', background: 'transparent' }}>B</button>
                           <button style={{ padding: '5px 10px', color: '#9ca3af', fontWeight: 'bold', border: 'none', background: 'transparent' }}>A&B</button>
                        </div>
                        <div style={{ position: 'absolute', left: 619.1, top: 144.75, display: 'flex', gap: '10px' }}>
                           <button style={{ height: 37, padding: '0 15px', backgroundColor: '#f45d94', color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '17px' }}>🎤 시작하기</button>
                           <button style={{ height: 37, padding: '0 15px', backgroundColor: '#6083e4', color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '17px' }}>대사 가리기</button>
                        </div>
                        <div style={{ position: 'absolute', left: 626.6, top: 193.75, width: 240, height: 10, backgroundColor: '#e6e6e6', borderRadius: '20px' }}></div>
 
                        {/* 💡 [분기] Roleplay B형 레이아웃: 표 퀴즈가 없고, 대본이 가로 740px 크기로 시원하게 꽉 채워지는 구조 */}
                        {contentType === 'roleplay_b' ? (
                          <>
                             {/* 좌측 장면 이미지 — 업로드된 이미지가 있으면 실제 미리보기, 없으면 플레이스홀더 */}
                             <div style={{ position: 'absolute', left: 40, top: 256, width: 420, height: 290, border: '1px solid #ddd', borderRadius: '20px', backgroundColor: '#fafafa', overflow: 'hidden' }}>
                                {activeData.rolePlayImageSrc ? (
                                   <img src={activeData.rolePlayImageSrc} alt={activeData.rolePlayImage || '장면 이미지'} className="w-full h-full object-cover" />
                                ) : (
                                   <div style={{ width: '100%', height: '100%', display: 'flex', flexFlow: 'column', alignItems: 'center', justifyContent: 'center', color: '#888', fontStyle: 'italic', fontSize: '14px' }}>
                                      <span style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</span>
                                      {activeData.rolePlayImage || "RolePlay_img_X.png"}
                                   </div>
                                )}
                             </div>

                             {/* B형 전용 740px 대형 대본 영역 — 마스터 템플릿(view01.css) 확인 결과, 실측 절대배치가
                                 아니라 .sentence-group(flex-column) 구조로 영어 문장 바로 아래에 한글이 자연스럽게
                                 흐른다. emp 강조색은 view01.css 정의값(col-0=#b42c13, col-1=#018f9e, col-2=#e0629d)과
                                 동일하게 맞춘다. */}
                             <style>{`.rpb-script .emp.col-0{color:#b42c13}.rpb-script .emp.col-1{color:#018f9e}.rpb-script .emp.col-2{color:#e0629d}`}</style>
                             <div className="rpb-script" style={{ position: 'absolute', left: 485, top: 251, width: 740, height: 360, backgroundColor: '#f4f4f4', borderRadius: '20px 20px 0 0', padding: '32px 30px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                   {(activeData.dialogues || []).map((item, dialIdx) => (
                                      <div key={dialIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                         <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#8c8c8c', width: '35px', fontFamily: 'sans-serif', lineHeight: '1.2' }}>{String(item.speaker || '')}:</div>
                                         <div style={{ flex: 1 }}>
                                            <span className="sentence-group" style={{ display: 'inline-flex', flexDirection: 'column', verticalAlign: 'top' }}>
                                               <span
                                                  className="text-eng"
                                                  style={{ display: 'inline-block', width: 'fit-content', fontSize: '26px', fontWeight: 'bold', color: '#000', fontFamily: 'sans-serif', lineHeight: '1.2', wordBreak: 'keep-all' }}
                                                  dangerouslySetInnerHTML={{ __html: String(item.sentence || "영어 대사") }}
                                               />
                                               <div className="text-kor" style={{ display: 'block', fontSize: '16px', color: '#06c', fontWeight: 'bold', marginTop: 1, lineHeight: '1.0', wordBreak: 'keep-all' }}>{item.kor}</div>
                                            </span>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>

                             {/* B형 Scene 전환 패널 버튼 세트 시각화 + 씬 추가/삭제 — 마스터 템플릿
                                 (view01.js renderRolePlay)이 반영한 폭 초과 수정과 동일한 계산식을 그대로
                                 포팅한다: 버튼 행 전체 폭은 항상 메인 이미지 폭(420px)에 맞추고, 씬 개수(N)가
                                 늘어나면 버튼 1개당 폭과 내부 썸네일 크기가 비례해서 줄어든다(2-30 참고). */}
                             {(() => {
                               const PANEL_ROW_WIDTH = 420;
                               const PANEL_ROW_GAP = 6;
                               const THUMB_NATIVE_W = 84;
                               const THUMB_NATIVE_H = 57;
                               const sceneCount = pageData.length;
                               const btnWidth = sceneCount > 0 ? (PANEL_ROW_WIDTH - (sceneCount - 1) * PANEL_ROW_GAP) / sceneCount : PANEL_ROW_WIDTH;
                               const thumbScale = Math.min(1, btnWidth / THUMB_NATIVE_W);
                               return (
                                 <div className="rpb-panel-btns" style={{ position: 'absolute', top: 549, left: 54.5, display: 'flex', gap: `${PANEL_ROW_GAP}px`, alignItems: 'center', pointerEvents: 'auto' }}>
                                   {pageData.map((scene, idx) => (
                                     <button
                                       key={scene.id || idx}
                                       onClick={() => setActiveViewIdx(idx)}
                                       className="group"
                                       style={{
                                         width: `${btnWidth}px`,
                                         flexShrink: 0,
                                         height: '75px',
                                         borderRadius: '10px',
                                         backgroundColor: idx === activeViewIdx ? '#e5f2ff' : '#fafafa',
                                         border: idx === activeViewIdx ? '4px solid #ffcc00' : '1px solid #ddd',
                                         display: 'flex',
                                         alignItems: 'center',
                                         justifyContent: 'center',
                                         position: 'relative',
                                         cursor: 'pointer'
                                       }}
                                     >
                                        <span style={{ position: 'absolute', top: 2, left: 4, fontSize: '9px', fontWeight: 'bold', color: '#444' }}>Scene {idx+1}</span>
                                        {pageData.length > 1 && (
                                          <span
                                            onClick={(e) => { e.stopPropagation(); deleteSceneB(idx); }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fee2e2', color: '#ef4444', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                          >✕</span>
                                        )}
                                        <div style={{ width: `${THUMB_NATIVE_W * thumbScale}px`, height: `${THUMB_NATIVE_H * thumbScale}px`, border: '1px dashed #ccc', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#999' }}>
                                           {scene.panelBtnImageSrc ? (
                                             <img src={scene.panelBtnImageSrc} alt={scene.panelBtnImage || '썸네일'} className="w-full h-full object-cover" />
                                           ) : (scene.panelBtnImage || "mini.png")}
                                        </div>
                                     </button>
                                   ))}
                                   <button
                                     onClick={addSceneB}
                                     style={{ width: '60px', flexShrink: 0, height: '75px', borderRadius: '10px', border: '2px dashed #14b8a6', backgroundColor: '#f0fdfa', color: '#0d9488', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                   >+ 씬</button>
                                 </div>
                               );
                             })()}
                          </>
                        ) : contentType === 'roleplay_c' ? (
                          /* 💡 [C형 — 실제 마스터 템플릿(view01.js/html/css) 확인 결과 반영]
                             표 퀴즈가 아니라, 화면 하단 좌우 화살표+점(dots)으로 넘겨보는 여러
                             "페이지"(대화 갈래, 예: Yes/No 분기) 구조. 대사 박스는 표 퀴즈가 있던
                             공간까지 포함해 넓게 차지한다(마스터 CSS 확정값: left:156, top:237,
                             width:968, height:376 — .role-play-script-page도 동일 left/width). */
                          <>
                             <style>{`.rp-script-c .emp.col-0{color:#b42c13}.rp-script-c .emp.col-1{color:#018f9e}.rp-script-c .emp.col-2{color:#e0629d}`}</style>
                             {/* 💡 실제 마스터 DOM 구조: .role-play-script(바깥, overflow 없음, 해석 버튼이
                                 여기 자식으로 붙음) > scrollBox(안쪽, overflowY:auto, 대사 턴들만 담음).
                                 해석 버튼이 스크롤 영역 밖(bottom:-50)에 위치해야 해서 두 겹으로 나눈다. */}
                             <div ref={rolePlayScriptRefC} className="rp-script-c" style={{ position: 'absolute', left: 156, top: 237, width: 968, height: 376, backgroundColor: '#f4f4f4', borderRadius: '20px 20px 0 0' }}>
                                {/* 💡 [겹침 방지] e.g. 배지(left:1064~1109, 박스 기준 우측에서 60px 지점)가 대사
                                    텍스트/스크롤바와 같은 x축 구간에 있어, 대사가 길어져 스크롤이 생기면 배지 밑을
                                    텍스트가 지나가며 겹친다. 우측 패딩을 배지 폭+여백만큼(70px) 확보해 항상 그
                                    구간 앞에서 줄바꿈되게 한다 — 마스터 템플릿도 동일 문제가 있어 별도 요청함. */}
                                <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '15px 70px 15px 30px', boxSizing: 'border-box' }}>
                                   <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'center' }}>
                                      {(activeData.dialogues || []).map((turn, dialIdx) => {
                                         const lines = (turn.lines && turn.lines.length > 0)
                                            ? turn.lines
                                            : [{ sentence: turn.sentence || '', kor: turn.kor || '', hasBlank: turn.hasBlank || false }];

                                         return (
                                            <div key={dialIdx} data-turn-idx={dialIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '18px' }}>
                                               <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#8c8c8c', width: '35px', fontFamily: 'sans-serif', lineHeight: '1.8' }}>{String(turn.speaker || '')}:</div>
                                               <div className="rp-turn-content" style={{ flex: 1, position: 'relative', paddingRight: '47px', minHeight: 40 }}>
                                                  <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#000', fontFamily: 'sans-serif', lineHeight: '1.8', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                     {lines.map((line, lineIdx) => (
                                                        <React.Fragment key={lineIdx}>
                                                           <span className="rp-line-eng" dangerouslySetInnerHTML={{ __html: line.hasBlank ? renderBracketAsEmpPreview(line.sentence || "영어 대사", line.blankColor) : (line.sentence || "영어 대사") }} />{' '}
                                                        </React.Fragment>
                                                     ))}
                                                  </div>
                                                  {roleplayCKorFragments.filter(f => f.turnIdx === dialIdx).map(f => (
                                                     <div key={f.key} style={{ position: 'absolute', left: f.left, top: f.top, maxWidth: f.maxWidth, fontSize: '15px', color: '#06c', fontWeight: 'bold', lineHeight: '1.8' }}>{f.text}</div>
                                                  ))}
                                               </div>
                                            </div>
                                         );
                                      })}
                                   </div>
                                </div>

                                {/* 💡 [C형] 해석 버튼 — 실제 마스터 CSS(.role-play-btn-translate-con)는 대사 박스
                                    자신의 자식(DOM 중첩)이라, bottom/right가 박스 자신을 기준으로 계산된다.
                                    C형은 저장 버튼이 없고(bottom-section 전체 숨김) 해석 버튼만 박스에 붙는다. */}
                                <div style={{ position: 'absolute', bottom: -50, right: 0, padding: '15px 10px 10px', backgroundColor: '#f4f4f4', borderRadius: '0 0 30px 30px' }}>
                                   <button style={{ height: 33, padding: '0 15px', backgroundColor: '#1f93a7', color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '17px' }}>💬 해석</button>
                                </div>
                             </div>

                             {/* 페이지(대화 갈래) 이동 — 마스터의 .role-play-script-page(좌우 화살표 + dots) 재현 */}
                             <div style={{ position: 'absolute', left: 156, top: 626, width: 968, height: 31, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
                                <button
                                   onClick={() => setActiveViewIdx(Math.max(0, activeViewIdx - 1))}
                                   disabled={activeViewIdx === 0}
                                   style={{ width: 20, height: 31, border: 'none', background: 'transparent', cursor: activeViewIdx === 0 ? 'default' : 'pointer', opacity: activeViewIdx === 0 ? 0.3 : 1 }}
                                   aria-label="이전 페이지"
                                >◀</button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 10px' }}>
                                   {(pageData || []).map((page, idx) => (
                                      <button
                                         key={page.id}
                                         onClick={() => setActiveViewIdx(idx)}
                                         style={{ width: 21, height: 21, borderRadius: '50%', border: 'none', backgroundColor: idx === activeViewIdx ? '#f6570d' : '#e7ddd3', color: '#fff', fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}
                                         aria-label={`${idx + 1}페이지로 이동`}
                                      >{idx + 1}</button>
                                   ))}
                                </div>
                                <button
                                   onClick={() => setActiveViewIdx(Math.min((pageData || []).length - 1, activeViewIdx + 1))}
                                   disabled={activeViewIdx === (pageData || []).length - 1}
                                   style={{ width: 20, height: 31, border: 'none', background: 'transparent', cursor: activeViewIdx === (pageData || []).length - 1 ? 'default' : 'pointer', opacity: activeViewIdx === (pageData || []).length - 1 ? 0.3 : 1 }}
                                   aria-label="다음 페이지"
                                >▶</button>
                             </div>
                          </>
                        ) : (
                          /* 기존 롤플레이 A형 레이아웃 */
                          <>
                             {/* 💡 마스터(view01.js buildRolePlay) 구조: .role-play-script(padding: 0 30px, 스크롤바용 padding-right:10px) 안에
                                  JS가 새로 만드는 scrollBox(paddingTop/Bottom:15px)가 중첩됨 → 합쳐서 top/bottom 15px, left 30px, right 10px.
                                  내부 콘텐츠는 minHeight:100%+justifyContent:center로 짧을 때 수직 중앙 정렬됨. 턴 사이 간격은
                                  .talk{margin-bottom:18px} 하나뿐(별도 gap 없음 — gap을 같이 쓰면 간격이 두 배로 겹친다). */}
                             {/* 💡 [강조 표현 색상] B형(2-27~2-28)과 동일한 3색 — 사용자가 텍스트 선택 후
                                 색상 버튼으로 <span class='emp col-N'>를 직접 만들어 넣으므로, 여기서도
                                 그 결과가 그대로 색으로 보이도록 스코프를 맞춰 정의한다. */}
                             <style>{`.rp-script .emp.col-0{color:#b42c13}.rp-script .emp.col-1{color:#018f9e}.rp-script .emp.col-2{color:#e0629d}`}</style>
                             <div ref={rolePlayScriptRef} className="rp-script" style={{ position: 'absolute', left: 40, top: 256, width: 660, height: 340, backgroundColor: '#f4f4f4', borderRadius: '20px 20px 0 0', padding: '15px 10px 15px 30px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'center' }}>
                                   {(activeData.dialogues || []).map((turn, dialIdx) => {
                                      const lines = (turn.lines && turn.lines.length > 0)
                                         ? turn.lines
                                         : [{ sentence: turn.sentence || '', kor: turn.kor || '', hasBlank: turn.hasBlank || false }];

                                      return (
                                         <div key={dialIdx} data-turn-idx={dialIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '18px' }}>
                                            <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#8c8c8c', width: '35px', fontFamily: 'sans-serif', lineHeight: '1.8' }}>{String(turn.speaker || '')}:</div>
                                            <div className="rp-turn-content" style={{ flex: 1, position: 'relative', paddingRight: '47px', minHeight: 40 }}>
                                               <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#000', fontFamily: 'sans-serif', lineHeight: '1.8', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                  {lines.map((line, lineIdx) => (
                                                     <React.Fragment key={lineIdx}>
                                                        <span className="rp-line-eng" dangerouslySetInnerHTML={{ __html: line.hasBlank ? renderBracketAsEmpPreview(line.sentence || "영어 대사", line.blankColor) : (line.sentence || "영어 대사") }} />{' '}
                                                     </React.Fragment>
                                                  ))}
                                               </div>
                                               {roleplayKorFragments.filter(f => f.turnIdx === dialIdx).map(f => (
                                                  <div key={f.key} style={{ position: 'absolute', left: f.left, top: f.top, maxWidth: f.maxWidth, fontSize: '15px', color: '#06c', fontWeight: 'bold', lineHeight: '1.8' }}>{f.text}</div>
                                               ))}
                                            </div>
                                         </div>
                                      );
                                   })}
                                </div>
                             </div>

                             {/* Table Quiz */}
                             <div style={{ position: 'absolute', left: 710, top: 255, width: 530, height: 'auto', border: '1px solid #a0d0d9', borderRadius: '16px', backgroundColor: '#fff', overflow: 'hidden' }}>
                                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'center' }}>
                                   <thead>
                                      <tr>
                                         {(activeData.tableQuiz?.headers || []).map((h, i) => (
                                            <th key={i} style={{ width: tableQuizColWidths[i], backgroundColor: '#84d8e5', height: 50, borderRight: i < 2 ? '1px solid #fff' : 'none', fontSize: '25px', color: '#20505e', fontFamily: 'sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px' }}>
                                               {String(h.text || '')}
                                            </th>
                                         ))}
                                      </tr>
                                   </thead>
                                   <tbody>
                                      <tr>
                                         {(activeData.tableQuiz?.staticRow || []).map((col, i) => {
                                            const textVal = typeof col === 'string' ? col : (col.text || '');
                                            const audioVal = typeof col === 'string' ? '' : (col.audioId || '');
                                            return (
                                               <td key={i} style={{ width: tableQuizColWidths[i], height: 50, borderRight: i < 2 ? '1px solid #a0d0d9' : 'none', borderBottom: '1px solid #a0d0d9', fontWeight: 'bold', color: textVal ? '#4b5563' : '#c1c7d3', fontSize: '22px', position: 'relative', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px' }}>
                                                  {i === 0 && <span style={{position: 'absolute', top: '15px', left: '-5px', backgroundColor: '#b5eae6', borderRadius: '10px', padding: '2px 6px', color: '#008b8b', fontSize: '12px', fontWeight: 'bold'}}>e.g.</span>}
                                                  {String(textVal || INIT_ROLEPLAY_DATA.tableQuiz.staticRow[i]?.text || "예시")}
                                                  {audioVal && <span style={{fontSize:'12px', position: 'absolute', right: '5px', bottom: '5px'}}>🔊</span>}
                                               </td>
                                            );
                                         })}
                                      </tr>
                                      {/* 💡 [대체 텍스트 자동 표시] 뷰어 엔진이 자동으로 생성하는 N번째 줄 대체텍스트를 캔버스에 시각적으로 표시 */}
                                      {Array.from({ length: activeData.tableQuiz?.rowCount || 3 }).map((_, rIdx) => (
                                         <tr key={rIdx}>
                                            {(activeData.tableQuiz?.headers || []).map((h, cIdx) => {
                                               const headerText = h.text || (cIdx + 1 + "열");
                                               const autoAriaLabel = `${rIdx + 1}번째 줄 ${headerText} 입력칸`;
                                               return (
                                                  <td key={cIdx} style={{ width: tableQuizColWidths[cIdx], height: 50, borderRight: cIdx < 2 ? '1px solid #a0d0d9' : 'none', borderBottom: rIdx < (activeData.tableQuiz?.rowCount || 3) - 1 ? '1px solid #a0d0d9' : 'none' }}>
                                                     <div style={{ fontSize: '15px', color: '#c1c7d3', minHeight: '30px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>{autoAriaLabel}</div>
                                                  </td>
                                               );
                                            })}
                                         </tr>
                                      ))}
                                   </tbody>
                                </table>
                             </div>
                          </>
                        )}
 
                        {/* 💡 [A/B형] 해석/저장 버튼 — 기존 그대로 유지(픽스 대상 아님) */}
                        {contentType !== 'roleplay_c' && (
                          <>
                            <div style={{ position: 'absolute', bottom: -50, right: 0, padding: '15px 10px 10px', backgroundColor: '#f4f4f4', borderRadius: '0 0 30px 30px' }}>
                               <button style={{ height: 33, padding: '0 15px', backgroundColor: '#1f93a7', color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '17px' }}>💬 해석</button>
                            </div>

                            <div style={{ position: 'absolute', bottom: 57, right: 40, display: 'flex', gap: '5px' }}>
                               <button style={{ height: 40, padding: '0 15px', backgroundColor: '#7177e0', color: '#fff', border: 'none', borderRadius: '50px', fontSize: '18px', fontWeight: 'bold' }}>저장</button>
                            </div>
                          </>
                        )}
                     </div>
                  )}
 
               </div>
            </div>
          </div>
 
          {/* 우측 속성 제어 사이드바 */}
          <div className="w-[430px] bg-white flex flex-col h-full shadow-[-4px_0_15px_rgba(0,0,0,0.1)] border-l border-gray-200 z-40 shrink-0">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-gray-800">속성 편집 <span className="text-emerald-600">{contentType === 'roleplay_b' ? `(Scene 0${activeViewIdx + 1})` : (contentType === 'roleplay_a' || contentType === 'roleplay_c') ? `(${getDisplayTypeName(contentType, globalData.header.text)})` : `(View ${activeData.view})`}</span></h2>
            </div>
            
            <div className="flex border-b border-gray-200 shrink-0">
              <button onClick={() => setActiveTab('view')} className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'view' ? 'border-b-2 border-emerald-500 text-emerald-700 bg-white' : 'text-gray-500 hover:bg-gray-50'}`}>🔘 {contentType === 'understand' ? 'View 개별 속성' : contentType === 'roleplay_b' ? '장면 대본 편집' : '대본/퀴즈 편집'}</button>
              <button onClick={() => setActiveTab('global')} className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'global' ? 'border-b-2 border-emerald-500 text-emerald-700 bg-white' : 'text-gray-500 hover:bg-gray-50'}`}>🌐 공통 설정 (전체)</button>
            </div>
 
            <div className="p-5 flex-1 overflow-y-auto space-y-6 font-sans">
              
              {activeTab === 'view' ? (
                <div className="space-y-6 animate-none">
                  
                  {/* Understand 모드 개별 컷 에디터 */}
                  {contentType === 'understand' && (
                    <>
                      <section className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <h3 className="font-bold text-sm text-emerald-800 mb-2 flex items-center gap-1"><span>🖼️</span> 메인 이미지 설정</h3>
                        <input type="file" accept="image/*" onChange={handleBgSwap} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer mb-3" />
                        <div className="pt-3 border-t border-emerald-200">
                          <label className="block text-emerald-800 text-[11px] font-bold mb-1">이미지 대체 텍스트 (image_aria_label)</label>
                          <input type="text" value={activeData.image_aria_label || ''} onChange={e => updateViewProp('image_aria_label', e.target.value)} className="w-full border border-emerald-200 p-2 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white" placeholder="시각장애인용 이미지 설명 입력..." />
                        </div>
                      </section>
 
                      <section>
                        <h3 className="font-bold text-sm text-gray-700 border-b pb-2 mb-3">📐 말풍선 좌표 및 크기</h3>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div><label className="block text-gray-500 text-xs mb-1">X 좌표</label><input type="number" value={activeData.bubble?.x || 0} onChange={e => updateBubbleProp('x', Number(e.target.value))} className="w-full border border-gray-300 p-2 rounded-lg bg-gray-50 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                          <div><label className="block text-gray-500 text-xs mb-1">Y 좌표</label><input type="number" value={activeData.bubble?.y || 0} onChange={e => updateBubbleProp('y', Number(e.target.value))} className="w-full border border-gray-300 p-2 rounded-lg bg-gray-50 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                          <div><label className="block text-gray-500 text-xs mb-1">너비 (W)</label><input type="number" value={activeData.bubble?.width || 0} onChange={e => updateBubbleProp('width', Number(e.target.value))} className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                        </div>
                      </section>
 
                      <section>
                        <h3 className="font-bold text-sm text-gray-700 border-b pb-2 mb-3">🎨 말풍선 꼬리</h3>
                        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                          <div><label className="block text-gray-500 text-[11px] font-bold mb-1">꼬리 방향</label><select value={activeData.bubble?.tail_dir || 'bottom'} onChange={e => updateBubbleProp('tail_dir', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer bg-white"><option value="bottom">Bottom (하단)</option><option value="top">Top (상단)</option><option value="left">Left (좌측)</option><option value="right">Right (우측)</option></select></div>
                          <div><label className="block text-gray-500 text-[11px] font-bold mb-1">꼬리 위치 (%)</label><input type="number" min="0" max="100" value={activeData.bubble?.tail_pos || 50} onChange={e => updateBubbleProp('tail_pos', Number(e.target.value))} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white" /></div>
                          <div>
                            <label className="block text-gray-500 text-[11px] font-bold mb-1">꼬리 끝 방향</label>
                            <select value={activeData.bubble?.tail_tip || 'right'} onChange={e => updateBubbleProp('tail_tip', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer bg-white">
                              <option value="right">오른쪽 휨</option>
                              <option value="left">왼쪽 휨</option>
                            </select>
                          </div>
                        </div>
                      </section>
 
                      <section>
                        <h3 className="font-bold text-sm text-gray-700 border-b pb-2 mb-3">🎨 말풍선 색상</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                          <div>
                            <label className="block text-gray-500 text-xs mb-1">배경색 (bg_color)</label>
                            <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                              <input type="color" value={activeData.bubble?.bg_color || '#ffffff'} onChange={e => updateBubbleProp('bg_color', e.target.value)} className="w-10 h-9 p-0 border-0 cursor-pointer shrink-0" />
                              <input type="text" value={activeData.bubble?.bg_color || '#ffffff'} onChange={e => updateBubbleProp('bg_color', e.target.value)} className="w-full text-xs p-2 bg-white outline-none" placeholder="#FFFFFF" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-500 text-xs mb-1">테두리색 (border_color)</label>
                            <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                              <input type="color" value={activeData.bubble?.border_color || '#000000'} onChange={e => updateBubbleProp('border_color', e.target.value)} className="w-10 h-9 p-0 border-0 cursor-pointer shrink-0" />
                              <input type="text" value={activeData.bubble?.border_color || '#000000'} onChange={e => updateBubbleProp('border_color', e.target.value)} className="w-full text-xs p-2 bg-white outline-none" placeholder="#000000" />
                            </div>
                          </div>
                        </div>
                      </section>
 
                      <section>
                        <div className="flex justify-between items-center border-b pb-2 mb-3">
                           <h3 className="font-bold text-sm text-gray-700">📝 텍스트 렌더링 타입</h3>
                           <select value={activeData.text?.type || 'inline'} onChange={(e) => handleTextTypeChange(e.target.value)} className="border border-emerald-400 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full px-3 py-1 cursor-pointer outline-none">
                             <option value="inline">Inline (한 줄 이음)</option>
                             <option value="lines">Lines (1오디오 여러 줄)</option>
                             <option value="zipper">Zipper (개별 오디오 분리)</option>
                           </select>
                        </div>
                        
                        <div className="space-y-4">
                          {activeData.text?.type === 'lines' ? (
                            (activeData.text?.eng || []).map((engItem, engIdx) => (
                              <div key={engIdx} className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl relative shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                   <label className="text-indigo-800 text-xs font-bold">오디오 ID (통합)</label>
                                   <input type="text" value={engItem.audio_id || ''} onChange={e => handleSentenceChange(engIdx, 'audio_id', e.target.value)} className="w-48 p-1.5 text-xs border border-indigo-300 rounded font-mono focus:ring-1 focus:ring-indigo-500 outline-none" placeholder="L2_039_Bridge_A_3" />
                                </div>
                                
                                <div className="space-y-2 mt-3">
                                  {(engItem.lines || []).map((line, lineIdx) => (
                                    <div key={lineIdx} className="pl-3 border-l-2 border-indigo-300 relative group">
                                      <button onClick={() => removeLine(engIdx, lineIdx)} className="absolute -right-2 top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white">✕</button>
                                      <div className="text-[10px] font-bold text-indigo-500 mb-1">Line {lineIdx + 1}</div>
                                      <input type="text" value={line.en || ''} onChange={e => handleLinesChange(engIdx, lineIdx, 'en', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded mb-1 focus:ring-1 focus:ring-indigo-500 outline-none bg-white" placeholder="영어 입력..." />
                                      <input type="text" value={line.ko || ''} onChange={e => handleLinesChange(engIdx, lineIdx, 'ko', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none bg-white" placeholder="한글 입력..." />
                                    </div>
                                  ))}
                                </div>
                                <button onClick={() => addLine(engIdx)} className="w-full mt-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-200 transition">+ 줄(Line) 추가</button>
                              </div>
                            ))
                          ) : (
                            (activeData.text?.eng || []).map((item, engIdx) => (
                               <div key={engIdx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl relative group shadow-sm">
                                 <button onClick={() => removeSentence(engIdx)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white">✕</button>
                                 <div className="text-xs font-bold text-gray-500 mb-2">문장 {engIdx + 1}</div>
                                 
                                 <label className="block text-emerald-700 text-[11px] font-bold mb-1">영어 (en)</label>
                                 <textarea value={item.sentence || ''} onChange={e => handleSentenceChange(engIdx, 'sentence', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg mb-2 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-12 bg-white" placeholder="영어 문장 입력 (<br> 사용 가능)" />
                                 
                                 <label className="block text-emerald-700 text-[11px] font-bold mb-1">한글 해석 (ko)</label>
                                 <textarea value={item.kor || ''} onChange={e => handleSentenceChange(engIdx, 'kor', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg mb-2 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-12 bg-white" placeholder="한글 해석 입력 (<br> 사용 가능)" />
                                 
                                 <label className="block text-emerald-700 text-[11px] font-bold mb-1">오디오 ID</label>
                                 <input type="text" value={item.audio_id || ''} onChange={e => handleSentenceChange(engIdx, 'audio_id', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none font-mono bg-white" placeholder="ex: L2_039_Bridge_A_1" />
                               </div>
                            ))
                          )}
                          <button onClick={addSentence} className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-100 hover:text-gray-700 transition">+ 새로운 문장 추가</button>
                        </div>
                      </section>
                    </>
                  )}
 
                  {/* 💡 [B형 전용 대본 씬 편집 드롭다운 및 폼] */}
                  {contentType === 'roleplay_b' && (
                     <>
                        <div className="border-b border-emerald-200 pb-2 mb-3">
                           <h3 className="font-bold text-sm text-emerald-800">🖼️ 장면(Scene) 전용 리소스 설정</h3>
                        </div>
                        <div className="space-y-3 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100">
                           <div>
                              <label className="block text-emerald-700 text-[11px] font-bold mb-1">상황극 이미지 업로드</label>
                              <input type="file" accept="image/*" onChange={handleSceneImageUpload} className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer" />
                              <p className="text-[10px] text-gray-400 mt-1">업로드하면 캔버스 미리보기와 하단 씬 썸네일이 자동 갱신됩니다.</p>
                           </div>
                           <div>
                              <label className="block text-emerald-700 text-[11px] font-bold mb-1">상황극 메인 이미지 파일명 (ZIP 내 경로용)</label>
                              <input type="text" value={activeData.rolePlayImage || ''} onChange={e => handleSceneBPropChange('rolePlayImage', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none font-mono focus:ring-1 focus:ring-emerald-500 bg-white" placeholder="ex: RolePlay_img_0.png" />
                           </div>
                           <div>
                              <label className="block text-emerald-700 text-[11px] font-bold mb-1">하단 썸네일 이미지 파일명 (ZIP 내 경로용)</label>
                              <input type="text" value={activeData.panelBtnImage || ''} onChange={e => handleSceneBPropChange('panelBtnImage', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none font-mono focus:ring-1 focus:ring-emerald-500 bg-white" placeholder="ex: RolePlay_img_mini_0001.png" />
                           </div>
                           <div>
                              <label className="block text-emerald-700 text-[11px] font-bold mb-1">하단 썸네일 접근성 라벨</label>
                              <input type="text" value={activeData.panelBtnLabel || ''} onChange={e => handleSceneBPropChange('panelBtnLabel', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-white" placeholder="클릭 시 해당 장면의 대화를 볼 수 있습니다." />
                           </div>
                        </div>

                        {/* 💡 [교체 후보(tips) 블록] AI가 추출한 '교체 표현 영역'을 읽기 전용으로 보여준다.
                            지면 전체에 1묶음(씬별이 아님)이라 extractedTips를 그대로 참조. 클릭/자동 삽입
                            없이 참고용 표시만 — view 자동 전개(단일 슬롯형)는 추출 단계에서 이미 끝났고,
                            조합(다중 선택지형)은 사용자가 대화 스크립트를 직접 편집해서 반영한다. */}
                        {extractedTips.length > 0 && (
                          <div className="mt-6">
                             <div className="border-b border-amber-200 pb-2 mb-3">
                                <h3 className="font-bold text-sm text-amber-800">🔤 교체 후보 (Tips)</h3>
                             </div>
                             <div className="space-y-1.5 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                                <p className="text-[10px] text-amber-700/80 mb-1">AI가 지면에서 인식한 교체 표현 후보입니다 (참고용, 대화 스크립트에 자동 반영되지 않습니다).</p>
                                {extractedTips.map((tip, tipIdx) => (
                                   <div key={tipIdx} className="text-xs text-gray-700 bg-white border border-amber-100 rounded-lg px-2.5 py-1.5">
                                      {tip}
                                   </div>
                                ))}
                             </div>
                          </div>
                        )}

                        <div className="border-b border-emerald-200 pb-2 mb-3 mt-6">
                           <h3 className="font-bold text-sm text-emerald-800">📝 장면 대화 스크립트 작성</h3>
                        </div>
                        <div className="space-y-4">
                           {(activeData.dialogues || []).map((item, dialIdx) => (
                               <div key={dialIdx} className="p-3 border rounded-xl relative group shadow-sm bg-gray-50 border-gray-200 space-y-2">
                                  <button onClick={() => handleDialogueBDelete(dialIdx)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white">✕</button>

                                  <div className="flex justify-between items-center mb-1">
                                     <div className="flex items-center gap-2">
                                        <select value={item.speaker || 'A'} onChange={e => handleDialogueBChange(dialIdx, 'speaker', e.target.value)} className="p-1 text-xs font-bold text-emerald-950 rounded bg-emerald-100 border border-emerald-300 outline-none cursor-pointer">
                                           <option value="A">A 역할</option>
                                           <option value="B">B 역할</option>
                                        </select>
                                     </div>
                                  </div>

                                  <div className="flex items-center justify-between">
                                     <label className="block text-emerald-700 text-[10px] font-bold">영어 대사</label>
                                     <div className="flex items-center gap-1">
                                        <span className="text-[9px] text-gray-400 mr-0.5">강조: 텍스트 선택 후 클릭</span>
                                        {EMP_COLORS.map(c => (
                                           <button
                                              key={c.cls}
                                              type="button"
                                              onClick={() => applyEmpColorToSelection(dialogueBSentenceRefs.current[dialIdx], item.sentence || '', c.cls, v => handleDialogueBChange(dialIdx, 'sentence', v))}
                                              className="w-4 h-4 rounded-full border border-white shadow ring-1 ring-gray-200 hover:ring-gray-400"
                                              style={{ backgroundColor: c.hex }}
                                              title={`${c.label} 강조로 감싸기`}
                                           />
                                        ))}
                                     </div>
                                  </div>
                                  <textarea
                                     ref={el => { dialogueBSentenceRefs.current[dialIdx] = el; }}
                                     value={item.sentence || ''}
                                     onChange={e => handleDialogueBChange(dialIdx, 'sentence', e.target.value)}
                                     className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none resize-none h-16 bg-white"
                                     placeholder="영어 대사 입력 (강조할 부분을 마우스로 선택한 뒤 위 색상 버튼을 누르세요)"
                                  />

                                  <label className="block text-emerald-700 text-[10px] font-bold">한글 해석</label>
                                  <textarea value={item.kor || ''} onChange={e => handleDialogueBChange(dialIdx, 'kor', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none resize-none h-12 bg-white" placeholder="한글 번역 해석" />

                                  <label className="block text-emerald-700 text-[10px] font-bold">오디오 ID</label>
                                  <input type="text" value={item.audio_id || ''} onChange={e => handleDialogueBChange(dialIdx, 'audio_id', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none font-mono bg-white" placeholder="ex: L3_001_CommB_eg_01" />
                               </div>
                           ))}
                           <button onClick={addDialogueB} className="w-full py-2 border-2 border-dashed border-emerald-300 text-emerald-600 text-xs font-bold rounded-xl hover:bg-emerald-100 transition">+ 대사 추가</button>
                        </div>
                     </>
                  )}
 
                  {/* 롤플레이 A형 - 대본 및 표 퀴즈 에디터 영역 */}
                  {contentType === 'roleplay_a' && (
                     <>
                        <div className="border-b border-purple-200 pb-2 mb-3">
                           <h3 className="font-bold text-sm text-purple-800">📝 대화 스크립트 작성</h3>
                        </div>
                        <ul className="text-[10px] leading-relaxed text-gray-400 -mt-2 mb-3 space-y-0.5 list-disc list-inside">
                           <li>실제 콘텐츠에서는 하단의 [저장] 버튼을 누르면 그 자리에서 [다시 하기] 버튼으로 바뀌어 나타납니다. 캔버스는 최초 진입 상태([저장]만 표시)만 보여줍니다.</li>
                           <li>화면 하단 스크린리더용 안내문(hiddenText)은 "공통 설정" 탭의 지시문(instruction)을 그대로 재사용해 자동으로 만들어집니다. 지시문을 수정하면 함께 바뀝니다.</li>
                        </ul>
                        <div className="space-y-4">
                           {(activeData.dialogues || []).map((turn, dialIdx) => {
                              const lines = (turn.lines && turn.lines.length > 0) ? turn.lines : [{ sentence: turn.sentence || '', kor: turn.kor || '', audio_id: turn.audio_id || '', hasBlank: turn.hasBlank || false, muteTargets: turn.muteTargets }];
                              return (
                             <div key={dialIdx} className="p-3 border rounded-xl relative group shadow-sm bg-white border-purple-200 space-y-3">
                                <button onClick={() => removeSentence(dialIdx)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white" title="이 턴(화자 전체) 삭제">✕</button>

                                <div className="flex items-center gap-2">
                                   <select value={turn.speaker || 'A'} onChange={e => handleSentenceChange(dialIdx, 'speaker', e.target.value)} className="p-1 text-xs font-bold text-purple-900 rounded bg-purple-100 border border-purple-300 outline-none cursor-pointer">
                                      <option value="A">화자 A</option>
                                      <option value="B">화자 B</option>
                                   </select>
                                   <span className="text-[10px] text-gray-400">이 턴 안에서 여러 줄(각각 별도 오디오)을 이어서 말하게 할 수 있습니다.</span>
                                </div>

                                {lines.map((line, lineIdx) => (
                                  <div key={lineIdx} className={`p-2.5 border rounded-lg relative group/line ${line.hasBlank ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                                     {lines.length > 1 && (
                                        <button onClick={() => removeDialogueLine(dialIdx, lineIdx)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover/line:opacity-100 transition-opacity hover:bg-red-500 hover:text-white" title="이 줄만 삭제">✕</button>
                                     )}
                                     <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-gray-500">{lineIdx + 1}번째 줄</span>
                                        <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 cursor-pointer bg-indigo-100 px-2 py-1 rounded">
                                          <input type="checkbox" checked={line.hasBlank || false} onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'hasBlank', e.target.checked)} className="cursor-pointer" />
                                          빈칸(오디오 묵음) 지정
                                        </label>
                                     </div>

                                     <label className="block text-emerald-700 text-[11px] font-bold mb-1">영어 대사</label>
                                     <textarea
                                        ref={el => { dialogueLineSentenceRefs.current[`${dialIdx}-${lineIdx}`] = el; }}
                                        value={line.sentence || ''}
                                        onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'sentence', e.target.value)}
                                        className={`w-full p-2 text-xs border rounded-lg mb-2 outline-none resize-none h-16 ${line.hasBlank ? 'border-indigo-300 focus:ring-1 focus:ring-indigo-500 bg-white' : 'border-gray-300 focus:ring-1 focus:ring-gray-500'}`}
                                        placeholder="영어 대사 입력"
                                     />

                                     {line.hasBlank && (
                                        <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                           <div className="flex items-center justify-between mb-1">
                                              <label className="text-amber-800 text-[11px] font-bold">빈칸으로 지정할 구간 [ ]</label>
                                              <button
                                                 type="button"
                                                 onClick={() => applyBracketToSelection(dialogueLineSentenceRefs.current[`${dialIdx}-${lineIdx}`], line.sentence || '', v => handleDialogueLineChange(dialIdx, lineIdx, 'sentence', v))}
                                                 className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded hover:bg-amber-200"
                                              >
                                                 위에서 선택한 부분 [ ]로 감싸기
                                              </button>
                                           </div>
                                           <p className="text-[10px] leading-relaxed text-amber-700 mb-1.5">
                                              위 "영어 대사"에서 정답(빈칸)이 될 부분을 마우스로 선택한 뒤 이 버튼을 누르면 <span className="font-mono">[ ]</span>로 감싸집니다.
                                              마스터 템플릿이 이 대괄호 구간을 처음엔 안 보이게, 정답 확인 시엔 아래 색으로 강조해서 보여줍니다.
                                           </p>
                                           <div className="flex items-center gap-1 mb-2">
                                              <span className="text-[10px] text-amber-700 mr-1">정답 강조색:</span>
                                              {EMP_COLORS.map((c, colorIdx) => (
                                                 <button
                                                    key={c.cls}
                                                    type="button"
                                                    onClick={() => handleDialogueLineChange(dialIdx, lineIdx, 'blankColor', colorIdx)}
                                                    className={`w-4 h-4 rounded-full shadow ring-2 ${(line.blankColor ?? 0) === colorIdx ? 'ring-gray-700' : 'ring-gray-200'}`}
                                                    style={{ backgroundColor: c.hex }}
                                                    title={c.label}
                                                 />
                                              ))}
                                           </div>
                                           <label className="block text-indigo-800 text-[11px] font-bold mb-1">
                                              오디오 묵음 타겟 (muteTargets) <span className="text-indigo-500 font-normal ml-1">※ 싱크 인덱스 입력</span>
                                           </label>
                                           <input type="text" value={line.muteTargets !== undefined ? line.muteTargets : '0'} onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'muteTargets', e.target.value)} className="w-full p-1.5 text-xs border border-indigo-300 rounded outline-none font-mono bg-white" placeholder="예: 0 또는 0, 1" />
                                           <p className="mt-1.5 text-[10px] leading-relaxed text-indigo-700">
                                              ⚠️ 별도 파일명을 지정하는 항목이 아닙니다. 마스터 템플릿은 아래 "오디오 ID"와 같은 이름에{' '}
                                              <span className="font-mono font-bold">_묵음</span>만 붙인 파일을 자동으로 찾습니다.
                                              {line.audio_id ? <> 예: <span className="font-mono font-bold">{line.audio_id}_묵음.mp3</span></> : ' 예: L1_012_CommB_eg_05_묵음.mp3'}
                                              {' '}파일을 미디어 폴더에 함께 준비해 주세요.
                                           </p>
                                        </div>
                                     )}

                                     <label className="block text-emerald-700 text-[11px] font-bold mb-1">한글 해석 (kor)</label>
                                     <textarea value={line.kor || ''} onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'kor', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg mb-2 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-12 bg-white" placeholder="한글 해석 입력" />

                                     <label className="block text-emerald-700 text-[11px] font-bold mb-1">오디오 ID</label>
                                     <input type="text" value={line.audio_id || ''} onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'audio_id', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none font-mono bg-white" placeholder="ex: L1_012_CommB_eg_05" />
                                  </div>
                                ))}

                                <button onClick={() => addDialogueLine(dialIdx)} className="w-full py-1.5 border border-dashed border-indigo-300 text-indigo-600 text-[11px] font-bold rounded-lg hover:bg-indigo-50 transition">+ 같은 화자로 줄 추가 (오디오 분리)</button>
                             </div>
                              );
                           })}
                           <button onClick={addSentence} className="w-full py-2 border-2 border-dashed border-purple-300 text-purple-600 text-xs font-bold rounded-xl hover:bg-purple-100 transition">+ 새로운 턴(화자 차례) 추가</button>
                        </div>
 
                        {/* 표 퀴즈 에디터 영역 */}
                        <div className="border-b border-purple-200 pb-2 mb-3 mt-8">
                           <h3 className="font-bold text-sm text-purple-800">📊 우측 표 퀴즈 (Table Quiz)</h3>
                        </div>

                        <ul className="text-[10px] leading-relaxed text-gray-400 -mt-1 mb-3 space-y-0.5 list-disc list-inside">
                           <li>헤더/고정 행 텍스트는 이미지에 표가 함께 있었으면 AI가 자동으로 읽어 채워둡니다. 오디오 ID는 이미지만으로 알 수 없어 항상 직접 입력해야 합니다.</li>
                           <li>자동 인식 결과는 오탈자가 있을 수 있으니 원본 이미지와 대조해서 확인해 주세요.</li>
                        </ul>

                        <div className="space-y-4">
                           {/* 1. 헤더 속성 */}
                           <div className="space-y-2">
                              <h4 className="text-[11px] font-bold text-gray-700">1. 헤더 (Headers)</h4>
                              {(activeData.tableQuiz?.headers || []).map((h, i) => (
                                 <div key={`h-${i}`} className="flex gap-2">
                                     <input type="text" value={h.text || ''} onChange={e => handleTableQuizChange('headers', i, 'text', e.target.value)} className="w-1/2 p-1.5 text-xs border border-gray-300 rounded outline-none focus:border-emerald-500 bg-white" placeholder={`열 ${i+1} 타이틀`} />
                                     <input type="text" value={h.audioId || ''} onChange={e => handleTableQuizChange('headers', i, 'audioId', e.target.value)} className="w-1/2 p-1.5 text-xs border border-gray-300 rounded font-mono outline-none focus:border-emerald-500 bg-white" placeholder="오디오 ID" />
                                 </div>
                              ))}
                           </div>
 
                           {/* 2. 고정 행 속성 */}
                           <div className="space-y-2 mt-4">
                              <h4 className="text-[11px] font-bold text-gray-700">2. 고정 행 텍스트 (Static Row)</h4>
                              <div className="flex gap-2">
                                 {(activeData.tableQuiz?.staticRow || []).map((col, i) => {
                                    const textVal = typeof col === 'string' ? col : (col.text || '');
                                    const audioVal = typeof col === 'string' ? '' : (col.audioId || '');
                                    return (
                                       <div key={`s-${i}`} className="flex flex-col gap-1 w-1/3">
                                          <span className="text-[10px] font-bold text-gray-400">열 {i+1} 텍스트/오디오</span>
                                          <input type="text" value={textVal} onChange={e => handleTableQuizChange('staticRow', i, 'text', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded outline-none focus:border-emerald-500 bg-white" placeholder={INIT_ROLEPLAY_DATA.tableQuiz.staticRow[i]?.text || "고정 텍스트"} />
                                          <input type="text" value={audioVal} onChange={e => handleTableQuizChange('staticRow', i, 'audioId', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded font-mono outline-none focus:border-emerald-500 bg-white" placeholder="오디오 ID" />
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
 
                           {/* 3. 학생 입력 빈칸(행) 개수 조절 UI */}
                           <div className="flex justify-between items-center mt-6 p-1 border-t border-dashed border-gray-300 pt-5">
                              <h4 className="text-[11px] font-bold text-gray-700 m-0">3. 퀴즈 입력 행 (Input Rows) 개수</h4>
                              <div className="flex items-center gap-1">
                                 <button onClick={removeTableQuizRow} disabled={(activeData.tableQuiz?.rowCount || 3) <= 1} className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300 disabled:opacity-50 transition">-</button>
                                 <span className="w-10 text-center text-xs font-bold text-gray-800">{activeData.tableQuiz?.rowCount || 3}</span>
                                 <button onClick={addTableQuizRow} className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300 transition">+</button>
                              </div>
                           </div>
                        </div>
                     </>
                  )}

                  {/* 💡 [C형 — A형 대본/표퀴즈 에디터를 그대로 복제] 병합 추출 레이아웃이 A형과 다르게
                      확정되면 이 블록만 독립적으로 고쳐서 반영한다(A형 에디터는 그대로 유지). CRUD
                      헬퍼 함수(handleSentenceChange 등)는 A형과 공유한다 — contentType 값만 다르게
                      받아 그대로 재사용. */}
                  {contentType === 'roleplay_c' && (
                     <>
                        <div className="border-b border-fuchsia-200 pb-2 mb-3">
                           <h3 className="font-bold text-sm text-fuchsia-800">📝 대화 스크립트 작성 (C형 · 현재 페이지 {activeViewIdx + 1})</h3>
                        </div>
                        <ul className="text-[10px] leading-relaxed text-gray-400 -mt-2 mb-3 space-y-0.5 list-disc list-inside">
                           <li>C형은 표 퀴즈 대신, 화면 하단 화살표/점(dots)으로 넘겨보는 여러 "페이지"(대화 갈래)로 구성됩니다. 페이지 전환·추가·삭제는 캔버스 상단 탭(Page 1, Page 2 ...)에서 합니다.</li>
                           <li>실제 콘텐츠에서는 하단의 [저장] 버튼을 누르면 그 자리에서 [다시 하기] 버튼으로 바뀌어 나타납니다. 캔버스는 최초 진입 상태([저장]만 표시)만 보여줍니다.</li>
                           <li>화면 하단 스크린리더용 안내문(hiddenText)은 "공통 설정" 탭의 지시문(instruction)을 그대로 재사용해 자동으로 만들어집니다. 지시문을 수정하면 함께 바뀝니다.</li>
                        </ul>
                        <div className="space-y-4">
                           {(activeData.dialogues || []).map((turn, dialIdx) => {
                              const lines = (turn.lines && turn.lines.length > 0) ? turn.lines : [{ sentence: turn.sentence || '', kor: turn.kor || '', audio_id: turn.audio_id || '', hasBlank: turn.hasBlank || false, muteTargets: turn.muteTargets }];
                              return (
                             <div key={dialIdx} className="p-3 border rounded-xl relative group shadow-sm bg-white border-fuchsia-200 space-y-3">
                                <button onClick={() => removeSentence(dialIdx)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white" title="이 턴(화자 전체) 삭제">✕</button>

                                <div className="flex items-center gap-2">
                                   <select value={turn.speaker || 'A'} onChange={e => handleSentenceChange(dialIdx, 'speaker', e.target.value)} className="p-1 text-xs font-bold text-fuchsia-900 rounded bg-fuchsia-100 border border-fuchsia-300 outline-none cursor-pointer">
                                      <option value="A">화자 A</option>
                                      <option value="B">화자 B</option>
                                   </select>
                                   <span className="text-[10px] text-gray-400">이 턴 안에서 여러 줄(각각 별도 오디오)을 이어서 말하게 할 수 있습니다.</span>
                                </div>

                                {lines.map((line, lineIdx) => (
                                  <div key={lineIdx} className={`p-2.5 border rounded-lg relative group/line ${line.hasBlank ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                                     {lines.length > 1 && (
                                        <button onClick={() => removeDialogueLine(dialIdx, lineIdx)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover/line:opacity-100 transition-opacity hover:bg-red-500 hover:text-white" title="이 줄만 삭제">✕</button>
                                     )}
                                     <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-gray-500">{lineIdx + 1}번째 줄</span>
                                        <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 cursor-pointer bg-indigo-100 px-2 py-1 rounded">
                                          <input type="checkbox" checked={line.hasBlank || false} onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'hasBlank', e.target.checked)} className="cursor-pointer" />
                                          빈칸(오디오 묵음) 지정
                                        </label>
                                     </div>

                                     <label className="block text-emerald-700 text-[11px] font-bold mb-1">영어 대사</label>
                                     <textarea
                                        ref={el => { dialogueLineSentenceRefs.current[`${dialIdx}-${lineIdx}`] = el; }}
                                        value={line.sentence || ''}
                                        onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'sentence', e.target.value)}
                                        className={`w-full p-2 text-xs border rounded-lg mb-2 outline-none resize-none h-16 ${line.hasBlank ? 'border-indigo-300 focus:ring-1 focus:ring-indigo-500 bg-white' : 'border-gray-300 focus:ring-1 focus:ring-gray-500'}`}
                                        placeholder="영어 대사 입력"
                                     />

                                     {line.hasBlank && (
                                        <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                           <div className="flex items-center justify-between mb-1">
                                              <label className="text-amber-800 text-[11px] font-bold">빈칸으로 지정할 구간 [ ]</label>
                                              <button
                                                 type="button"
                                                 onClick={() => applyBracketToSelection(dialogueLineSentenceRefs.current[`${dialIdx}-${lineIdx}`], line.sentence || '', v => handleDialogueLineChange(dialIdx, lineIdx, 'sentence', v))}
                                                 className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded hover:bg-amber-200"
                                              >
                                                 위에서 선택한 부분 [ ]로 감싸기
                                              </button>
                                           </div>
                                           <p className="text-[10px] leading-relaxed text-amber-700 mb-1.5">
                                              위 "영어 대사"에서 정답(빈칸)이 될 부분을 마우스로 선택한 뒤 이 버튼을 누르면 <span className="font-mono">[ ]</span>로 감싸집니다.
                                              마스터 템플릿이 이 대괄호 구간을 처음엔 안 보이게, 정답 확인 시엔 아래 색으로 강조해서 보여줍니다.
                                           </p>
                                           <div className="flex items-center gap-1 mb-2">
                                              <span className="text-[10px] text-amber-700 mr-1">정답 강조색:</span>
                                              {EMP_COLORS.map((c, colorIdx) => (
                                                 <button
                                                    key={c.cls}
                                                    type="button"
                                                    onClick={() => handleDialogueLineChange(dialIdx, lineIdx, 'blankColor', colorIdx)}
                                                    className={`w-4 h-4 rounded-full shadow ring-2 ${(line.blankColor ?? 0) === colorIdx ? 'ring-gray-700' : 'ring-gray-200'}`}
                                                    style={{ backgroundColor: c.hex }}
                                                    title={c.label}
                                                 />
                                              ))}
                                           </div>
                                           <label className="block text-indigo-800 text-[11px] font-bold mb-1">
                                              오디오 묵음 타겟 (muteTargets) <span className="text-indigo-500 font-normal ml-1">※ 싱크 인덱스 입력</span>
                                           </label>
                                           <input type="text" value={line.muteTargets !== undefined ? line.muteTargets : '0'} onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'muteTargets', e.target.value)} className="w-full p-1.5 text-xs border border-indigo-300 rounded outline-none font-mono bg-white" placeholder="예: 0 또는 0, 1" />
                                           <p className="mt-1.5 text-[10px] leading-relaxed text-indigo-700">
                                              ⚠️ 별도 파일명을 지정하는 항목이 아닙니다. 마스터 템플릿은 아래 "오디오 ID"와 같은 이름에{' '}
                                              <span className="font-mono font-bold">_묵음</span>만 붙인 파일을 자동으로 찾습니다.
                                              {line.audio_id ? <> 예: <span className="font-mono font-bold">{line.audio_id}_묵음.mp3</span></> : ' 예: L1_012_CommB_eg_05_묵음.mp3'}
                                              {' '}파일을 미디어 폴더에 함께 준비해 주세요.
                                           </p>
                                        </div>
                                     )}

                                     <label className="block text-emerald-700 text-[11px] font-bold mb-1">한글 해석 (kor)</label>
                                     <textarea value={line.kor || ''} onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'kor', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg mb-2 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-12 bg-white" placeholder="한글 해석 입력" />

                                     <label className="block text-emerald-700 text-[11px] font-bold mb-1">오디오 ID</label>
                                     <input type="text" value={line.audio_id || ''} onChange={e => handleDialogueLineChange(dialIdx, lineIdx, 'audio_id', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none font-mono bg-white" placeholder="ex: L1_012_CommB_eg_05" />
                                  </div>
                                ))}

                                <button onClick={() => addDialogueLine(dialIdx)} className="w-full py-1.5 border border-dashed border-indigo-300 text-indigo-600 text-[11px] font-bold rounded-lg hover:bg-indigo-50 transition">+ 같은 화자로 줄 추가 (오디오 분리)</button>
                             </div>
                              );
                           })}
                           <button onClick={addSentence} className="w-full py-2 border-2 border-dashed border-fuchsia-300 text-fuchsia-600 text-xs font-bold rounded-xl hover:bg-fuchsia-100 transition">+ 새로운 턴(화자 차례) 추가</button>
                        </div>

                        {/* 💡 페이지(대화 갈래) 관리 — B형 씬 관리 패턴과 동일하게, 현재 페이지 삭제는
                            여기서도 가능하게 해서 캔버스 상단 탭까지 안 가도 되게 한다. */}
                        <div className="border-t border-dashed border-gray-300 pt-4 mt-6 flex items-center justify-between">
                           <span className="text-[11px] text-gray-500">현재 페이지({activeViewIdx + 1}/{(pageData || []).length})를 삭제하려면:</span>
                           <button
                              onClick={() => deletePageC(activeViewIdx)}
                              disabled={(pageData || []).length <= 1}
                              className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                           >
                              이 페이지 삭제
                           </button>
                        </div>
                     </>
                  )}

                </div>
              ) : (
                <div className="animate-fade-in space-y-6">
                  <section>
                    <h3 className="font-bold text-sm text-indigo-800 border-b border-indigo-100 pb-2 mb-3 flex items-center gap-1"><span>🏷️</span> 상단 헤더 (Header)</h3>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="w-1/4">
                          <label className="block text-gray-500 text-[11px] font-bold mb-1">알파벳</label>
                          <input type="text" value={globalData.header.letter} onChange={e => updateGlobalData('header', 'letter', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-center bg-white" maxLength={1} placeholder="A" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-gray-500 text-[11px] font-bold mb-1">타이틀 텍스트</label>
                          <input type="text" value={globalData.header.text} onChange={e => updateGlobalData('header', 'text', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="Understand" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-gray-500 text-[11px] font-bold mb-1">지시문</label>
                        <textarea value={globalData.header.instruction} onChange={e => updateGlobalData('header', 'instruction', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-16 bg-white" placeholder="다음을 보고..." />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <div>
                            <label className="block text-gray-500 text-[11px] font-bold mb-1">테마 번호 (color)</label>
                            <input type="number" min="0" max="14" value={globalData.header.color} onChange={e => updateGlobalData('header', 'color', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                         </div>
                         
                         {/* 💡 [분기] 롤플레이일 때는 비디오 버튼 속성을 렌더링하지 않음 */}
                         {contentType === 'understand' && (
                           <div>
                              <label className="block text-gray-500 text-[11px] font-bold mb-1">영상 버튼 대체텍스트</label>
                              <input type="text" value={globalData.header.btn_aria_label} onChange={e => updateGlobalData('header', 'btn_aria_label', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                           </div>
                         )}
                      </div>
                    </div>
                  </section>
 
                  {/* 💡 [분기] 롤플레이일 때는 비디오 팝업 정보 섹션을 렌더링하지 않음 */}
                  {contentType === 'understand' && (
                    <section>
                      <h3 className="font-bold text-sm text-indigo-800 border-b border-indigo-100 pb-2 mb-3 flex items-center gap-1"><span>🎬</span> 비디오 정보 (Video)</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-gray-500 text-[11px] font-bold mb-1">비디오 파일명 (video_file_name)</label>
                          <input type="text" value={globalData.video_file_name || ''} onChange={e => updateGlobalData(null, 'video_file_name', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono bg-white" placeholder="예: bridge_video.mp4" />
                        </div>
                        <div>
                          <label className="block text-gray-500 text-[11px] font-bold mb-1">비디오 대체 텍스트 (video_aria_label)</label>
                          <input type="text" value={globalData.video_aria_label} onChange={e => updateGlobalData(null, 'video_aria_label', e.target.value)} className="w-full border border-gray-300 p-2 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="영상에 대한 설명 입력" />
                        </div>
                      </div>
                    </section>
                  )}
 
                  {/* 💡 [분기] 롤플레이일 때는 내용 더 보기 섹션을 렌더링하지 않음 */}
                  {contentType === 'understand' && (
                    <section className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                      <div className="flex justify-between items-center mb-3">
                         <h3 className="font-bold text-sm text-indigo-800 flex items-center gap-1"><span>➕</span> 내용 더 보기</h3>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" className="sr-only peer" checked={globalData.more_content.has_content} onChange={e => updateGlobalData('more_content', 'has_content', e.target.checked)} />
                           <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                         </label>
                      </div>
                      {globalData.more_content.has_content ? (
                        <div>
                          <label className="block text-indigo-700 text-[11px] font-bold mb-1">본문 텍스트 (content_text)</label>
                          <textarea value={globalData.more_content.content_text} onChange={e => updateGlobalData('more_content', 'content_text', e.target.value)} className="w-full border border-indigo-200 p-2 text-xs rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24 bg-white" placeholder="클릭 시 확장될 본문 내용 입력" />
                        </div>
                      ) : null}
                    </section>
                  )}
                </div>
              )}
 
            </div>
            
            <div className="p-4 bg-white border-t border-gray-200 shrink-0">
              <button onClick={handleExportZip} className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-700 transition shadow-md text-[15px] flex justify-center items-center gap-2">
                <span>📦</span> 무결점 병합 추출 (전체 ZIP 다운로드)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}