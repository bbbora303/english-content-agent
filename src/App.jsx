import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
 
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
    { speaker: "A", audio_id: "", blank_audio_id: "", sentence: "Hello.", kor: "안녕.", hasBlank: false, muteTargets: "0" }
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
 
// 💡 롤플레이 (B형) 씬 기반 초기 데이터 모형 (표 퀴즈 없음)
const INIT_ROLEPLAY_B_SCENES = [
  {
    type: "B",
    sceneId: 0,
    rolePlayImage: "RolePlay_img_0.png",
    panelBtnImage: "RolePlay_img_mini_0001.png",
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
    panelBtnImage: "RolePlay_img_mini_0002.png",
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
    panelBtnImage: "RolePlay_img_mini_0003.png",
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
    panelBtnImage: "RolePlay_img_mini_0004.png",
    panelBtnLabel: "클릭 시 네 번째 상황의 대화를 볼 수 있습니다.",
    roleA: "A",
    roleB: "B",
    dialogues: [
      { speaker: "A", sentence: "I'm so thirsty.", kor: "목이 너무 말라.", audio_id: "L3_004_CommB_eg_01" }
    ]
  }
];
 
export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [templates, setTemplates] = useState({ understand: null, roleplay: null, roleplay_b: null });
 
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [contentType, setContentType] = useState('understand');
  
  const [croppedViews, setCroppedViews] = useState([]); 
  const [extractedDialogues, setExtractedDialogues] = useState([]);
 
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
      const loadedTemplates = { understand: null, roleplay: null, roleplay_b: null };
      
      // 기획 롤백 복구를 위해 가이드 ZIP 디폴트 객체 매핑 안정적 보존
      loadedTemplates.understand = { name: "Understand_Default.zip", blob: new Blob() };
      loadedTemplates.roleplay = { name: "Roleplay_A_Default.zip", blob: new Blob() };
      loadedTemplates.roleplay_b = { name: "Roleplay_B_Default.zip", blob: new Blob() };
 
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
      
      const parsedType = aiData.contentType === 'roleplay_b' ? 'roleplay_b' : (aiData.contentType === 'roleplay' ? 'roleplay' : 'understand');
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
 
      if (parsedType === 'roleplay' || parsedType === 'roleplay_b') {
          let dials = [];
          if (aiData.views && aiData.views[0] && aiData.views[0].eng) {
              dials = (aiData.views[0].eng || []).map((item, idx) => ({
                  speaker: item.speaker || (idx % 2 === 0 ? "A" : "B"),
                  sentence: item.sentence || item.en || "",
                  kor: item.kor || item.ko || "",
                  audio_id: "",
                  blank_audio_id: "",
                  hasBlank: false,
                  muteTargets: "0"
              }));
          }
          if (dials.length === 0) {
              dials = parsedType === 'roleplay_b' ? INIT_ROLEPLAY_B_SCENES[0].dialogues : INIT_ROLEPLAY_DATA.dialogues;
          }
          setExtractedDialogues(dials);
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
    } finally {
      setIsAnalyzing(false);
    }
  };
 
  const handleDialogueBChange = (dialIdx, field, value) => {
    if (contentType !== 'roleplay_b') return;
    setPageData(prev => prev.map((scene, sIdx) => {
      if (sIdx !== activeViewIdx) return scene;
      const updatedDialogues = [...(scene.dialogues || [])];
      const updatedItem = { ...updatedDialogues[dialIdx] };
      
      if (field === 'text' || field === 'translation' || field === 'audio') {
        updatedItem[field] = [value]; // B형 dialogues 뷰어 구조인 단일 원소 배열 매핑 대응
      } else {
        updatedItem[field] = value;
      }
      
      updatedDialogues[dialIdx] = updatedItem;
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
      const targetRole = (scene.dialogues || []).length % 2 === 0 ? "A" : "B";
      return {
        ...scene,
        dialogues: [...(scene.dialogues || []), { role: targetRole, text: [""], translation: [""], audio: [""] }]
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
      const initialScenes = INIT_ROLEPLAY_B_SCENES.map((scene, idx) => ({
        ...scene,
        id: `scene_b_${Date.now()}_${idx}`,
        dialogues: idx === 0 && extractedDialogues.length > 0 ? extractedDialogues.map(item => ({
          role: item.speaker || item.role || "A",
          text: [item.sentence || ""],
          translation: [item.kor || ""],
          audio: [item.audio_id || ""]
        })) : scene.dialogues
      }));
      setPageData(initialScenes);
    } else if (contentType === 'roleplay') {
      setPageData([{ ...INIT_ROLEPLAY_DATA, dialogues: extractedDialogues.length > 0 ? extractedDialogues : INIT_ROLEPLAY_DATA.dialogues, id: `box_${Date.now()}_roleplay` }]);
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
 
  const handleMouseDown = (e, id) => {
    if (contentType === 'roleplay' || contentType === 'roleplay_b') return;
    e.preventDefault();
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
    if(!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDraggingBoxId(id);
    setDragOffset({ x: (e.clientX - rect.left) / (rect.width / 1280) - activeData.bubble.x, y: (e.clientY - rect.top) / (rect.height / 720) - activeData.bubble.y });
  };
  
  const handleMouseMove = (e) => {
    if (!draggingBoxId || !containerRef.current || contentType === 'roleplay' || contentType === 'roleplay_b') return;
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
      if (idx !== activeViewIdx || contentType === 'roleplay' || contentType === 'roleplay_b') return data;
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
      if (contentType === 'roleplay') {
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
    if (contentType === 'roleplay' || contentType === 'roleplay_b') return;
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
     if (contentType === 'roleplay') {
         return { ...data, dialogues: [...(data.dialogues || []), { speaker: "A", audio_id: "", blank_audio_id: "", sentence: "", kor: "", hasBlank: false, muteTargets: "0" }] };
     }
     return { ...data, text: { ...data.text, eng: [...(data.text?.eng || []), { sentence: "", kor: "", audio_id: "" }] } };
  }));
  
  const addLine = (engIdx) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx || contentType === 'roleplay') return data;
      const newEng = [...(data.text?.eng || [])];
      newEng[engIdx].lines.push({ en: "", ko: "" });
      return { ...data, text: { ...data.text, eng: newEng } };
  }));
  
  const removeSentence = (engIdx) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx) return data;
      if (contentType === 'roleplay') {
          return { ...data, dialogues: (data.dialogues || []).filter((_, i) => i !== engIdx) };
      }
      return { ...data, text: { ...data.text, eng: (data.text?.eng || []).filter((_, i) => i !== engIdx) } };
  }));
  
  const removeLine = (engIdx, lineIdx) => setPageData(prev => (prev || []).map((data, idx) => {
      if (idx !== activeViewIdx || contentType === 'roleplay') return data;
      const newEng = [...(data.text?.eng || [])];
      newEng[engIdx].lines = (newEng[engIdx].lines || []).filter((_, i) => i !== lineIdx);
      return { ...data, text: { ...data.text, eng: newEng } };
  }));
 
  const handleGlobalDataChange = (field, value) => {
    setGlobalData(prev => ({
      ...prev,
      header: { ...prev.header, [field]: value }
    }));
  };
 
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
 
        if (contentType === 'roleplay') {
            const rowCount = Number(pageData[0]?.tableQuiz?.rowCount || 3);
 
            const roleplayExportData = {
                pageInfo: {
                    hiddenText: "평소 즐겨 하는 여가 활동을 짝과 함께 말해보는 활동입니다. 롤플레이 활동이 어려울 경우, 선생님께 도움을 요청해 보세요.", // 더보기 내용이 제거되었으므로 기본값만 유지
                    title: {
                        head: String(globalData.header.letter || ""),
                        text: String(globalData.header.text || ""),
                        color: String(globalData.header.color || "")
                    },
                    instruction: String(globalData.header.instruction || "")
                },
                howToPlay: [
                    { step: 1, tail: "left", lines: ["버튼을 눌러 예시 대화를", "확인하고 이야기해 보세요."] },
                    { step: 2, tail: "top", lines: ["역할을 선택해 보세요."] },
                    { step: 3, tail: "bottom", lines: ["내가 맡은 역할의 대사를", "가리고 말해 보세요."] },
                    { step: 4, tail: "top", lines: ["예시 대화를 참고하여 친구들과 대화한 후,", "표에 친구들의 여가 활동에 대해 써 보세요."] }
                ],
                rolePlay: {
                    toggleBtn: { ariaLabel: "클릭 시 대화창 바꾸기" },
                    // 🚀 [추출 최적화] 불필요한 구형 껍데기(blankData 등) 완벽 제거 및 순수 Flat 포맷 내보내기
                    dialogues: (pageData[0]?.dialogues || []).map(item => {
                        const lineObj = {
                            hasBlank: item.hasBlank,
                            audio: String(item.audio_id || ""),
                            eng: String(item.sentence || ""),
                            kor: String(item.kor || "")
                        };
 
                        if (item.hasBlank) {
                            // [신규] 별도 묵음 오디오 파일명 추출
                            if (item.blank_audio_id) {
                                lineObj.blankAudio = item.blank_audio_id;
                            }
 
                            lineObj.muteTargets = item.muteTargets !== undefined && String(item.muteTargets).trim() !== ""
                                ? String(item.muteTargets).split(',').map(s => Number(s.trim()))
                                : [0];
                        }
 
                        return { speaker: String(item.speaker || "A"), lines: [lineObj] };
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
                    role: String(item.speaker || item.role || "A"),
                    text: [String(item.sentence || item.text?.[0] || "")],
                    translation: [String(item.kor || item.translation?.[0] || "")],
                    audio: [String(item.audio_id || item.audio?.[0] || "")]
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
 
        const viewPageInfoData = (pageData || []).map(data => ({ url: `view${data.view}.html` }));
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
        a.download = contentType === 'roleplay' ? 'roleplay(A)_content.zip' : (contentType === 'roleplay_b' ? 'roleplay(B)_content.zip' : 'understand_content.zip');
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
            
            <div className="grid grid-cols-3 gap-6">
              {['understand', 'roleplay', 'roleplay_b'].map((type) => (
                <div key={type} className="border border-gray-200 rounded-xl p-5 bg-gray-50 flex flex-col items-center justify-between text-center relative hover:border-gray-300 transition shadow-sm">
                  {templates[type] && (
                    <button onClick={() => handleTemplateDelete(type)} className="absolute top-3 right-3 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded hover:bg-red-500 hover:text-white transition">삭제</button>
                  )}
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl mb-3 ${type === 'understand' ? 'bg-blue-100 text-blue-600' : type === 'roleplay' ? 'bg-purple-100 text-purple-600' : 'bg-teal-100 text-teal-600'}`}>
                    {type === 'understand' ? 'U' : type === 'roleplay' ? 'RA' : 'RB'}
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 mb-1">{type === 'understand' ? 'Understand 유형' : type === 'roleplay' ? 'Roleplay(A) 유형' : 'Roleplay(B) 유형'}</h3>
                  <p className="text-xs text-gray-400 h-8 mb-4">{type === 'understand' ? '말풍선 이해도 향상 코믹 콘텐츠용 마스터 소스' : type === 'roleplay' ? '역할극 대화형 콘텐츠(예: talk and complete)의 마스터 소스' : '표 퀴즈를 전면 비활성화한 씬 기반 다중 장면극 마스터 소스'}</p>
                  
                  <input type="file" accept=".zip" onChange={(e) => handleTemplateUpload(e, type)} className="hidden" id={`zip-${type}`} />
                  <label htmlFor={`zip-${type}`} className={`w-full py-2 text-white text-sm font-bold rounded-lg cursor-pointer transition block ${templates[type] ? 'bg-emerald-500 hover:bg-emerald-600' : (type === 'understand' ? 'bg-blue-600 hover:bg-blue-700' : type === 'roleplay' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-teal-600 hover:bg-teal-700')}`}>
                    {templates[type] ? `✅ ${templates[type].name.slice(0, 15)}...` : 'ZIP 마스터 템플릿 등록'}
                  </label>
                </div>
              ))}
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
                        <div className="flex justify-between text-xs border-b border-gray-200 pb-2"><span className="text-gray-500">콘텐츠 타입</span><span className="font-bold text-teal-600 uppercase">{contentType === 'understand' ? 'Understand (말풍선 기본형)' : contentType === 'roleplay' ? 'Roleplay A (표 퀴즈 결합형)' : 'Roleplay B (퀴즈 없는 대본형)'}</span></div>
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
                  {contentType === 'roleplay' && (
                    <button className="px-5 py-1.5 text-sm font-bold rounded-full bg-purple-600 text-white shadow-md">Roleplay A View</button>
                  )}
                  {contentType === 'roleplay_b' && (pageData || []).map((scene, idx) => (
                    <button key={scene.id} onClick={() => setActiveViewIdx(idx)} className={`px-5 py-1.5 text-sm font-bold rounded-full transition whitespace-nowrap ${activeViewIdx === idx ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'}`}>Scene 0{idx + 1}</button>
                  ))}
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
                       <img src={activeData.bgSrc || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=1280"} alt="Background" className="w-full h-full object-cover" />
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
                 {(contentType === 'roleplay' || contentType === 'roleplay_b') && (
                     <div style={{ position: 'relative', width: '100%', height: '100%', paddingTop: '100px' }}>
                        <div style={{ position: 'absolute', top: 210, left: 40, width: 45, height: 35, backgroundColor: '#b5eae6', borderRadius: 20, display: 'flex', justifyItems: 'center', justifyContent: 'center', alignItems: 'center', color: '#008b8b', fontWeight: 'bold', fontSize: 18 }}>e.g.</div>
 
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
                             {/* 좌측 장면 이미지 플레이스홀더 영역 */}
                             <div style={{ position: 'absolute', left: 40, top: 256, width: 420, height: 290, border: '1px solid #ddd', borderRadius: '20px', backgroundColor: '#fafafa', display: 'flex', flexFlow: 'column', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#888', fontStyle: 'italic', fontSize: '14px' }}>
                                <span style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</span>
                                {activeData.rolePlayImage || "RolePlay_img_X.png"}
                             </div>
 
                             {/* B형 전용 740px 대형 대본 영역 */}
                             <div style={{ position: 'absolute', left: 485, top: 251, width: 740, height: 360, backgroundColor: '#f4f4f4', borderRadius: '20px 20px 0 0', padding: '32px 30px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                   {(activeData.dialogues || []).map((item, idx) => {
                                       const rawSentence = Array.isArray(item.text) ? item.text[0] || "" : (item.sentence || "");
                                       const rawTranslation = Array.isArray(item.translation) ? item.translation[0] || "" : (item.kor || "");
                                       return (
                                          <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                             <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#8c8c8c', width: '35px', fontFamily: 'sans-serif', lineHeight: '1.4' }}>{String(item.role || item.speaker || '')}:</div>
                                             <div style={{ flex: 1, position: 'relative' }}>
                                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#000', fontFamily: 'sans-serif', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: String(rawSentence) }} />
                                                <div style={{ fontSize: '15px', color: '#06c', marginTop: '3px', fontWeight: 'bold', lineHeight: '1.4' }}>{String(rawTranslation)}</div>
                                             </div>
                                          </div>
                                       );
                                    })}
                                </div>
                             </div>
 
                             {/* B형 Scene 전환 패널 버튼 세트 시각화 */}
                             <div style={{ position: 'absolute', top: 549, left: 54.5, display: 'flex', gap: '6px', pointerEvents: 'auto' }}>
                               {pageData.map((scene, idx) => (
                                 <button
                                   key={scene.id || idx}
                                   onClick={() => setActiveViewIdx(idx)}
                                   style={{
                                     width: '100px',
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
                                    <div style={{ width: '84px', height: '57px', border: '1px dashed #ccc', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#999' }}>
                                       {scene.panelBtnImage || "mini.png"}
                                    </div>
                                 </button>
                               ))}
                             </div>
                          </>
                        ) : (
                          /* 기존 롤플레이 A형 레이아웃 */
                          <>
                             <div style={{ position: 'absolute', left: 40, top: 256, width: 660, height: 340, backgroundColor: '#f4f4f4', borderRadius: '20px 20px 0 0', padding: '32px 28px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                                   {(activeData.dialogues || []).map((item, idx) => {
                                      let displayEng = item.sentence || "영어 대사";
                                      if (item.hasBlank && displayEng.includes('[')) {
                                         displayEng = displayEng.replace(/\[(.*?)\]/g, "<span class='emp col-0' style='color:#b42c13; display: inline; white-space: normal; word-break: break-word; overflow-wrap: break-word;'>$1</span>");
                                      }
 
                                      return (
                                         <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '18px' }}>
                                            <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#8c8c8c', width: '35px', fontFamily: 'sans-serif', lineHeight: '1.8' }}>{String(item.speaker || '')}:</div>
                                            <div style={{ flex: 1, position: 'relative', paddingRight: '47px' }}>
                                               <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#000', fontFamily: 'sans-serif', lineHeight: '1.8', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }} dangerouslySetInnerHTML={{__html: displayEng}} />
                                               <div style={{ fontSize: '15px', color: '#06c', marginTop: '5px', fontWeight: 'bold', lineHeight: '1.8' }}>{String(item.kor || "")}</div>
                                            </div>
                                         </div>
                                      );
                                   })}
                                </div>
                             </div>
 
                             {/* Table Quiz */}
                             <div style={{ position: 'absolute', left: 710, top: 255, width: 530, height: 'auto', border: '1px solid #a0d0d9', borderRadius: '16px', backgroundColor: '#fff', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                   <thead>
                                      <tr>
                                         {(activeData.tableQuiz?.headers || []).map((h, i) => (
                                            <th key={i} style={{ backgroundColor: '#84d8e5', height: 50, borderRight: i < 2 ? '1px solid #fff' : 'none', fontSize: '25px', color: '#20505e', fontFamily: 'sans-serif' }}>
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
                                               <td key={i} style={{ height: 50, borderRight: i < 2 ? '1px solid #a0d0d9' : 'none', borderBottom: '1px solid #a0d0d9', fontWeight: 'bold', color: textVal ? '#4b5563' : '#c1c7d3', fontSize: '22px', position: 'relative' }}>
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
                                                  <td key={cIdx} style={{ height: 50, borderRight: cIdx < 2 ? '1px solid #a0d0d9' : 'none', borderBottom: rIdx < (activeData.tableQuiz?.rowCount || 3) - 1 ? '1px solid #a0d0d9' : 'none' }}>
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
 
                        {/* 해석 버튼 */}
                        <div style={{ position: 'absolute', bottom: -50, right: 0, padding: '15px 10px 10px', backgroundColor: '#f4f4f4', borderRadius: '0 0 30px 30px' }}>
                           <button style={{ height: 33, padding: '0 15px', backgroundColor: '#1f93a7', color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '17px' }}>💬 해석</button>
                        </div>
 
                        <div style={{ position: 'absolute', bottom: 57, right: 40, display: 'flex', gap: '5px' }}>
                           <button style={{ height: 40, padding: '0 15px', backgroundColor: '#ee6e32', color: '#fff', border: 'none', borderRadius: '50px', fontSize: '18px', fontWeight: 'bold' }}>다시 하기</button>
                           <button style={{ height: 40, padding: '0 15px', backgroundColor: '#7177e0', color: '#fff', border: 'none', borderRadius: '50px', fontSize: '18px', fontWeight: 'bold' }}>저장</button>
                        </div>
                     </div>
                  )}
 
               </div>
            </div>
          </div>
 
          {/* 우측 속성 제어 사이드바 */}
          <div className="w-[430px] bg-white flex flex-col h-full shadow-[-4px_0_15px_rgba(0,0,0,0.1)] border-l border-gray-200 z-40 shrink-0">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-gray-800">속성 편집 <span className="text-emerald-600">{contentType === 'roleplay_b' ? `(Scene 0${activeViewIdx + 1})` : (contentType === 'roleplay' ? '(Roleplay A)' : `(View ${activeData.view})`)}</span></h2>
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
                              <label className="block text-emerald-700 text-[11px] font-bold mb-1">상황극 메인 이미지 파일명</label>
                              <input type="text" value={activeData.rolePlayImage || ''} onChange={e => handleSceneBPropChange('rolePlayImage', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none font-mono focus:ring-1 focus:ring-emerald-500 bg-white" placeholder="ex: RolePlay_img_0.png" />
                           </div>
                           <div>
                              <label className="block text-emerald-700 text-[11px] font-bold mb-1">하단 썸네일 이미지 파일명</label>
                              <input type="text" value={activeData.panelBtnImage || ''} onChange={e => handleSceneBPropChange('panelBtnImage', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none font-mono focus:ring-1 focus:ring-emerald-500 bg-white" placeholder="ex: RolePlay_img_mini_0001.png" />
                           </div>
                           <div>
                              <label className="block text-emerald-700 text-[11px] font-bold mb-1">하단 썸네일 접근성 라벨</label>
                              <input type="text" value={activeData.panelBtnLabel || ''} onChange={e => handleSceneBPropChange('panelBtnLabel', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 bg-white" placeholder="클릭 시 해당 장면의 대화를 볼 수 있습니다." />
                           </div>
                        </div>
 
                        <div className="border-b border-emerald-200 pb-2 mb-3 mt-6">
                           <h3 className="font-bold text-sm text-emerald-800">📝 장면 대화 스크립트 작성</h3>
                        </div>
                        <div className="space-y-4">
                           {(activeData.dialogues || []).map((item, dialIdx) => {
                             const sentenceVal = Array.isArray(item.text) ? item.text[0] || "" : (item.sentence || "");
                             const translationVal = Array.isArray(item.translation) ? item.translation[0] || "" : (item.kor || "");
                             const audioVal = Array.isArray(item.audio) ? item.audio[0] || "" : (item.audio_id || "");
                             
                             return (
                               <div key={dialIdx} className="p-3 border rounded-xl relative group shadow-sm bg-gray-50 border-gray-200 space-y-2">
                                  <button onClick={() => handleDialogueBDelete(dialIdx)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white">✕</button>
                                  
                                  <div className="flex justify-between items-center mb-1">
                                     <div className="flex items-center gap-2">
                                        <select value={item.role || 'A'} onChange={e => handleDialogueBChange(dialIdx, 'role', e.target.value)} className="p-1 text-xs font-bold text-emerald-950 rounded bg-emerald-100 border border-emerald-300 outline-none cursor-pointer">
                                           <option value="A">A 역할</option>
                                           <option value="B">B 역할</option>
                                        </select>
                                     </div>
                                  </div>
 
                                  <label className="block text-emerald-700 text-[10px] font-bold">영어 대사</label>
                                  <textarea value={sentenceVal} onChange={e => handleDialogueBChange(dialIdx, 'text', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none resize-none h-16 bg-white" placeholder="영어 대사 입력" />
                                  
                                  <label className="block text-emerald-700 text-[10px] font-bold">한글 해석</label>
                                  <textarea value={translationVal} onChange={e => handleDialogueBChange(dialIdx, 'translation', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none resize-none h-12 bg-white" placeholder="한글 번역 해석" />
                                  
                                  <label className="block text-emerald-700 text-[10px] font-bold">오디오 ID</label>
                                  <input type="text" value={audioVal} onChange={e => handleDialogueBChange(dialIdx, 'audio', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none font-mono bg-white" placeholder="ex: L3_001_CommB_eg_01" />
                               </div>
                             );
                           })}
                           <button onClick={addDialogueB} className="w-full py-2 border-2 border-dashed border-emerald-300 text-emerald-600 text-xs font-bold rounded-xl hover:bg-emerald-100 transition">+ 대사 추가</button>
                        </div>
                     </>
                  )}
 
                  {/* 롤플레이 A형 - 대본 및 표 퀴즈 에디터 영역 */}
                  {contentType === 'roleplay' && (
                     <>
                        <div className="border-b border-purple-200 pb-2 mb-3">
                           <h3 className="font-bold text-sm text-purple-800">📝 대화 스크립트 작성</h3>
                        </div>
                        <div className="space-y-4">
                           {(activeData.dialogues || []).map((item, engIdx) => (
                             <div key={engIdx} className={`p-3 border rounded-xl relative group shadow-sm transition-colors ${item.hasBlank ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                                <button onClick={() => removeSentence(engIdx)} className="absolute -right-2 -top-2 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white">✕</button>
                                
                                <div className="flex justify-between items-center mb-3">
                                   <div className="flex items-center gap-2">
                                      <select value={item.speaker || 'A'} onChange={e => handleSentenceChange(engIdx, 'speaker', e.target.value)} className="p-1 text-xs font-bold text-purple-900 rounded bg-purple-100 border border-purple-300 outline-none cursor-pointer">
                                         <option value="A">화자 A</option>
                                         <option value="B">화자 B</option>
                                      </select>
                                   </div>
                                   <div className="flex items-center gap-3">
                                      <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 cursor-pointer bg-indigo-100 px-2 py-1 rounded">
                                        <input type="checkbox" checked={item.hasBlank || false} onChange={e => handleSentenceChange(engIdx, 'hasBlank', e.target.checked)} className="cursor-pointer" />
                                        빈칸/강조 지정
                                      </label>
                                   </div>
                                </div>
 
                                <label className="block text-emerald-700 text-[11px] font-bold mb-1">
                                  영어 대사 <span className="text-gray-400 font-normal ml-1">({item.hasBlank ? "빈칸/강조 부분은 [대괄호]로 묶어주세요" : "일반 텍스트 입력"})</span>
                                </label>
                                <textarea value={item.sentence || ''} onChange={e => handleSentenceChange(engIdx, 'sentence', e.target.value)} className={`w-full p-2 text-xs border rounded-lg mb-2 outline-none resize-none h-16 ${item.hasBlank ? 'border-indigo-300 focus:ring-1 focus:ring-indigo-500 bg-white' : 'border-gray-300 focus:ring-1 focus:ring-gray-500'}`} placeholder={item.hasBlank ? "예: I enjoy [playing basketball]." : "영어 대사 입력"} />
                                
                                {item.hasBlank && (
                                   <div className="mb-2 p-2 bg-indigo-100/50 border border-indigo-200 rounded-lg">
                                      <label className="block text-indigo-800 text-[11px] font-bold mb-1">
                                         오디오 묵음 타겟 (muteTargets) <span className="text-indigo-500 font-normal ml-1">※ 싱크 인덱스 입력</span>
                                      </label>
                                      <input type="text" value={item.muteTargets !== undefined ? item.muteTargets : '0'} onChange={e => handleSentenceChange(engIdx, 'muteTargets', e.target.value)} className="w-full p-1.5 text-xs border border-indigo-300 rounded outline-none font-mono bg-white" placeholder="예: 0 또는 0, 1" />
                                   </div>
                                )}
 
                                <label className="block text-emerald-700 text-[11px] font-bold mb-1">한글 해석 (kor)</label>
                                <textarea value={item.kor || ''} onChange={e => handleSentenceChange(engIdx, 'kor', e.target.value)} className="w-full p-2 text-xs border border-gray-300 rounded-lg mb-2 focus:ring-1 focus:ring-emerald-500 outline-none resize-none h-12 bg-white" placeholder="한글 해석 입력 (<br> 사용 가능)" />
                                
                                <label className="block text-emerald-700 text-[11px] font-bold mb-1">오디오 ID</label>
                                <input type="text" value={item.audio_id || ''} onChange={e => handleSentenceChange(engIdx, 'audio_id', e.target.value)} className="w-full p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none font-mono bg-white" placeholder="ex: L1_012_CommB_eg_05" />
                             </div>
                           ))}
                           <button onClick={addSentence} className="w-full py-2 border-2 border-dashed border-purple-300 text-purple-600 text-xs font-bold rounded-xl hover:bg-purple-100 transition">+ 새로운 대사 추가</button>
                        </div>
 
                        {/* 표 퀴즈 에디터 영역 */}
                        <div className="border-b border-purple-200 pb-2 mb-3 mt-8">
                           <h3 className="font-bold text-sm text-purple-800">📊 우측 표 퀴즈 (Table Quiz)</h3>
                        </div>
                        
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