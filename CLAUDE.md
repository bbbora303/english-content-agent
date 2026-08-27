# CLAUDE.md — 콘텐츠 양산 에이전트 프로젝트 컨텍스트

> 이 문서는 Claude(claude.ai 채팅)와 나눈 장기 대화 내용을 Claude Code(VS Code 연동)로 이어받기 위해 정리한 것입니다.
> 요약이 아니라 "정리"가 목적이므로, 정보 손실보다 분량을 우선했습니다.

---

## 1. 프로젝트 개요

### 무엇을 만들고 있는가
**콘텐츠 양산 에이전트**: 영어 교과서 페이지 이미지를 업로드하면 AI(Claude API)가 이미지를 분석해서
- 어떤 화면 유형인지 판별하고 (`understand` / `roleplay` / `roleplay_b`)
- 말풍선·대화문 텍스트와 좌표를 추출해서
디지털 학습 콘텐츠용 데이터 구조(`data.js`)로 자동 매핑해주는 **내부 제작(저작) 도구**입니다.

운영자(콘텐츠 제작자)가 이후 이 도구의 UI에서 좌표·텍스트·오디오ID를 미세 조정하고, 완성되면 ZIP으로 내보냅니다.
내보낸 ZIP은 **마스터 템플릿**(별도로 관리되는 HTML/CSS/JS 세트, 이 저작 도구와는 다른 코드베이스)의 `js/data.js`를 교체하는 방식으로 최종 학습 콘텐츠가 완성됩니다.

### 목적
- 원래는 사람이 교과서 페이지를 보고 손으로 `data.js`를 작성해야 했음 → 그 수고를 AI 이미지 분석으로 줄이는 것이 핵심 목적
- 좌표/텍스트를 캔버스에서 직접 조정할 수 있는 WYSIWYG(비슷한) 편집 환경 제공
- 완성된 콘텐츠를 마스터 템플릿과 병합해 즉시 배포 가능한 ZIP으로 추출

### 콘텐츠 타입 4종 (현재 지원)
1. **`understand`**: 만화 컷(보통 4컷) + 말풍선. 말풍선 텍스트 렌더링 방식이 다시 3가지로 나뉨:
   - `inline`: 짧은 문장들이 한 줄로 이어짐 (한 줄에 다 들어감)
   - `lines`: 문장 1개가 길어서 여러 줄로 줄바꿈됨 (오디오 1개, 작성 시점에 줄이 미리 나뉘어 있음 — `lines` 배열)
   - `zipper`: 문장 여러 개(각각 별도 오디오)가 문장 경계와 무관하게 자연스럽게 흐르며 줄바꿈됨
2. **`roleplay`** (롤플레이 A형): 대화(dialogues) + 표 퀴즈(Table Quiz)
3. **`roleplay_b`** (롤플레이 B형): 씬(scene) 여러 개, 각 씬마다 이미지+대화, 표 퀴즈 없음
4. **`intro`** (레슨 인트로 표지, 신규): 페이지/씬 개념 없는 단일 화면. 배경 이미지 + 타이틀 이미지(위치·너비 조정 가능) + 학습목표 박스(라벨/색상/내용)로만 구성. 배경·타이틀 이미지는 항상 사용자가 직접 업로드(자동 크롭 없음), 업로드 전까지는 캔버스 미리보기 전용 플레이스홀더 예시 이미지로 채워짐(2-36 참고).

### 기술 스택

**프론트엔드**
- Vite `^5.3.1` + React `^18.3.1` / `react-dom ^18.3.1`
- Tailwind CSS `^3.4.4` (+ `autoprefixer ^10.4.19`, `postcss ^8.4.38`)
- `@vitejs/plugin-react ^4.3.1`
- `jszip ^3.10.1` (ZIP 병합 추출용, CDN 동적 로드 방식 `loadJSZip()`으로 사용 — package.json에는 의존성으로 있지만 실제로는 `import`가 아니라 동적 로드)
- 단일 컴포넌트 구조: `src/App.jsx` (약 1,800줄 이상, 아직 컴포넌트 분리 안 됨)

**백엔드 (로컬 개발용)**
- Express (`server/index.js`) — Claude API 프록시 서버
- `cors`, `dotenv`
- API 키는 `server/.env`에만 존재, 브라우저에 노출 안 됨

**백엔드 (배포용, 신규 추가)**
- Vercel 서버리스 함수: `api/analyze-image.js`, `api/health.js` (프로젝트 루트)
- `server/`(Express)와는 별도 코드베이스로, 로컬 개발엔 `server/`를, 배포엔 `api/`를 사용하는 **이원화 구조**

**AI 모델**
- Claude API 단일화 (예전엔 Gemini도 썼으나 완전히 제거됨, provider 선택 UI도 삭제됨)
- 모델 문자열: `claude-sonnet-5`
- 이미지 분석용 시스템 프롬프트(`ANALYZE_PROMPT`)는 `lib/analyzePrompt.js` 공유 모듈에 있고, `server/index.js`(로컬)와 `api/analyze-image.js`(배포용) 양쪽이 이 파일을 `import`해서 씀 — 예전엔 두 파일에 복붙되어 있었으나 동기화 누락 위험 때문에 분리함 (2-14 참고)

**배포**
- Vercel + GitHub 연동 방식으로 진행 중 (CLI 방식도 검토했으나 최종적으로 GitHub 연동 선택)

**빌드/실행 스크립트** (`package.json`)
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "server": "node server/index.js",
  "server-install": "npm install --prefix server",
  "dev:all": "concurrently \"npm run dev\" \"npm run server\""
}
```

**저장소**
- 템플릿(화면 유형별 기본 골격 ZIP)은 브라우저 **IndexedDB**에 저장 (서버 저장 아님 — 브라우저·도메인별로 분리된 로컬 저장소라는 점이 배포 시 중요한 제약사항, 4번 항목 참고)

### 실행 방법 (Setup & Run) — 원본 README.md 기준, 실무 정보라 반드시 유지

**최초 1회 설정**
```bash
npm install
npm run server-install       # == cd server && npm install
cp server/.env.example server/.env
# 이후 server/.env 파일을 열어 실제 API 키 입력: ANTHROPIC_API_KEY=sk-ant-실제키
```

**실행 (매번)**
```bash
npm run dev:all               # 프론트(5173) + 서버(3001) 동시 실행
```
(따로 실행하고 싶으면 터미널 2개로 `npm run dev`와 `npm run server`를 각각 실행)

브라우저에서 `http://localhost:5173` 접속.

### 코딩 컨벤션
- Tailwind CSS 유틸리티 클래스 사용, 별도 CSS 파일 최소화 (단, Understand 캔버스처럼 마스터 템플릿과 픽셀 단위로 정확히 맞춰야 하는 부분은 예외적으로 인라인 `style` 객체를 씀 — 3-6 참고)
- 상태는 최상위 `App` 컴포넌트에 집중되어 있음 (컴포넌트 분리 리팩토링은 아직 안 함 — 분리 시 props/context로 내려주는 방식 고려)
- **한국어 주석과 UI 라벨 사용 관례 유지**

### IndexedDB 이름
- 템플릿(관리자 모드에서 업로드하는 마스터 ZIP)을 저장하는 IndexedDB의 실제 데이터베이스 이름은 **`ContentBuilderDB_V6`**입니다 (`App.jsx` 상단, `const DB_NAME = 'ContentBuilderDB_V6'`).
- 브라우저 개발자도구 → Application → IndexedDB에서 이 이름으로 찾을 수 있음. 5-4 항목(IndexedDB 저장의 한계)과 함께 참고.

---

## 2. 지금까지 확정된 결정사항

### 2-1. AI 모델은 Claude로 단일화
- **결정**: Gemini 완전 제거, Claude API만 사용. provider 선택 드롭다운도 만들었다가 다시 제거함.
- **이유**: "실제로 필요한 게 '교체'였지 '병행 운용'이 아니라서 단순화"했다고 프로젝트 초기 문서(README)에 명시됨.

### 2-2. API 키는 항상 서버 사이드에서만 관리
- **결정**: `server/.env`(로컬) 또는 Vercel 환경변수(배포)에만 API 키 존재. 브라우저 코드에는 절대 노출 안 함.
- **구조**: `브라우저(App.jsx) → 프록시 서버 → Claude API`
- **이유**: API 키 유출 방지가 최우선 원칙.

### 2-3. 로컬 개발(Express)과 배포(Vercel 서버리스)를 별도 코드베이스로 유지
- **결정**: `server/index.js`(Express, 로컬 전용)를 삭제하지 않고 그대로 두고, 별도로 `api/analyze-image.js` · `api/health.js`(Vercel 서버리스 함수)를 새로 만듦.
- **이유**: Vercel은 "항상 켜져 있는 Express 서버" 방식이 아니라 요청이 올 때만 실행되는 서버리스 함수 방식이라, Express 코드를 그대로 올릴 수 없음. 로컬 개발 편의성(HMR, 익숙한 Express 구조)은 유지하면서 배포 요건도 맞추기 위한 이원화.
- **부작용/주의(해소됨)**: 이미지 분석 프롬프트(`ANALYZE_PROMPT`)를 두 파일에 각각 유지해야 하는 동기화 누락 위험이 있었으나, `lib/analyzePrompt.js` 공유 모듈로 분리해서 해소함 (2-14 참고)

### 2-4. `AI_PROXY_URL`을 절대경로 → 상대경로로 변경
- **결정**: `http://localhost:3001/api/analyze-image` → `/api/analyze-image` (상대경로)
- **이유**: 로컬에서는 Vite 프록시(`vite.config.js`의 `server.proxy`)가 `/api`를 `localhost:3001`로 넘겨주고, Vercel 배포 후에는 프론트와 API가 같은 도메인에서 서비스되므로 상대경로 하나로 로컬·배포 둘 다 커버 가능.
- **대안 배제**: 환경변수로 URL을 분기하는 방식도 가능했지만, Vite proxy + 상대경로 조합이 더 단순해서 채택.

### 2-5. 이미지 업로드 시 조건부 리사이즈/압축
- **결정**: 원본 파일 크기가 **3MB 이하면 리사이즈 없이 원본 그대로 전송**, 3MB 초과 시에만 canvas로 리사이즈(긴 변 1600px) + JPEG 82% 압축.
- **이유**: Vercel 서버리스 함수의 요청 본문 크기 제한이 **4.5MB로 고정**되어 있고, 이 프로젝트는 Next.js가 아닌 순수 Vite라서 `export const config = { api: { bodyParser: ... } }` 같은 설정으로 이 한도를 늘릴 수 없음(그 문법은 Next.js 전용). base64 인코딩 시 원본 대비 약 1.37배 커지므로, 3MB 기준이면 `3MB × 1.37 ≈ 4.1MB`로 안전 마진을 두고 4.5MB 이내에 들어옴.
- **처음엔 모든 이미지를 무조건 리사이즈**하도록 만들었다가, 사용자 요청으로 "기준 용량 넘을 때만 동작"하도록 조건을 추가함 (불필요한 화질 저하 방지).

### 2-6. 배포는 CLI가 아니라 GitHub 연동 방식으로
- **결정**: `vercel` CLI로 직접 배포하는 방법도 안내했었지만, 최종적으로는 **GitHub 저장소 연동 → Vercel 자동 배포** 방식을 선택.
- **이유**: 이 프로젝트가 짧은 주기로 반복적으로 수정되는 패턴이라(대화 전체가 그 증거), `git push`만으로 자동 재배포되는 쪽이 매번 `vercel --prod`를 수동 실행하는 것보다 실사용에 적합하다고 판단. 과거 배포로 롤백하기도 Vercel 대시보드에서 더 쉬움.

### 2-7. zipper 텍스트 렌더링은 "마스터 템플릿과 100% 동일한 로직"을 저작 도구에도 포팅
- **결정**: Understand 유형의 zipper 텍스트 렌더링을, 저작 도구(App.jsx)의 캔버스 미리보기가 실제 마스터 템플릿(`view0X.js`)의 런타임 측정 로직(`getClientRects()` 기반)과 동일하게 동작하도록 구현.
- **이유**: 여러 차례(수정7~10) 근사치로 구현했다가 실제 병합 결과와 다르다는 피드백을 반복해서 받았음. 최종적으로 마스터 템플릿의 실제 렌더링 함수 코드를 직접 확인한 뒤, 그 알고리즘(문장을 `display:inline`으로 유지해 호버/클릭 그룹을 보존하면서, `getClientRects()`로 각 문장이 몇 줄에 걸치는지 실측해 그 줄 끝에 한글을 절대위치로 삽입)을 React로 그대로 이식하는 것으로 결론남.
- **캔버스 스케일 보정**: 저작 도구 캔버스도 마스터 템플릿처럼 전체가 `transform: scale(...)`로 축소되므로, 측정값을 그 scale로 나눠 논리적 픽셀로 변환 후 적용해야 함 (그렇지 않으면 확대·축소 배율에 따라 위치가 어긋남).

### 2-8. 마스터 템플릿 자체의 버그/한계는 "이 프로젝트의 다른 대화"에서 별도로 수정
- **결정**: 저작 도구(App.jsx, index.js)와 마스터 템플릿(`view0X.js`, `view0X.css`)은 서로 다른 코드베이스이자 다른 관심사이므로, 마스터 템플릿 자체를 고쳐야 하는 이슈(예: 말풍선 꼬리 tail_tip 미반영, 비디오 파일명 하드코딩, zipper 한글 삽입 로직 부재)는 **이 대화가 아니라 프로젝트 내 별도 대화로 이관**해서 처리.
- **이유**: 두 코드베이스를 한 대화에서 왔다갔다 하면 캔버스 미리보기와 실제 템플릿 동작이 미묘하게 어긋나는 문제가 반복적으로 발생했음(실제로 여러 번 발생). 관심사를 분리해 각 대화가 각자의 코드베이스에만 집중하도록 함.
- **실제로 이관되어 완료 확인된 항목**: 말풍선 꼬리 tail_tip 반영, 비디오 파일명 data.js 연동, zipper 줄바꿈 시 한글 삽입 로직.

### 2-9. 정밀도 검증은 "가장 오래된 완전한 버전"을 기준으로
- **결정**: 여러 구버전 파일(260526, 260601, 260622, 260623)을 비교한 결과, **260601 버전이 "기능이 다 살아있던 마지막 온전한 버전"**이라는 게 확인됨. 이후 (260601→260623 사이) 대규모 리팩토링 때 여러 함수와 정밀한 스타일 값이 소실됨. Claude API 전환은 260623 이후에 이뤄짐.
- **이유**: 260623은 이미 함수 손실이 있는 상태에서 AI 모델만 교체된 버전이라 비교 기준으로 신뢰도가 낮음. 260526과 260601은 실질적으로 동일(understand 관련 코드는 거의 변경 없음)하므로 260601을 기준점으로 채택.
- **검증 결과**: understand 핵심 함수 다수가 260601과 **완전히 동일한 코드**였고, 일부만 roleplay_b 분기 추가로 인한 변경이었음 (로직 자체는 안 바뀜, 조건문만 확장됨).

### 2-10. 260601 대조로 찾아낸 3가지 정밀도 문제("발견 1/2/3")
260526·260601 구버전과 캔버스를 직접 대조하면서 발견한 3가지 이슈. 대화 중 "발견 1", "발견 2", "발견 3"이라는 이름으로 불렸고, 사용자는 이 중 **1번과 3번만 즉시 반영**하도록 결정함 (2번은 보류, 7-1 참고).

- **발견 1**: 유형 뱃지(예: "A Understand") 디자인 구조가 잘못됨 → **반영함** (아래 2-10-1 항목이 그 내용)
- **발견 2**: Understand 메인 이미지 렌더링 방식 차이 — 원본은 `backgroundSize: '100% 100%'`(비율 무시하고 늘림), 캔버스는 `object-cover`(비율 유지, 크롭). 교과서 이미지 비율이 614×354와 안 맞으면 두 방식의 결과가 달라짐 → **보류됨, 미해결** (7-1 참고)
- **발견 3**: 지시문 텍스트 폰트 크기가 24px(Tailwind 근사치)로 되어 있었음 → **반영함** (아래 2-11 항목이 그 내용)

### 2-10-1. 유형별 상단 뱃지 디자인 구조 (발견 1)
- **결정**: 알파벳(예: "A")과 텍스트("Understand")를 하나의 필박스(꽉 찬 배경색 박스)로 합쳐서 렌더링하던 것을, **원형 배지(알파벳만) + 테두리만 있는 박스(텍스트, 배경 없음)** 구조로 교체.
- **색상**: `understand`는 초록 계열(`#088d3b` 원형 배지, `#2f964e` 텍스트, `#d3ea95` 테두리), `roleplay`/`roleplay_b`는 파랑 계열(`#0580ac` 원형 배지, `#09769d` 텍스트, `#c9e6f4` 테두리).

### 2-11. 지시문 폰트 크기는 28px (24px 아님) (발견 3)
- **결정**: Tailwind의 `text-2xl`(24px)로 근사되어 있던 걸 원본 값인 28px로 고정.

### 2-12. Understand 캔버스에 "이전/다음 컷" 네비게이션을 신규 구현
- **결정**: 어떤 구버전에도 존재하지 않았던 기능이라 처음부터 새로 설계·구현. `pageData.length > 1`일 때만 표시, 좌우 화살표 + 인접 컷 썸네일(파스텔톤 필터 적용).

### 2-13. Understand 말풍선 빈 텍스트 처리
- **결정**: 사용자가 문장을 모두 삭제해 텍스트가 비어있으면, ZIP 추출 시 `bubble` 필드를 `null`로 내보내서 빈 말풍선이 그려지지 않도록 함. (전제: 마스터 템플릿이 `bubble: null`을 보고 말풍선을 안 그린다는 가정 하에 동작 — 실제 템플릿 코드로 100% 확인된 것은 아님, 7번 항목 참고)

### 2-14. Understand 메인 이미지 렌더링 방식을 "늘림" 처리로 통일 (7-1 해결)
- **결정**: 캔버스의 Understand 메인 배경 이미지(`activeData.bgSrc`)를 `object-cover`(비율 유지, 크롭)에서 `object-fill`(비율 무시, 늘림)로 변경 — `src/App.jsx`의 메인 이미지 `<img>` 한 곳만 수정. 이전/다음 컷 썸네일(파스텔 필터 적용된 네비게이션 이미지)은 마스터 템플릿에 대응하는 원본이 없는 신규 기능(2-12)이라 `object-cover`를 그대로 유지.
- **이유**: 마스터 템플릿 원본이 `backgroundSize: '100% 100%'`(늘림)로 동작하므로, 캔버스 미리보기와 실제 병합 추출 결과를 100% 일치시키기 위해 늘림 처리로 통일. 원본 이미지 비율이 614×354와 안 맞으면 이미지가 다소 늘어나 보일 수 있음 — 이는 감수하기로 함(7-1의 보류 상태 해제).

### 2-15. `ANALYZE_PROMPT`를 `lib/analyzePrompt.js` 공유 모듈로 분리 (7-8 해결)
- **결정**: `server/index.js`와 `api/analyze-image.js`에 각각 복붙되어 있던 `ANALYZE_PROMPT` 상수를 프로젝트 루트의 `lib/analyzePrompt.js`로 옮기고, 두 파일에서 `import { ANALYZE_PROMPT } from '../lib/analyzePrompt.js'`로 가져다 씀.
- **이유**: 두 파일 다 ESM(`"type": "module"`)이라 상대경로 import가 문제없이 동작하고, 이제 프롬프트를 고칠 땐 `lib/analyzePrompt.js` 한 곳만 고치면 로컬/배포 양쪽에 자동 반영되어 동기화 누락 위험이 구조적으로 사라짐.
- **범위**: 이번엔 `ANALYZE_PROMPT`만 분리함. `extractJson`, `analyzeWithClaude` 함수 본체는 여전히 두 파일에 각각 존재(에러 메시지 문구가 로컬/배포용으로 미묘하게 다르게 작성되어 있어 의도적으로 남겨둠) — 필요하면 추가로 공유 모듈화할 수 있음.

### 2-16. 죽은 코드 `handleGlobalDataChange` 삭제 (7-2 해결)
- **결정**: `App.jsx`에 남아있던, 어디서도 호출되지 않는 `handleGlobalDataChange` 함수(5줄 분량)를 삭제함. 실제로 쓰이는 `updateGlobalData`는 그대로 유지.
- **이유**: 코드 용량이 작아서(5줄) 남겨둬도 해는 없었지만, 이름이 비슷한 함수 두 개가 공존하면 나중에 잘못된 쪽을 호출할 위험이 있어 정리하는 쪽을 선택.

### 2-17. Understand/Roleplay A 코드 "픽스" — 이번 롤플레이 B 작업에서 더 이상 수정하지 않기로 확정
- **결정**: 두 유형은 여러 차례 정밀도 검증을 거쳐 마무리 단계로 판단하고 있었고(6번 항목), 사용자가 "언더스탠드/A형 코드는 더 이상 건드리지 않는다" 정도의 의미로 픽스를 요청함. 별도 코드 조치(락 파일, 주석 경고 등) 없이, 이후 작업에서 두 유형의 전용 블록은 수정 대상에서 제외하는 방식으로 준수.
- **이유**: 롤플레이 B형을 고도화하다가 실수로 이미 검증된 A형/understand 로직에 영향을 주는 사고를 예방하기 위함.

### 2-18. Roleplay B형 대사 필드를 `speaker/sentence/kor/audio_id`로 통일
- **결정**: 한때 편집 함수(`handleDialogueBChange` 등)만 `role/text[]/translation[]/audio[]` 배열 구조를 쓰고, 초기 데이터·AI 매핑·export 코드는 `speaker/sentence/kor/audio_id` flat 구조를 쓰던 불일치를 후자로 통일. `item.speaker || item.role` 같은 fallback 코드를 전부 제거.
- **이유**: 필드 이름이 두 가지로 혼재되어 있으면, fallback 코드 중 하나만 놓쳐도 화면엔 보이는데 ZIP 추출엔 빠지는 식의 눈에 안 띄는 버그가 생기기 쉬움. ZIP export 시점에는 마스터 템플릿이 기대하는 `role/text[]/translation[]/audio[]` 형태로 다시 변환해서 내보내므로(7-6에서 실제 형태 재확인 예정), 내부 편집 상태만 단순화한 것.

### 2-19. Roleplay B형 씬 이미지: 파일명과 실제 이미지 데이터를 분리 저장, AI 자동 크롭은 도입하지 않고 수동 업로드로 확정
- **결정**: `rolePlayImage`(ZIP 안에서의 파일 경로/이름, 문자열)와 `rolePlayImageSrc`(브라우저에 업로드된 실제 이미지 데이터, dataURL)를 별개 필드로 관리. 업로드 시 `resizeImageForUpload`로 축소한 버전을 하단 썸네일(`panelBtnImageSrc`)로 자동 생성해서, 썸네일을 별도로 업로드하지 않아도 되게 함.
- **AI 자동 크롭 시도했다가 되돌림**: 처음엔 AI가 씬 좌표를 인식하면 교과서 원본 이미지에서 그 영역을 잘라 `rolePlayImageSrc`에 자동으로 채워 넣도록 구현했었음. 사용자 확인 결과 **롤플레이 B형은 교과서 지면에 콘텐츠 이미지가 아예 없는 경우도 있어서**, 자동 크롭이 엉뚱한 영역(글자 부분 등)을 이미지로 잘라 넣을 위험이 있다고 판단 → 자동 크롭 로직을 제거하고, 씬 이미지는 **항상 빈 틀만 확보해두고 사용자가 직접 업로드**하는 방식으로 확정. `analyzeImageWithAI`도 이제 좌표(x_percent 등)를 요청/사용하지 않음(4-x 유사 패턴 — 시도했다가 근거 부족으로 되돌린 사례로 기록).
- **이유(분리 저장 자체)**: understand의 `bgSrc`(실제 이미지)와 export 시 파일명 규칙(`images/view0X/image.png`)이 이미 이런 분리 구조로 되어 있어 그 패턴을 그대로 따름. 썸네일 자동 생성(사용자가 직접 올린 이미지 기준)은 그대로 유지 — 이미지를 두 번 고르지 않아도 되게 하려는 UX 판단.

### 2-20. Roleplay B형 AI 분석: 다중 씬 "텍스트만" 분리 (이미지 좌표/크롭 없이)
- **결정**: 기존에는 `roleplay`(A형)와 완전히 같은 코드 경로를 타서 다중 씬 개념이 아예 없었음(전체 대화를 씬 0 하나에만 밀어넣음). 이제 `analyzeImageWithAI`에서 `roleplay_b`를 별도 분기로 떼어내, AI가 장면(view)을 2개 이상으로 나눠 인식하면 그 장면별 `dialogues`로 분리 매핑함. 장면이 1개로만 인식되면 기존처럼 평평한 단일 대사 목록으로 폴백. **이미지 좌표(x_percent 등)는 요청하지 않음** — 2-19에서 자동 크롭을 포기했으므로 좌표가 더 이상 필요 없어져, 프롬프트도 텍스트(장면 구분·화자·대사·해석) 추출에만 집중하도록 단순화함.
- **이유**: 롤플레이 B형 지면은 보통 여러 상황(장면)이 나열되고 각 장면마다 짧은 대사가 붙는 구조라, A형의 "표 퀴즈 곁 대화 1묶음"과는 근본적으로 다른 레이아웃임. `lib/analyzePrompt.js`에도 B 전용 다중 씬 추출 지시(좌표 없는 버전)와 JSON 예시, 그리고 제목 키워드("Look and Talk"/"Think and Talk") 기반 판정 규칙을 추가함(2-22 참고).
- **한계 인지**: 이건 프롬프트 지시문 개선 수준이지 AI 모델 자체의 재학습/파인튜닝이 아님. 롤플레이 B형은 교과서 지면 레이아웃 자체가 다양해서, 다양한 실제 지면에 대한 인식 정확도는 아직 검증되지 않음 — 별도 리서치를 통해 보강 예정(2-23 참고).

### 2-21. Roleplay B형 한글 해석 배치: A형과 같은 실측 기반 로직을 B 전용으로 별도 구현
- **결정**: A형의 `roleplayKorFragments`(실제 렌더링된 DOM을 `getClientRects()`로 측정해서 줄바꿈 위치에 맞춰 한글을 절대배치하는 로직)를 그대로 복사하지 않고, B 전용 `roleplayBScriptRef`/`roleplayBKorFragments`로 별도 구현함(2-17의 구역화 원칙과 일치). B는 한 대사 항목이 곧 1줄이라(A처럼 턴 안에 여러 줄이 중첩되지 않음) `turn.lines` 순회 없이 더 단순하게 구현됨. 줄바꿈 실측 유틸(`splitTextForRowWidth`)은 공용 함수라 그대로 재사용.
- **한글 배치 시 발견한 이슈**: 영어 대사 줄 간격이 좁으면(처음엔 `line-height: 1.4`) 문장이 여러 줄로 꺾일 때 한글 해석이 다음 영어 줄과 겹치는 문제가 실제로 발생함(Playwright로 스크린샷 찍어서 확인). `line-height: 2.2`(understand의 zipper 텍스트와 동일 값)로 늘려서 해결.
- **주의**: 좌/상 보정값과 line-height는 마스터 템플릿(view01.js)의 실제 B형 렌더링 함수를 아직 확인하지 못한 상태에서 임시로 정한 값 — 7-6에서 실제 파일을 받으면 재검증 필요.

### 2-22. Roleplay B형 판정에 제목 키워드("Look and Talk"/"Think and Talk") 규칙 추가 — ⚠️ 2-24에서 보조 신호로 격하됨
- **결정(당시)**: `lib/analyzePrompt.js`의 콘텐츠 유형 판정 지시문에 "최상단 제목이 Look and Talk 또는 Think and Talk이면 레이아웃이 다소 다르게 보이더라도 우선적으로 roleplay_b로 판정"이라는 규칙을 추가함.
- **이유(당시)**: 기존엔 "표 퀴즈 없음 + 가로로 넓은 대화 + 멀티 상황 이미지"라는 레이아웃 기반 판정만 있었는데, 롤플레이 B형 지면의 레이아웃이 다양해서 구조만으로는 오판정 위험이 있음.
- **뒤집힌 경위**: 사용자가 실사용 중 "Look and Talk" 제목인데 실제로는 롤플레이 A형이어야 하는 지면을 발견함 — 제목만으로는 A/B를 구분할 수 없다는 게 실증됨. 별도 리서치(2-23)를 거쳐 2-24로 판정 기준이 전면 교체됨 — 제목은 이제 "보조 참고"로만 쓰이고, 최종 판정은 '교체 표현 영역'의 유무로 함.

### 2-23. Roleplay B형 AI 인식 정확도 개선은 별도 Claude 대화(리서치)로 이관
- **결정**: "AI 모델의 학습이 필요하다"는 방향은 이 저작 도구 대화 범위를 벗어나므로(Claude API를 그대로 호출하는 구조라 재학습/파인튜닝이 불가능하고, 할 수 있는 건 프롬프트 개선뿐), 다양한 롤플레이 B형 교과서 레이아웃을 조사해서 프롬프트 보강 자료(레이아웃 패턴별 기대 JSON, 판정 경계 사례)를 만드는 작업을 별도 Claude 대화로 이관하기로 함. 작업 프롬프트를 `docs/roleplay_b_ai_layout_research_prompt.md`에 작성해둠(실제 이미지를 첨부해 진행하고, 결과는 `lib/analyzePrompt.js`에 바로 붙여넣을 수 있는 완성된 텍스트로 받아오도록 명시).
- **이유**: 2-8(마스터 템플릿 관심사 분리)과 같은 논리 — 이 대화는 저작 도구 코드에 집중하고, "다양한 실물 교과서 레이아웃 조사"라는 리서치성 작업은 별도 대화에서 처리하는 편이 낫다고 판단.
- **결과 반영됨**: 이 리서치의 1차 결과물이 2-24로 반영됨.

### 2-24. Roleplay A/B 판정 기준을 "교체 표현 영역(tips) 유무"로 전면 교체, B형 추출 규칙에 tips/target 슬롯/view 자동 전개/강조 마킹 도입
- **배경**: 2-23의 리서치 대화 결과물을 받아 반영. 사용자가 실사용 중 "Look and Talk" 제목인데 표 퀴즈도 교체 영역도 없는 순수 대화형 지면(원래는 A형)을 발견하면서, 레이아웃/제목 키워드 기반 판정(2-20, 2-22)의 한계가 실증됨.
- **결정**: `lib/analyzePrompt.js`의 1·2번 분류 지시문과 9번 B형 추출 지시문, B형 JSON 예시(3개로 확장)를 전면 교체.
  - **새 판정 기준**: 지면에 "교체 표현 영역"(예시 대화 속 특정 표현을 통째로 갈아끼울 수 있는 후보 목록 — 세로 목록형 Tips 상자든, 중심어+선택지 묶음이든 생김새 무관)이 있으면 B형, 없으면(표 퀴즈가 있든 없든, 분기 대화형이든) A형. 제목 키워드는 보조 참고로만 사용.
  - **B형 추출에 새로 추가된 개념**: `tips`(교체 표현 후보 배열), target 슬롯 판정(대화 속에서 tips[0]과 글자가 일치하는 표현), 단일 슬롯형일 때 tips 개수만큼 `views`를 자동 전개(각 view는 슬롯만 다른 tips 값으로 교체된 동일 대화), 다중 선택지형일 때는 view를 자동 전개/조합하지 않고 원문 1개 + tips만 보존, `<span class='emp col-N'>`(파란=col-1, 분홍=col-2, 붉은=col-0)로 강조 표현 마킹.
- **App.jsx 반영은 별도 진행**: 이 tips/target 슬롯/view 자동 전개/emp 마킹 개념을 캔버스 편집 UI와 ZIP export가 어떻게 다뤄야 하는지는 아직 반영 전 — 사용자가 별도 작업 프롬프트로 전달 예정 (2-25에서 1차 반영됨).
- **주의**: 새 B형 예시들(`view 3~6은 target 슬롯만 교체` 같은 축약 표기 포함)이 실제 프롬프트에는 전체 view가 다 펼쳐진 상태로 들어가 있음 — AI가 실제로 매 view마다 전체 대화를 반복 출력해야 하므로, 대화가 길면 응답 토큰이 커질 수 있다는 점은 아직 실사용 검증 전.
- **반영 직후 리뷰로 4건 보강(같은 날)**: (1) [중요] 2번 지시문이 "교체 영역 없으면 A형"이라고만 되어 있어 understand(말풍선 코믹 컷 — 이것도 표·교체 영역이 없음)까지 A형으로 오판정될 위험이 있었음 → 2번 맨 앞에 "이 구분은 understand가 아닌 대화 활동 지면에만 적용, 먼저 3번으로 understand 여부부터 판정"이라는 게이트 문장 추가. (2) 4·5번(최상단 제목/발문 추출)과 9-(1)(활동 블록 머리글 기준)이 한 페이지에 여러 활동이 섞인 지면(예: 듣기+Look and Talk)에서 서로 다른 곳을 가리킬 수 있어 상충 — 5번 끝에 "roleplay_b면 9-(1) 기준 우선" 단서 추가. (3) 최상위 결과물 스키마 안내 문장에 tips가 빠져 있어 모델이 가끔 누락할 수 있음 → "roleplay_b면 tips 배열도 최상위에 포함" 명시 추가. (4) B형 예시 2가 "tips 6개 → view 6개"라면서 지면상 view 1~2만 표기해서, 모델이 예시를 따라 view를 일부만 생성할 위험 → 9-(5)에 "예시가 일부만 표기해도 실제 출력은 tips 개수만큼 전부 생성" 명시 추가.

### 2-25. Roleplay B형 App.jsx에 tips(교체 후보) 소비 로직 추가 — 읽기 전용 표시만, view 자동 전개/조합은 안 만듦
- **배경**: 2-24로 AI 분석 응답에 `tips` 필드가 추가됐지만, `App.jsx`는 이를 받지 않고 버리고 있었음. 별도 대화에서 작성한 패치 작업 프롬프트를 받아 반영.
- **결정**: `analyzeImageWithAI`의 `roleplay_b` 분기에서 `aiData.tips`를 새 상태 `extractedTips`(페이지 전역, 씬별 아님)로 저장하고, 편집 패널의 "장면(Scene) 전용 리소스 설정"과 "장면 대화 스크립트 작성" 사이에 읽기 전용 "🔤 교체 후보 (Tips)" 블록을 추가해 목록으로만 보여줌(클릭·자동 삽입 없음, tips 비어있으면 블록 자체 숨김). `roleplay`(A형)·`understand` 분기와 오류 폴백에서는 `extractedTips`를 명시적으로 `[]`로 리셋해 이전 분석 결과가 새어나가지 않게 함.
- **view 자동 전개 로직은 새로 안 만듦**: 단일 슬롯형은 AI가 이미 tips 개수만큼 `views`를 펼쳐서 반환하므로(2-24), 기존 `analyzeImageWithAI`의 `viewsArray.length > 1` → 씬별 매핑 로직(2-20)을 그대로 재사용하는 것만으로 각 tips 변형이 씬 탭 하나씩으로 자연스럽게 표시됨. 다중 선택지형은 `views`가 1개만 오므로 기존 단일 씬 폴백 경로를 그대로 탐 — 두 경우 모두 `analyzeImageWithAI`의 씬 매핑 코드 자체는 무수정.
- **ZIP export는 건드리지 않음**: tips는 저작 중 참고용 데이터로만 쓰고, 최종 `js/data.js`/ZIP 산출물에는 포함하지 않기로 함(패치 프롬프트의 "결정 필요" 항목 중 저장 위치는 페이지 전역 상태로, export 포함 여부는 미포함으로 정리).
- **Playwright로 검증**: tips 3개 → view(씬) 3개 자동 매핑, 교체 후보 블록 표시, 씬 추가/삭제·한글 배치 등 기존 기능 회귀 없음을 확인.

### 2-26. 마스터 템플릿 작업 프롬프트(`docs/roleplay_b_master_template_prompt.md`) 2-24/2-25 반영해 보강
- **배경**: 문서를 처음 쓴 뒤(6번 항목, App.jsx 고도화 1차 완료 시점) 롤플레이 B형의 AI 추출 규칙(2-24)과 App.jsx의 tips 소비 로직(2-25)이 크게 바뀌었는데, 문서에는 반영이 안 돼 있어서 그대로 마스터 템플릿 대화에 넘기면 안 되는 상태였음.
- **추가한 것**: 기존 1~3번(대사 필드 형태, 씬 이미지 경로, 한글 배치 로직)은 이후에도 안 바뀌어서 그대로 두고, 새로 3가지 추가 — **4번** 강조 표현(`<span class='emp col-N'>`) 색상 매핑이 실제 마스터 템플릿 CSS와 일치하는지 확인 요청(B형 목업 데이터에 원래 이 마킹이 있었다는 정황상 이미 존재할 가능성이 높다고 안내), **5번** "씬마다 서로 다른 상황/이미지"라는 원래 전제가 tips 기반 단일 슬롯형 추출로 인해 깨질 수 있다는 점(같은 이미지를 공유하는 씬 여러 개가 생길 수 있음) 확인 요청, **참고 섹션** tips 필드는 저작 도구 편집 화면 전용이라 마스터 템플릿(ZIP 산출물)에는 내려가지 않는다는 점 명시(마스터 템플릿 쪽에서 tips를 처리할 필요 없음을 분명히 함).

### 2-27. 마스터 템플릿(view01.js/view01.css) 실제 회신 반영 — 이미지 경로 수정, B형 한글 배치를 실측 방식에서 flex-column 방식으로 전면 교체
- **배경**: `docs/roleplay_b_master_template_prompt.md`(2-26)로 이관했던 질문 5개의 답을 마스터 템플릿 대화로부터 실제 `view01.js`/`view01.css` 파일로 받음. 답을 코드에서 직접 확인하고 `src/App.jsx`에 반영함.
- **1번(대사 필드 형태)**: `view01.js`의 `renderRolePlay()`가 `scene.roleA/roleB/dialogues`, `talk.role/text[]/translation[]/audio[]`를 그대로 읽는 것을 확인 — **기존 export 구조와 100% 일치, 수정 불필요**.
- **2번(씬 이미지 경로) — 수정함**: `view01.js`가 실제로 이미지를 찾는 경로는 `./images/view01/{rolePlayImage}`, `./images/view01/{panelBtnImage}`였음(understand의 `images/view0X/` 패턴과 유사하되 폴더명이 `view01` 고정). 기존엔 `images/{파일명}`(view01 하위 폴더 없이)로 내보내고 있어서 실제로는 이미지가 안 뜨는 상태였음 — `handleExportZip`의 `roleplay_b` 분기에서 `newZip.file` 경로를 `images/view01/${...}`로 수정함.
- **3번(한글 배치 로직) — 전면 교체함, 2-21의 실측 로직은 폐기**: 2-21에서 A형처럼 `getClientRects()`로 줄바꿈을 실측해 한글을 절대배치하는 방식을 B형에도 이식했었는데, 실제 `view01.css`를 확인해 보니 **B형 마스터 템플릿은 그런 실측 방식을 전혀 쓰지 않았음**. 대신 `.sentence-group { display: inline-flex; flex-direction: column }` 안에 `.text-eng`(영어, 위) + `.text-kor`(한글, 아래)를 넣는 순수 flex-column 구조로, 브라우저가 영어 문장을 자연스럽게 줄바꿈하면 번역은 그냥 문장 블록 전체 밑에 한 덩어리로 붙음(문장이 몇 줄로 꺾이든 줄마다 쪼개지지 않음). 이 사실이 밝혀지면서 **B 전용 측정 로직(`roleplayBScriptRef`/`roleplayBKorFragments` state, 관련 `useLayoutEffect`)을 통째로 삭제**하고, JSX를 `.sentence-group`(inline-flex, column) 안에 `.text-eng` span + `.text-kor` div로 다시 그림.
  - **교훈**: A형과 B형은 마스터 템플릿 레벨에서 번역 배치 방식 자체가 다르다(A=실측 절대배치, B=flex-column 자연배치). 2-21 시점엔 "A형 로직을 B에도 그대로 이식"이 합리적 추정이었지만, 실제 파일 확인 전이라 틀렸던 것 — 5-6(근거 없는 추측 금지)의 사례로 추가.
- **4번(emp 색상) — 확인함, 수정 불필요**: `view01.css`에 이미 `.emp.col-0{color:#b42c13}`(붉은), `.emp.col-1{color:#018f9e}`(파랑/청록), `.emp.col-2{color:#e0629d}`(분홍)가 정의되어 있었고, `lib/analyzePrompt.js`의 매핑(파랑=col-1, 분홍=col-2, 붉은=col-0)과 정확히 일치함. 다만 저작 도구 캔버스 자체에는 이 색상 CSS가 없어서 B형 미리보기에서 강조색이 전혀 안 보이고 있었던 것을 이번에 같이 발견 → `.rpb-script .emp.col-N` 스코프로 캔버스에도 동일 색상을 추가함(3번 항목과 같은 JSX 수정에 포함).
- **5번(씬=서로 다른 이미지 전제) — 확인함, 조치 불필요**: `renderRolePlay()`는 `rolePlayData` 배열을 그대로 순회해 DOM을 새로 만들 뿐, 이미지 캐시 키나 프리로드 최적화, `panelBtnLabel` 자동 생성 로직이 없음 — 여러 씬이 같은 이미지를 공유해도 문제 없는 구조. 저작 도구 쪽도 별도 조치 불필요.
- **범위**: 이번 반영은 `handleExportZip`의 B형 이미지 경로와 B형 대본 렌더 JSX(+emp 색상 `<style>`)에만 국한됨. understand/roleplay(A형) 코드는 전혀 건드리지 않음(2-17 유지). `npx vite build`로 컴파일 확인함.

### 2-28. 강조 표현(emp) 입력 UX를 "raw HTML 직접 타이핑"에서 "텍스트 선택 → 색상 버튼 클릭"으로 교체, A형에도 동일하게 반영 — 2-17("A형 픽스")의 예외로 사용자가 명시적으로 재요청
- **배경**: 2-27 직후 사용자가 실사용 중 발견 — B형 대사 강조를 지정하려면 사용자가 `<span class='emp col-1'>...</span>` 같은 raw HTML을 직접 타이핑해야 했음(2-24/2-25 당시엔 AI 추출 결과에만 이 마킹이 실려 있었고, 사람이 손으로 편집할 UI는 없었음). 반면 A형은 `[대괄호]`로 감싸면 캔버스가 자동으로 `col-0`(빨강) 한 가지 색으로 하이라이트해주는 더 쉬운 UX가 있었지만, 색상이 하나로 고정되어 있어서(B형처럼 3색이 필요한 경우엔) 그대로 재사용할 수 없었음.
- **결정**: 두 유형 모두 **"강조하려는 텍스트를 마우스로 선택한 뒤, 빨강/파랑/분홍 색상 버튼을 클릭하면 그 부분이 자동으로 `<span class='emp col-N'>`로 감싸지는"** 공용 UI로 통일함. 사용자가 raw HTML을 직접 타이핑할 필요가 없어짐.
  - 색상은 마스터 템플릿(view01.css)에 이미 정의된 3색(`col-0` 빨강 `#b42c13`, `col-1` 파랑 `#018f9e`, `col-2` 분홍 `#e0629d`)만 제공 — 임의 색상은 지원하지 않음(마스터 CSS가 이 3색만 알고 있어서, 다른 색을 넣으면 ZIP 병합 결과에서 그냥 무시됨). 사용자에게 "선택지 방식(추천)"과 "색상 자유 지정"을 물어봤고, 후자는 마스터 템플릿 CSS까지 같이 고쳐야 해서(5-5 원칙) 전자로 확정.
  - 구현: `EMP_COLORS` 상수 + `wrapSelectionWithEmpColor()`(순수 함수, textarea의 `selectionStart/End`로 문자열을 잘라 span으로 감싸기만 함) + `applyEmpColorToSelection()`(컴포넌트 내부, 선택 영역이 없으면 토스트로 안내) — B형/A형 공용. 각 textarea에 `ref`를 달아(`dialogueBSentenceRefs`, `dialogueLineSentenceRefs`) 버튼 클릭 시점에 실제 선택 범위를 읽어온다.
- **A형에 반영한 것(2-17의 "A형 코드 픽스"에 대한 명시적 예외)**: 2-17에서 "이번 롤플레이 B 작업 동안 A형은 건드리지 않는다"고 확정했었지만, 오늘 사용자가 "B형 작업이 끝나면 A형에도 같은 색상 선택 기능을 반영해달라"고 명시적으로 재요청함 — 이 한 가지 UX 통일 작업에 한해 픽스 원칙의 예외로 처리함(다른 A형 코드는 여전히 안 건드림). 구체적으로:
  - A형 캔버스 렌더에서 `[대괄호]` 정규식 자동 변환(`hasBlank && text.replace(/\[(.*?)\]/g, ...)`)을 제거하고, `line.sentence`를 그대로 `dangerouslySetInnerHTML`로 렌더(B형과 동일 방식)하도록 교체. A형 캔버스에도 `.rp-script .emp.col-N` 스코프 `<style>`을 추가해 3색이 모두 보이게 함(기존엔 인라인 `style='color:#b42c13'`로 빨강만 하드코딩되어 있었음).
  - `hasBlank` 체크박스는 그대로 유지하되, 의미를 "강조 색상 지정"에서 "빈칸(오디오 묵음) 지정"으로 명확히 분리함 — 원래 이 체크박스는 강조색 표시와 `muteTargets`(오디오 묵음 타겟) 입력 UI 노출을 동시에 담당했는데, 이제 강조색은 체크박스와 무관하게 텍스트 선택만으로 언제든 지정 가능해졌으므로 체크박스는 순수하게 "이 줄에 오디오 묵음 처리가 필요한가"만 의미하도록 정리함.
  - **주의(미확인 사항)**: A형의 실제 마스터 템플릿(view0X.js, A형 전용 파일 — 아직 이 프로젝트로 전달받은 적 없음)이 `col-1`/`col-2`(파랑/분홍) 강조도 지원하는지는 **확인되지 않음**. B형(view01.js/css)에서는 3색 전부 확인됐지만, A형은 기존에 `col-0`(빨강) 하나만 실사용 검증된 상태였음(4-4, 2-10 등). 만약 A형 마스터 템플릿이 `col-1`/`col-2` 클래스를 모르면, 그 색으로 감싼 부분은 마스터 병합 결과에서 색이 안 보일 수 있음 — A형도 B형처럼 실제 마스터 템플릿 파일을 받아 검증하기 전까지는 "빨강(col-0)만 확실히 안전, 파랑/분홍은 미검증"으로 취급할 것.
- **검증**: Playwright(headless Chromium)로 B형·A형 양쪽에서 실제로 텍스트 선택 → 색상 버튼 클릭 → textarea 값에 emp span 삽입 → 캔버스 미리보기에 해당 색으로 렌더링되는 것을 스크린샷으로 확인함. A형은 표 퀴즈·대사 가리기 등 기존 기능 회귀도 없음을 같이 확인. 콘솔 에러 0건.

### 2-29. A형 마스터 템플릿(view01.js/css, B형과 파일명은 같지만 완전히 다른 내용) 실제 확인 — emp 3색 이미 지원됨, 수정 불필요
- **배경**: 2-28에서 남겨둔 미확인 사항("A형이 파랑/분홍 강조도 실제로 지원하는지 불명")을 확인하기 위해, `docs/roleplay_a_emp_color_master_template_prompt.md`로 이관 준비하던 중 사용자가 실제 A형 마스터 템플릿 파일(view01.js, view01.css)을 받아 직접 전달함.
- **확인 결과**:
  - **emp 색상 완전 일치, 수정 불필요**: `.role-play .role-eng-text .emp.col-0{color:#b42c13}`, `.emp.col-1{color:#018f9e}`, `.emp.col-2{color:#e0629d}` — B형(view01.css, 2-27)과 정확히 같은 값. App.jsx의 `EMP_COLORS` 상수와도 일치. 2-28에서 걱정했던 "파랑/분홍이 A형에서 안 보일 수 있다"는 우려는 기우였음.
  - **한글 배치 로직도 기존 구현이 정확했음이 재확인됨**: 이 파일에 `placeMultiLineTranslation()` 함수가 실제로 존재하며, `getClientRects()`로 영어 문장의 줄바꿈을 실측해 한글 번역을 절대배치하는 방식이었음 — `App.jsx`의 A형 한글 배치 로직(`roleplayKorFragments`, 3-6 참고, 근거 없이 추정 이식했던 것)이 실제로 정확했다는 게 뒤늦게 검증됨. 컨테이너 좌표(`left:40,top:256,width:660,height:340`)도 캔버스와 일치.
  - **구조적으로 새로 알게 된 것(참고용, 이번 작업과는 무관)**: 이 JS에는 B형의 `renderRolePlay()` 같은 "데이터 → DOM 생성" 함수가 없음. `ii` 클래스는 이미 페이지에 존재하는 `.talk`/`.role-eng-text` 요소를 찾아 상호작용(마스킹·오디오 재생)만 붙이고, 영어 문장 텍스트 자체는 만들지 않음 — 즉 A형은 대사 텍스트가 `data.js`(`contentData`)가 아니라 **별도의 정적 HTML(예: view01.html)에 이미 박혀 있는 구조**로 보임(반대로 B형은 런타임에 `rolePlayData` 배열로 DOM을 새로 그림). `window.dynamicRolePlaySounds`/`window.dynamicRolePlayAnswers`라는 전역만 참조하는 것으로 보아, `contentData`가 실제로 어떻게 이 HTML에 반영되는지(빌드 단계 템플릿 치환 등)는 이 JS만으로는 확인 불가 — 오늘 다룬 emp 색상 문제와는 무관하지만, 추후 "A형 export 데이터가 실제로 반영되는지" 전체를 검증할 때는 감안해야 할 전제. `docs/roleplay_a_emp_color_master_template_prompt.md`는 이 확인으로 목적을 다했으므로 더 이상 마스터 템플릿 대화로 넘길 필요 없음.
- **결론**: App.jsx 코드 변경 없음. 2-28에서 반영한 emp 강조 UX는 A/B형 모두 실제 마스터 템플릿과 호환됨이 확인됨.

### 2-30. 롤플레이 B형 실사용 검수로 3건 발견 — `view_pageinfo.js` export 버그 수정(App.jsx), 나머지는 마스터 템플릿/정상 동작으로 판명
- **배경**: 사용자가 실제 병합 ZIP을 브라우저에서 열어 롤플레이 B형을 검수하다가 스크린샷으로 3가지 문제를 제보함: (1) 미니 썸네일 행이 메인 이미지 폭을 벗어남, (2) 인식된 씬 개수보다 미니 썸네일 박스가 더 많이 보임(4개 인식인데 6개 박스), (3) B형에는 없어야 할 페이지 이동 네비게이션 바(하단 화살표+점)가 나타남.
- **(3) 원인 발견 및 수정 완료 — App.jsx 버그**: `handleExportZip`의 `view_pageinfo.js` 생성 로직(`viewPageInfoData = (pageData || []).map(...)`)이 contentType 구분 없이 항상 `pageData` 배열 길이만큼 항목을 만들고 있었음. understand는 컷(cut)마다 실제로 별도 `view0X.html` 페이지가 되므로 이 로직이 맞지만, roleplay/roleplay_b는 씬·대화가 몇 개든 **항상 view01.html 한 페이지짜리 활동**(씬 전환은 마스터 템플릿의 패널 버튼이 페이지 이동 없이 처리)이라, B형에서 씬이 여러 개면 `view_pageinfo`가 씬 개수만큼 부풀려졌고, 마스터 템플릿(`ei` 클래스, `this.view_pageinfo.length > 1`일 때 `setNav()` 호출)이 "페이지가 여러 개 있다"고 오인해 불필요한 네비게이션 바를 그렸던 것. `contentType === 'roleplay' || 'roleplay_b'`일 땐 항상 `[{url:"view01.html"}]` 1개만 내보내도록 수정함. understand 로직은 그대로 유지.
- **(2) 확인 결과 — 버그 아님, 정상 동작**: 사용자가 테스트한 지면이 `lib/analyzePrompt.js`의 "B형 예시 2"(우산 분실물, tips 6개 → view 6개)와 정확히 일치하는 시나리오였음 — 사용자에게 확인한 결과 실제로 씬이 6개(AI가 tips 6개를 정확히 인식)였고, 그중 4개 씬에만 이미지를 업로드해서 나머지 2개가 빈 플레이스홀더로 보인 것이었음. 저작 도구의 의도된 설계(2-19: 씬 이미지는 항상 빈 틀로 시작, 사용자가 직접 업로드)대로 동작한 것 — 조치 불필요.
- **(1) 마스터 템플릿 레이아웃 버그로 확정, 작업 프롬프트 작성**: `view01.css`의 `.panel-btns>.btn-select-panel` 위치가 `nth-child(1~6)`에 고정값(버튼 폭 100px, 간격 ~106.65px)으로 박혀 있어서, 씬이 4개일 때는 정확히 메인 이미지 오른쪽 끝(474.5px)과 맞아떨어지지만 5·6개일 때는 최대 687.8px까지(이미지보다 213.3px 더) 삐져나감. 저작 도구는 씬 개수 상한이 없어서(`addSceneB` 무제한) 이 문제는 씬이 늘어날수록 더 커짐. `docs/roleplay_b_panel_thumbnail_width_master_template_prompt.md` 작성 완료 — 버튼 행 전체 폭을 메인 이미지 폭(420px)으로 고정하고 씬 개수(N)에 맞춰 버튼 폭이 동적으로 줄어들게(예: `(420-(N-1)×gap)/N`) 요청함. 같은 파일에 이미 있는 `autoSizeCustomTableColumns()`(표 열 너비 반응형 계산 함수)를 구현 선례로 제시함.
- **App.jsx 쪽 추가 조치 없음**: (1)·(2) 모두 저작 도구가 내보내는 `rolePlayData`(씬 개수·이미지 파일명) 자체는 이미 올바름 — (1)은 마스터 템플릿 CSS/JS 레이아웃 문제, (2)는 애초에 버그가 아님.

### 2-31. 마스터 템플릿의 미니 썸네일 폭 초과 수정(2-30-(1))을 App.jsx 캔버스에도 동일하게 포팅
- **배경**: 2-30에서 마스터 템플릿 쪽으로 넘긴 `docs/roleplay_b_panel_thumbnail_width_master_template_prompt.md` 요청에 대해 사용자가 실제로 `view01.js`/`view01.css`를 수정해서 받아옴 — `renderRolePlay(data)`가 씬 개수(N)에 맞춰 버튼 폭(`(420-(N-1)*6)/N`)과 내부 썸네일 크기(비율 축소)를 매번 인라인 스타일로 계산해서 넣도록 바뀌었고, CSS의 고정 `nth-child` left/width 값은 더 이상 쓰지 않게 됨.
- **결정**: 저작 도구 캔버스(App.jsx)의 "B형 Scene 전환 패널 버튼 세트" 렌더링에도 마스터와 완전히 동일한 계산식을 그대로 포팅함 — `PANEL_ROW_WIDTH=420, PANEL_ROW_GAP=6, THUMB_NATIVE_W=84, THUMB_NATIVE_H=57` 상수와 `btnWidth = (420-(N-1)*6)/N`, `thumbScale = Math.min(1, btnWidth/84)` 계산을 씬 버튼/내부 썸네일 스타일에 적용. "+ 씬 추가" 버튼(저작 도구 전용 UI, 실제 마스터 템플릿에는 없음)은 이 계산에서 제외하고 고정 크기(60px) 유지.
- **검증**: Playwright로 씬 6개(실제 병합에서 문제가 됐던 것과 동일한 개수) 상황을 재현 — 6개 씬 버튼 폭 합계가 정확히 420px(메인 이미지 폭)로 맞아떨어지고, 대본 텍스트 영역을 침범하지 않는 것을 스크린샷과 좌표 측정으로 확인함. 콘솔 에러 0건.

### 2-32. Roleplay B형 다중 선택지형(view 자동 전개 안 되는 경우) — 새 씬을 빈 대사가 아니라 씬 1의 대사를 복제해서 시작하도록 수정
- **배경**: 사용자가 B형을 실사용 검수하다가 발견 — 다중 선택지형(2-24 (6), AI가 tips는 추출하되 view는 자동 전개하지 않고 원문 1개만 반환하는 경우) 지면에서는 대사가 "교체 후보(Tips)" 블록에만 참고용으로 표시되고 대화 스크립트에는 반영되지 않음(2-25에서 의도한 대로). 그런데 이 경우 씬이 여러 개 존재하면(초기 폴백 더미 씬 4개, 또는 사용자가 "+ 씬 추가"로 늘린 경우), 씬 1을 제외한 나머지 씬들이 서로 무관한 대사(폴백 더미 씬은 각자 다른 하드코딩된 예시 문장, "+ 씬 추가"는 빈 대사)를 갖고 있어서 사용자가 씬마다 대사 전체를 새로 타이핑해야 했음.
- **참고(사용자 확인)**: 롤플레이 B형은 "교체 후보만 씬별로 갈아끼우고 나머지 대사는 모든 씬이 동일"한 구조 — 즉 씬 1~N은 tips에서 언급된 특정 표현 하나만 다르고 나머지 문장은 전부 같아야 함.
- **결정**: 이 전제를 코드에도 반영 — (1) `startEditing()`의 roleplay_b 폴백 분기(단일 뷰만 인식됐거나 AI 분석을 안 거친 경우)에서 씬 1에만 채워 넣던 대사(`extractedDialogues` 또는 기본 예시)를 4개 폴백 씬 전부에 동일하게 복제해서 채우도록 수정. (2) `addSceneB()`로 씬을 추가할 때 빈 대사(`{ sentence: "", kor: "" }`)로 시작하던 것을, 항상 현재 씬 1(`pageData[0]`)의 대사를 복제해서 시작하도록 수정. 두 경우 모두 배열/객체를 얕은 복제해서 씬마다 독립적으로 편집 가능하게 함(한 씬 수정이 다른 씬에 번지지 않음).
- **검증**: Playwright로 다중 선택지형 시나리오(tips 2개, view 1개)를 재현 — 초기 진입 시 폴백 씬 4개 + "+ 씬 추가"로 만든 5번째 씬까지 전부 씬 1과 동일한 대사(`"I'm thinking of running this weekend."` / `"That sounds good. Which do you prefer?"`)로 채워지는 것을 스크린샷과 textarea 값 비교로 확인함. 콘솔 에러 0건.

### 2-33. Understand 말풍선에 "꼬리 없음"(`tail_dir: "none"`) 지원 추가 — AI 자동 판정 + 수동 삭제, 마스터 템플릿 반영까지 완료
- **배경**: 사용자가 실제 교과서 지면(예: "Later, a toy company began to make flying discs." / "Now, playing with them is a popular sport.")에서 캐릭터를 향한 뾰족한 꼬리 없이 사각형 캡션·내레이션 박스로만 되어 있는 말풍선을 발견 — 기존 저작 도구는 모든 말풍선에 항상 꼬리(SVG 포인터)가 있다고 가정하고 있어 이런 형태를 표현할 방법이 없었음.
- **결정**: `bubble.tail_dir`에 기존 `"top"/"bottom"/"left"/"right"` 외에 `"none"` 값을 추가로 지원.
  - **AI 프롬프트**(`lib/analyzePrompt.js`): 말풍선마다 꼬리 유무를 판정해 `has_tail: true/false`로 추출하도록 지시 추가(사각형/둥근 사각형 박스로만 되어 있으면 false), 캡션 박스 예시(has_tail:false) 1건을 JSON 예시에 추가.
  - **App.jsx**: `analyzeImageWithAI`가 `has_tail`을 `hasTail`로 저장 → `startEditing()`에서 `cb.hasTail === false`면 그 말풍선의 `tail_dir`을 자동으로 `'none'`으로 세팅. 캔버스 렌더링에서 `tail_dir === 'none'`이면 꼬리 SVG 자체를 그리지 않도록 조건부 렌더링. 꼬리 방향 드롭다운에 "없음(꼬리 삭제)" 옵션을 추가해 AI가 놓쳤거나 사용자가 원할 때 수동으로도 꼬리를 지울 수 있게 함(이때 꼬리 위치/끝방향 입력란은 비활성화). ZIP export는 `tail_dir`을 그대로 통과시키므로 추가 수정 불필요.
- **마스터 템플릿 반영**: `docs/understand_bubble_no_tail_master_template_prompt.md` 작성해 이관 → 사용자가 실제 `view01.js`(꼬리 SVG를 `hasTail` 조건부로 생성)와 `data.js`(검증용 테스트 데이터)를 수정해서 받아옴. 요청 내용과 정확히 일치하며 기존 꼬리 있는 말풍선 렌더링에 회귀가 없음을 확인 — **코드 수정 없이 검증만 수행**.
- **검증**: Playwright로 AI가 `has_tail:false`로 판정한 말풍선은 꼬리 SVG가 0개, 일반 말풍선은 1개 렌더링되는 것을 확인. 드롭다운에서 "없음"을 수동 선택하면 실시간으로 꼬리가 사라지고 위치/끝방향 입력란이 비활성화되는 것도 확인. 콘솔 에러 0건.

### 2-34. Roleplay A/B/C형 공통 [How to play] 안내 문구를 "공통 설정" 탭에서 편집 가능하게 함
- **배경**: 사용자가 [How to play] 버튼을 눌렀을 때 나오는 4단계 안내 문구를 콘텐츠(레슨)마다 다르게 쓰고 싶었는데, 그 문구가 `handleExportZip` 안에 A/B/C형별로 각각 하드코딩되어 있어(A/C는 `howToPlay: [{step, tail, lines}]`, B는 `howToPlaySteps: [{step, text}]`로 필드 구조까지 다름) UI에서 수정할 방법이 전혀 없었음.
- **결정**: 콘텐츠(현재 작업 중인 프로젝트) 단위로 자유롭게 고쳐 쓸 수 있는 편집 UI를 "공통 설정" 탭에 신설. 페이지/씬 단위가 아니라 콘텐츠 전체에 1세트만 있으면 되는 것으로 확인(사용자: "콘텐츠별로 안내 문구가 다른 상황").
  - `HOWTOPLAY_DEFAULT_LINES`(유형별 4단계 기본 문구, 기존 하드코딩 값 그대로)와 `howToPlayLines` state 신설. 콘텐츠 유형이 A/B/C 사이에서 바뀌면(1단계 AI 판정 또는 "유형 변경" 기능) 그 유형의 기본값으로 자동 리셋됨.
  - "공통 설정" 탭에 STEP 1~4 textarea 편집 섹션 추가(roleplay 유형일 때만 노출, understand는 이 버튼 자체가 없어 숨김). 줄바꿈(Enter)으로 한 스텝 안에 여러 줄을 구분.
  - A/C의 꼬리 방향(`tail`)은 사용자가 편집할 대상이 아니라 위치 지정용 고정값이라, 문구 state와 분리해 `HOWTOPLAY_TAILS_AC` 상수로 별도 관리.
  - `handleExportZip`의 A/B/C 세 분기 모두 하드코딩된 배열 대신 편집된 `howToPlayLines`를 매핑해서 내보내도록 교체.
- **버그 발견 및 수정 (같은 날)**: 1차 구현에서 textarea에 Enter를 눌러도 줄바꿈이 안 되는 문제가 실사용 중 발견됨. 원인은 `updateHowToPlayLine`이 값이 바뀔 때마다 "끝에 남은 빈 줄"을 즉시 정리하는 로직을 갖고 있었는데, controlled 컴포넌트라 리렌더 시점에 방금 입력한 Enter(개행)까지 함께 지워버렸던 것. **수정**: 입력 중에는 빈 줄을 정리하지 않고 그대로 저장하고, 트레일링 빈 줄 정리는 `cleanHowToPlaySteps()` 함수로 분리해 실제 export 시점에만 적용하도록 변경.
- **저장 범위**: 이 문구는 IndexedDB나 별도 저장소에 영구 저장되지 않고 세션 state로만 유지됨 — 새로고침하면 유형의 기본값으로 되돌아감(필요 시 이후 localStorage 등으로 영속화 검토 가능, 아직 요청되지 않음).
- **검증**: Playwright로 (1) roleplay_a에서 편집 섹션이 뜨고 기본 문구가 정확히 표시되는지, (2) textarea 수정이 실시간으로 반영되는지, (3) 실제 키보드 Enter 입력(`page.keyboard.press('Enter')`)으로 줄바꿈이 정상 작동하는지 확인. `npx vite build` 정상 통과, 콘솔 에러 0건.

### 2-35. Understand 이전/다음 컷 네비게이션 썸네일은 별도 이미지 파일이 아니라 인접 view의 메인 이미지(`image.png`)를 재사용함 — 마스터 템플릿(view01.js) 코드로 확정
- **배경**: 사용자가 "understand 메인 이미지가 컷마다 고정 파일명(`image.png`)으로 export되는 것"(2-14)을 확인하는 과정에서, 캔버스 좌우에 보이는 이전/다음 컷 썸네일(2-12에서 신규 구현)도 별도 이미지 파일로 저장되고 있는지 문의함.
- **1차 확인(저작 도구 코드만)**: `App.jsx`의 이전/다음 컷 `<img>`가 `pageData[activeViewIdx - 1]?.bgSrc` / `pageData[activeViewIdx + 1]?.bgSrc`를 그대로 재사용(파스텔 필터만 적용)하는 것을 확인 — 별도 파일/필드 없이 인접 view 자신의 배경 이미지를 재사용하는 구조. 다만 이것이 실제 마스터 템플릿과 일치하는지는 이 시점엔 추정이었음.
- **최종 확정(마스터 템플릿 코드 확인)**: 사용자가 제공한 실제 `view01.js`의 `ContentRenderer.init()` 8번 섹션에서, `customPrevImgBtn`/`customNextImgBtn`의 `background-image`를 `PAGE_DATA[navIndex - 1].image_url` / `PAGE_DATA[navIndex + 1].image_url`로 그대로 채우는 것을 확인함:
  ```js
  if (customPrevImgBtn && this.navIndex > 0) {
      const prevImageUrl = PAGE_DATA[this.navIndex - 1].image_url;
      customPrevImgBtn.style.backgroundImage = `url('${prevImageUrl}')`;
  }
  if (customNextImgBtn && this.navIndex < PAGE_DATA.length - 1) {
      const nextImageUrl = PAGE_DATA[this.navIndex + 1].image_url;
      customNextImgBtn.style.backgroundImage = `url('${nextImageUrl}')`;
  }
  ```
  즉 마스터 템플릿에도 썸네일 전용 필드나 파일이 존재하지 않으며, 저작 도구(App.jsx)의 기존 구현이 마스터 템플릿과 정확히 일치함이 검증됨(5-6 원칙에 따라 "추정"에서 "확정"으로 전환된 사례).
- **결론**: App.jsx 코드 수정 불필요. `handleExportZip`도 컷마다 `bgSrc`를 `images/view0X/image.png`로만 내보내면 충분하며, 썸네일용 추가 파일을 만들 필요가 없음이 재확인됨.

### 2-36. Intro 유형(레슨 인트로 표지) 신규 추가
- **배경**: 인트로 유형의 마스터 템플릿(`index.html`, `view01.html`, `view01.css`, `data.js`)을 전달받아 검토 — understand/roleplay 계열과 달리 페이지/씬 개념이 아예 없는 단일 화면(배경 이미지 + 타이틀 이미지 + 학습목표 박스)임을 확인.
- **데이터 구조 확정**: `contentData` 스키마 — `learningObjectiveTitle`(라벨 텍스트), `learningObjectiveColor`(HEX, 라벨 배경색+박스 테두리색 겸용), `learningObjective`(HTML 문단), `titleAudioId`, `mainImageAriaLabel`(배경 이미지 접근성 설명), `bgImagePath`/`titleImagePath`(둘 다 `images/` 폴더 바로 아래, 다른 유형의 `images/view0X/`와 달리 하위 폴더 없음), `animationConfig`(CreateJS 인트로 애니메이션 경로 — 아래 참고).
- **AI 분석 범위를 의도적으로 좁힘(사용자 확정)**: AI는 `mainColor`(HEX, 레슨 번호/제목 그래픽의 메인 강조색)와 `mainImageAriaLabel` 딱 2개만 추출. 학습목표 문단 텍스트는 지면에 보여도 추출하지 않고 작업자가 직접 입력(2-19의 "씬 이미지 수동 업로드" 결정과 같은 맥락 — 신뢰도 낮은 자동 추출보다 수동 입력이 안전하다고 판단).
- **이미지는 항상 수동 업로드, 자동 크롭 없음**: 배경/타이틀 이미지 둘 다 사용자가 직접 업로드해야 하며, 업로드 전에는 실제 예시 이미지(사용자가 제공한 표지 샘플)를 **캔버스 미리보기 전용 플레이스홀더**로 보여줌. `bgFileName`/`titleFileName`이 비어 있으면(미업로드) `handleExportZip`이 export 자체를 차단하고 토스트로 안내 — 플레이스홀더가 실수로 실제 콘텐츠에 섞여 나가는 사고를 방지.
- **CreateJS 인트로 애니메이션(`animationConfig`)은 저작 도구가 다루지 않기로 확정**: `view01.js`에 관련 클래스(`Ei`)가 있지만 실제 호출부가 주석 처리되어 있어 죽은 코드로 확인됨 — 저작 도구는 고정값만 내보내고 편집 UI를 만들지 않음.
- **view_pageinfo 처리**: roleplay 계열과 동일하게 intro도 항상 `view01.html` 1개 페이지로 고정(페이지/씬이 여러 개인 유형이 아니므로).
- **관리자 모드**: `templates` 상태와 마스터 ZIP 업로드 그리드에 `intro` 슬롯 추가(4열 → 5열).

### 2-37. Intro AI 분류가 계속 understand로 오분류되는 버그 수정
- **문제**: intro 판정 규칙을 `lib/analyzePrompt.js`에 추가할 때 실수로 "1." 다음에 "0."을 붙여 규칙 번호가 1→0→2 순으로 꼬여 있었음. 번호가 비정상적으로 뒤섞인 목록이라 모델이 이 규칙을 "가장 먼저 확인해야 할 최우선 조건"으로 제대로 인식하지 못하고, 다른 규칙(understand 쪽)에 더 끌려가 오분류가 발생한 것으로 추정.
- **수정**: 번호를 1→2→3... 순으로 정상화하고, intro 판정 문구를 1번 규칙 안에 "다른 어떤 판정보다 우선 확인"이라는 문장과 함께 명확히 통합. 판정 기준도 "말풍선/대화문/표 퀴즈/교체 표현 영역이 지면에 존재하는가?" 하나로 단순화.
- **방어적 파싱 추가(App.jsx)**: `analyzeImageWithAI`의 `rawType` 계산 시 `aiData.contentType`을 `trim()`+`toLowerCase()`로 정규화한 뒤 비교하도록 수정 — AI가 대소문자/공백을 다르게 반환해도(`"Intro"`, `" intro "` 등) understand로 잘못 폴백하지 않게 함.

### 2-38. Intro 메인 색상 입력 UI를 다른 유형과 동일한 패턴으로 통일
- **결정**: 학습목표 박스의 `learningObjectiveColor` 입력을 색상 스와치(`<input type="color">`) 단독에서, Understand 말풍선의 `bg_color`/`border_color`와 동일한 "색상 스와치 + HEX 텍스트 입력" 페어 UI로 교체. 마우스로 고르거나 HEX를 직접 입력하거나 둘 다 가능.
- **이유**: 이미 다른 유형에 있던 확립된 패턴을 그대로 재사용해 UI 일관성을 맞춤 — 별도의 새 상호작용을 도입하지 않음.

### 2-39. Intro 타이틀 이미지 위치/크기 조정 기능 추가 — 마스터 템플릿 반영까지 완료
- **결정**: 타이틀 이미지를 캔버스에서 드래그로 이동하고(기존 말풍선 드래그 로직에 `INTRO_TITLE_DRAG_ID`로 분기 추가), 우측 패널의 X/Y/너비 숫자 입력으로 정밀 조정도 가능하게 함(드래그 값과 연동). 높이는 원본 이미지 비율을 유지해 자동 계산 — 모서리 리사이즈 핸들은 다른 어떤 유형에도 없는 패턴이라 도입하지 않고, 너비 숫자 입력만으로 크기를 조정하는 쪽으로 확정.
- **데이터 구조**: `pageData[0]`에 `titleX`(기본 50), `titleY`(기본 20), `titleWidth`(기본 460) 추가, `handleExportZip`에서 `contentData.titleX/titleY/titleWidth`로 함께 export.
- **마스터 템플릿 반영**: `docs/intro_title_position_master_template_prompt.md` 작성해 이관 → 사용자가 실제 `view01.html`의 `DOMContentLoaded` 스크립트에 `titleX`/`titleY`/`titleWidth`를 읽어 `#title-obj-box`의 `style.left`/`top`/`width`에 반영하는 코드(`typeof === 'number'` 체크로 구버전 데이터는 기존 고정값 유지)를 추가해서 받아옴 — 요청 내용과 정확히 일치함을 확인. **코드 수정 없이 검증만 수행**.

---

## 3. 확정된 코드

> 실제 리포지토리에 존재하는 파일(`App.jsx`, `server/index.js`, `package.json`, `vite.config.js`,
> `.gitignore`, `api/*.js`, `lib/*.js`)의 코드는 여기에 옮기지 않았습니다. Claude Code가 폴더 내 파일을
> 전부 직접 읽을 수 있으므로 중복입니다. 아래는 **"이 파일/함수가 왜 이렇게 되어 있는지"를
> 코드만 봐서는 알기 어려운 맥락과 이유**만 정리했습니다. 단, **마스터 템플릿(`view0X.js`,
> `view0X.css`)은 이 리포지토리에 포함되지 않은 별도 코드베이스**라서 관련 부분은 코드를
> 그대로 남겨뒀습니다 (3-8).

### 3-1. `package.json`
- 위치: 프로젝트 루트
- `scripts`에 `dev`, `build`, `preview`(Vite 기본) 외에 `server`, `server-install`, `dev:all`(concurrently로 프론트+백엔드 동시 실행)이 추가되어 있음 — 원래 없었다가 이번에 새로 만든 것.

### 3-2. `vite.config.js`
- 위치: 프로젝트 루트
- 기존에 `server.port: 5173`만 있던 파일에 `server.proxy`(`/api` → `http://localhost:3001`)를 추가한 상태.
- **이 proxy가 없으면 로컬 개발에서 이미지 분석이 동작하지 않음** (App.jsx가 이제 `/api/analyze-image` 상대경로를 쓰기 때문 — 2-4 참고).

### 3-3. `.gitignore`
- 위치: 프로젝트 루트
- `node_modules`, `server/node_modules`, `server/.env`, `.env`, `dist`, `.vercel` 제외 처리. 배포 준비하면서 새로 생성.

### 3-4. `api/health.js`, `api/analyze-image.js`
- 위치: 프로젝트 루트의 `api/` 폴더 (Vercel 배포용, 신규 생성)
- `server/index.js`(Express, 로컬 전용)의 로직을 Vercel 서버리스 함수 형태로 이식한 것. `ANALYZE_PROMPT`는 `lib/analyzePrompt.js`(3-9 참고)에서 공유해서 가져오므로 자동으로 동일하지만, **`extractJson`, `analyzeWithClaude` 로직은 여전히 `server/index.js`와 각각 따로 존재하므로 그 부분을 고칠 땐 두 파일 다 수동으로 동기화해야 함** (5번 "제약조건" 참고).
- `api/analyze-image.js` 파일 끝에 Vercel 요청 본문 4.5MB 제한에 대한 주석이 남아있음 — 프론트엔드의 이미지 리사이즈 로직(3-7)과 짝을 이루는 설명이라 지우지 않음.

### 3-5. `server/index.js`
- 위치: `server/` 폴더 (로컬 전용, 배포에는 안 쓰임)
- `dotenv.config()`를 **파일 자신의 위치 기준 절대경로**(`path.join(__dirname, '.env')`)로 호출하도록 되어 있음. 단순히 `dotenv.config()`만 쓰면 실행 위치(cwd)에 따라 `.env`를 못 찾는 버그가 있었기 때문(4-8 참고).

### 3-9. `lib/analyzePrompt.js` (신규)
- 위치: 프로젝트 루트의 `lib/` 폴더 (신규 생성)
- `ANALYZE_PROMPT` 상수 하나만 `export`하는 공유 모듈. `server/index.js`와 `api/analyze-image.js`가 각각 `import { ANALYZE_PROMPT } from '../lib/analyzePrompt.js'`로 가져다 씀 (2-15 참고).
- `server/`는 자체 `package.json`(별도 `node_modules`)을 가진 독립 프로젝트지만, ESM 상대경로 import는 npm 패키지 경계와 무관하게 파일 경로로 직접 동작하므로 문제없이 참조 가능.

### 3-6. `App.jsx` — 새로 추가/복원된 주요 함수 위치 (전체 코드는 파일 참고)

| 함수/영역 | 역할 | 비고 |
|---|---|---|
| `AI_PROXY_URL` (상수) | API 엔드포인트 주소 | 절대경로→상대경로(`/api/analyze-image`)로 변경됨 (2-4) |
| `resizeImageForUpload`, `RESIZE_THRESHOLD_BYTES`, `handleImageUpload` | 이미지 업로드 전 조건부 리사이즈 | 원본 3MB 초과 시에만 동작 (2-5) |
| `serverStatus` state + 관련 `useEffect` | 서버 연결 상태 배너 | `/api/health` 호출해서 표시 |
| `handleExportZip` | ZIP 병합 추출 | 260601에서 복원됨 (4번, "구조 복원" 참고) |
| `handleTemplateUpload`, `addTableQuizRow`, `removeTableQuizRow`, `handleTableQuizChange` | 관리자 템플릿 업로드 / 롤플레이 표 퀴즈 | 260601에서 복원됨 |
| `updateGlobalData` | 공통 설정 탭 범용 업데이트 | 260601에서 복원됨. 이름이 겹치는 죽은 코드 `handleGlobalDataChange`가 한동안 공존했으나 삭제됨 (2-16, 4-7 참고) |
| `handleBgSwap` | Understand 배경 이미지 교체 | 260601에서 복원됨. 이게 없어서 캔버스 진입 시 흰 화면(크래시) 발생했었음 |
| `getTailStyle` + 말풍선 꼬리 SVG 렌더링 | 말풍선 꼬리 위치/방향 계산 | 260601에서 복원됨. `tail_tip==='left'`용 path는 수학적으로 마스터 템플릿의 `scale(-1,1) translate(-60,0)` 반전과 동일한 결과임을 검증함 |
| 말풍선 컨테이너 padding | Understand 말풍선 여백 | 타입별로 다름: zipper `5px 10px 42px 17px`, lines/inline `20px 10px 52px 17px` (마스터 템플릿 CSS와 일치시킴, 3-8 참고) |
| 텍스트 타입별(inline/lines/zipper) 렌더링 분기 | 말풍선 텍스트 표시 | zipper는 `zipperFlowRef`+`useLayoutEffect`(아래 항목)가 별도로 한글 위치를 계산, inline은 `white-space:nowrap`으로 실제 템플릿처럼 한 줄 강제 |
| `zipperFlowRef`, `zipperKorFragments` state, 관련 `useLayoutEffect` | zipper 한글 위치 실측 | 마스터 템플릿의 `placeZipperKorean()`을 `getClientRects()` 기반으로 React에 그대로 포팅한 것 (2-7 참고). 캔버스 전체가 `scale(...)`로 축소되므로 측정값을 `scale`로 나눠 보정하는 부분이 핵심 |
| B형 대본 렌더 (`.sentence-group`) | 롤플레이 B형 대사·한글 배치 | `getClientRects()` 실측 절대배치가 아니라 `display:inline-flex;flex-direction:column`(영어 위/한글 아래) 순수 flex 구조 — 마스터 템플릿(view01.css) 확인 후 2-27에서 실측 로직(`roleplayBScriptRef`/`roleplayBKorFragments`)을 삭제하고 이걸로 교체함 |
| 상단 유형 뱃지 + 헤더 액션 버튼 | "A Understand" 뱃지, 비디오/How to play 버튼 | 원형 배지+테두리 박스 구조(2-10), 비디오 버튼은 실제 사내 CDN 에셋(`btn_video.png`, `aidtcdn-dev.aitextbook.co.kr`) 사용 — 그 CDN에 접근 안 되는 네트워크에서는 안 보일 수 있음 |
| "내용 더 보기" 버튼 | Understand 더보기 | 정확한 좌표(`left:96.5, top:563.15`), 색상(`#ee6f00`), 실제 화살표 아이콘 에셋 사용 |
| 이전/다음 컷 네비게이션 | Understand 컷 이동 | 신규 기능(2-12). 썸네일에 마스터 템플릿과 동일한 파스텔 필터(`opacity(0.85) contrast(0.65) brightness(1.15) grayscale(0.15)`) 적용 |
| `handleIntroImageUpload` | Intro 배경/타이틀 이미지 업로드 | 신규 기능(2-36). FileReader로 dataURL 저장 + 파일명 sanitize해 `bgFileName`/`titleFileName`으로 저장 — 이 값이 있어야 `handleExportZip`이 "실제 업로드됨"으로 간주 |
| `INTRO_TITLE_DRAG_ID` 분기(`handleMouseDown`/`handleMouseMove`) | Intro 타이틀 이미지 드래그 이동 | 신규 기능(2-39). 말풍선 드래그와 같은 좌표 변환 로직을 재사용하되, 대상 필드만 `bubble.x/y`가 아니라 `pageData[idx].titleX/titleY`로 분기 |
| Intro 캔버스 렌더 블록 (배경/타이틀 이미지, 학습목표 박스) | Intro 화면 시각화 | 신규 기능(2-36). act-title 헤더는 이 유형엔 없어 `contentType !== 'intro'`로 숨김 |
| `handleExportZip`의 intro 분기 | Intro `data.js` export + 미업로드 시 차단 가드 | 신규 기능(2-36/2-39). 배경·타이틀 파일명이 없으면(플레이스홀더 상태) export 자체를 막음 |

### 3-7. `App.jsx` 상 결정된 수치/상수 (판단 근거가 코드만 봐선 안 보이는 것들)
- `RESIZE_THRESHOLD_BYTES = 3 * 1024 * 1024`(3MB): base64 변환 시 약 1.37배 커지는 것 감안, Vercel 4.5MB 한도에 안전 마진을 둔 값.
- 이미지 리사이즈 시 `maxDimension = 1600`, `quality = 0.82`(JPEG): 교과서 사진 화질과 용량의 타협점으로 임의 설정한 값 — 실사용해보고 화질이 부족하면 조정 필요.
- zipper 텍스트 판정(AI 프롬프트, `api/analyze-image.js` 및 `server/index.js` 공통): 말풍선 너비 550px, 폰트 27px 굵은 sans-serif 기준 "한 줄에 약 35~40자" — 실측이 아니라 추정치이므로 실사용 중 오판정이 잦으면 이 숫자를 조정해야 할 수 있음.

### 3-8. 마스터 템플릿(`view0X.js`, `view0X.css`) — ⚠️ 이 리포지토리에 없는 별도 코드베이스라 코드 원문을 보존함

**꼬리 방향(tail_tip) 반영** (다른 대화에서 수정 완료, 확인됨):
```javascript
const tailTip = (this.data.bubble && this.data.bubble.tail_tip === 'left') ? 'left' : 'right';
const tailFlipTransform = tailTip === 'left' ? 'scale(-1,1) translate(-60,0)' : '';
// <g transform={tailFlipTransform}>로 감싸서 좌우 반전
```

**비디오 파일명 data.js 연동** (다른 대화에서 수정 완료, 확인됨):
```javascript
new ni({
  root: c,
  options: {
    url: "media/video/",
    type: "default",
    quality: 720,
    fileName: (typeof GLOBAL_DATA !== 'undefined' && GLOBAL_DATA.video_file_name)
      ? GLOBAL_DATA.video_file_name
      : "중등영어2_Bridge_L2" // 값이 없을 때의 기본값(fallback)
  }
})
```

**CSS — 말풍선 여백/줄간격 컨트롤타워** (`view0X.css`, understand 타입별로 다름):
```css
.dynamic-bubble.text-type-zipper { padding-top: 5px; padding-bottom: 42px; }
.dynamic-bubble.text-type-lines,
.dynamic-bubble.text-type-inline { padding-top: 20px; padding-bottom: 52px; }

.dynamic-bubble .eng { line-height: 0.85 !important; }
.dynamic-bubble .kor { margin-top: 1px !important; margin-bottom: 12px !important; line-height: 1.2 !important; }
.dynamic-bubble .eng-line { margin-top: 8px !important; }
.dynamic-bubble .eng-line:first-child { margin-top: 0px !important; }

.dynamic-bubble .zline-flow .eng { line-height: 2.2; }
```

**썸네일(이전/다음 페이지 이미지) 필터** (`view0X.css`, `.custom-nav > .btn-nav[data-type="image"]`):
```css
filter: opacity(0.85) contrast(0.65) brightness(1.15) grayscale(0.15);
```

**zipper 한글 삽입 로직 (`placeZipperKorean()`)**: App.jsx의 3-6 항목에 있는 `useLayoutEffect`가 이 함수의 알고리즘을 그대로 포팅한 것. 마스터 템플릿 쪽 원본 함수 전체 코드는 이 문서에는 없고, 별도로 이관된 대화 기록에 있음 — 필요하면 그 대화에서 다시 받아와야 함 (7번 참고).

## 4. 시도했다가 실패/폐기한 방법

### 4-1. zipper 텍스트: 글자 수 기반 임의 줄 분할 (`splitFirstLine`) — **폐기**
- **시도한 것**: 문장이 길어서 줄바꿈될 때, 문자 수(~38자) 기준으로 "첫 줄"과 "나머지"를 문자열 단위로 잘라서, 그 사이에 한글을 강제로 끼워넣는 방식.
- **왜 실패했나**: 실제 마스터 템플릿의 렌더링 코드(`view0X.js`)를 확인해본 결과, 템플릿은 이런 글자 수 계산을 전혀 하지 않고 있었음. 문장을 그대로 `display:block`(이후 `inline`으로 재수정) 요소에 넣고 브라우저가 자연스럽게 줄바꿈하게 둘 뿐이었음. 근거 없이 만든 임시방편이었고, 실제 병합 결과와 캔버스 미리보기가 어긋나는 원인이 됨.
- **최종 대체**: 실제 템플릿의 `getClientRects()` 기반 실측 로직을 그대로 포팅 (2-7, 3-6의 `zipperFlowRef` 행 참고).

### 4-2. zipper: 문장을 2개 데이터 항목(같은 audio_id 공유)으로 분할 — **폐기**
- **시도한 것**: 긴 문장 하나를 `eng` 배열의 별도 항목 2개로 쪼개고, 둘 다 같은 `audio_id`를 참조하게 해서 "한글이 중간에 끼워지는" 효과를 데이터 구조만으로 구현하려 함.
- **왜 실패했나**: 사용자가 지적함 — 마스터 템플릿의 `.audio-text` 블록은 **블록 단위로 hover/클릭 하이라이트**가 걸리는 구조라서, 문장을 2개 블록으로 나누면 "어느 부분에 마우스를 올려도 문장 전체가 하이라이트"되는 요구사항을 절대 만족시킬 수 없음(각 블록이 독립적으로만 하이라이트됨). 데이터를 어떻게 쪼개든 이 문제는 해결 불가능하다고 결론 남.
- **최종 대체**: `.audio-text` 블록은 반드시 1개로 유지하고, 템플릿 자체가 `getClientRects()`로 실시간 측정해서 한글을 삽입하는 방식으로 마스터 템플릿을 직접 수정 (다른 대화로 이관).

### 4-3. zipper: "해석(한글)이 항상 노출된다"는 가정 — **폐기, 근거 없이 임의로 판단했다가 되돌림**
- **시도한 것**: 사용자가 준 예시(영어 줄/한글 줄이 번갈아 보이는 스크린샷)를 보고, "zipper 타입은 한글이 항상 노출되는 특수 유형인가 보다"라고 임의로 추론해서, [해석] 버튼을 zipper 타입일 때만 숨기고 한글을 항상 렌더링하도록 코드를 고침.
- **왜 실패했나**: 사용자가 "그 정의가 어디 있냐"고 되물어서 재확인한 결과, 실제로는 원본 코드 어디에도 그런 근거가 없었음(원본 260601 데이터의 zipper 예시조차 `kor` 필드가 렌더링에 쓰이지 않고 있었음). 근거 없이 추론해서 반영한 것이 문제였음.
- **최종 대체**: [해석] 버튼을 모든 타입 공통으로 원복. "항상 노출" 로직 완전히 제거.

### 4-4. Understand 헤더 버튼(비디오/How to play): 1차 시도 — 직접 그린 SVG 아이콘 — **폐기 후 실제 에셋으로 교체**
- **시도한 것**: 비디오 버튼을 파란 말풍선 모양 + 흰색 재생 삼각형을 직접 SVG로 그려서 근사치로 구현.
- **왜 대체했나**: 이후 구버전 파일(260601/260526)에서 **실제 서비스에서 쓰이는 진짜 이미지 에셋 URL**(`btn_video.png`)을 발견해서, 임의로 그린 SVG 대신 그 실제 에셋을 사용하도록 교체함(3-6의 "상단 유형 뱃지 + 헤더 액션 버튼" 행 참고). "How to play" 버튼도 마찬가지로 Tailwind 근사 스타일이었다가 정확한 원본 값(`#9c76ea`, `40px`, `18px` 등)으로 교체됨.

### 4-5. "내용 더 보기" 버튼: 1차 시도 — 캔버스 하단 중앙 배치, 임의 색상 — **폐기 후 정밀 좌표로 교체**
- **시도한 것**: 사용자가 준 참고 이미지를 눈대중으로 보고, 버튼을 캔버스 하단 중앙에 남색(indigo) 계열로 배치.
- **왜 대체했나**: 사용자가 "실제로는 하단 왼쪽에 있어야 한다"고 정정. 이후 구버전 파일에서 **정확한 좌표(`left: 96.5, top: 563.15`)와 색상(`#ee6f00`), 실제 화살표 아이콘 에셋**을 발견해서 그대로 교체함(3-6의 "내용 더 보기 버튼" 행 참고).

### 4-6. Vercel 요청 본문 크기 제한 우회 시도 — `export const config = { api: { bodyParser: ... } }` — **틀린 접근, 제거**
- **시도한 것**: Vercel 서버리스 함수의 4.5MB 요청 본문 제한을 늘리기 위해, Next.js의 API Routes에서 쓰는 `export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }` 문법을 `api/analyze-image.js`에 그대로 적용하려 함.
- **왜 틀렸나**: 이 프로젝트는 **Next.js가 아니라 순수 Vite** 프로젝트이고, 이 `config` export 문법은 Next.js 프레임워크 전용 컨벤션이라 일반 Vercel 서버리스 함수(Node.js 런타임)에서는 아무 효과가 없음. Vercel의 4.5MB 제한은 이 방식으로는 우회 불가능한 **플랫폼 하드 리밋**임.
- **최종 대체**: 서버 쪽 우회를 포기하고, **프론트엔드에서 업로드 전에 이미지를 리사이즈/압축**하는 방식으로 문제 자체를 회피 (2-5, 3-7 참고).

### 4-7. `updateGlobalData` vs `handleGlobalDataChange`: 이름이 겹치는 두 함수 — 하나는 죽은 코드로 방치 (이후 삭제됨)
- **발견한 것**: 리팩토링 과정에서 `updateGlobalData`(실제로 JSX 8곳에서 참조됨, 정의가 누락되어 있었음)와 `handleGlobalDataChange`(정의는 있으나 실제로는 어디서도 호출되지 않는 죽은 코드)가 동시에 존재하는 상태였음. 아마 리팩토링 중 이름을 바꾸다가 일부 호출부만 갱신되고 정의가 누락된 것으로 추정.
- **당시 처리 방식**: `updateGlobalData`(실제로 쓰이는 쪽)를 복원. `handleGlobalDataChange`(안 쓰이는 쪽)는 일단 삭제하지 않고 방치 — 제거해달라는 요청이 없었기 때문.
- **최종 처리(2-16)**: 이후 코드 용량(5줄)이 작고 이름 혼동으로 인한 오호출 위험만 있다고 판단해 `handleGlobalDataChange`를 삭제함.

### 4-8. package.json `server` 스크립트: `cd server && npm start` 방식 — **폐기, dotenv 경로 버그의 원인**
- **시도한 것**: 초기에는 `"server": "cd server && npm start"` 형태로 스크립트를 짰었음(정확한 원본 형태는 불명확하나, 실행 시 cwd가 `server/`가 되는 방식이었을 것으로 추정).
- **왜 문제였나**: 이후 스크립트를 `"server": "node server/index.js"`(루트에서 실행)로 단순화하면서, `dotenv.config()`가 기본적으로 **cwd 기준**으로 `.env`를 찾는다는 사실을 간과함 → 루트 실행 시 `content-agent/.env`를 찾게 되어 `server/.env`를 못 찾는 버그 발생.
- **최종 대체**: `dotenv.config({ path: path.join(__dirname, '.env') })`로 **스크립트 실행 위치와 무관하게 파일 자신의 위치 기준**으로 `.env`를 찾도록 수정 (3-6 참고).

### 4-9. Vercel 배포 방식: CLI(`vercel` 명령어) 단독 — **1차로 제안했다가 GitHub 연동으로 최종 변경**
- **시도한 것**: 처음엔 `vercel login` → `vercel` → `vercel env add` → `vercel --prod`로 이어지는 CLI 단독 배포 절차를 안내함.
- **왜 대체했나**: 사용자에게 CLI 방식과 GitHub 연동 방식을 비교 설명한 뒤, 이 프로젝트가 반복적으로 자주 수정되는 패턴이라는 점을 고려해 **GitHub 연동(push하면 자동 재배포) 방식이 더 적합**하다고 판단, 사용자도 이를 선택함.
- **최종 대체**: `git init` → GitHub 저장소 생성 → `git push` → Vercel에서 GitHub 저장소 Import → 환경변수 등록 → Deploy 순서로 안내 진행 중 (배포 실행 자체는 프로젝트 내 다른 대화로 이관됨).

---

## 5. 제약조건 및 주의사항

### 5-1. API 키 관련
- API 키는 **절대 브라우저 코드에 노출 금지**. `server/.env`(로컬) 또는 Vercel 환경변수(배포)에만 존재해야 함.
- `server/.env`는 `.gitignore`에 포함되어 있어 커밋되지 않지만, **혹시라도 실수로 커밋되지 않았는지 배포 전 반드시 확인** 필요.
- `server/.env` 파일 자체는 어떤 경우에도 Claude(채팅)나 다른 사람에게 전달하면 안 됨 (API 키 노출).

### 5-2. `ANALYZE_PROMPT` 이중 관리 문제 (해결됨, 2-15 참고)
- ~~이미지 분석 프롬프트가 `server/index.js`(로컬용)와 `api/analyze-image.js`(배포용) 두 파일에 동일하게 중복 존재함.~~ → `lib/analyzePrompt.js` 공유 모듈로 분리해서 해결함. 프롬프트를 고칠 땐 이제 이 파일 한 곳만 고치면 됨.
- 단, `extractJson`·`analyzeWithClaude` 함수 본체는 여전히 두 파일에 각각 존재하므로, 그 로직을 고칠 땐 지금도 두 파일 모두 동기화해야 함 (3-4 참고).

### 5-3. Vercel 서버리스 함수의 하드 리밋
- 요청 본문(body) 최대 **4.5MB**, Next.js가 아닌 순수 Vite 프로젝트라 `config.api.bodyParser` 같은 설정으로 우회 불가능 (4-6 참고).
- 이 제약 때문에 프론트엔드에 이미지 리사이즈 로직이 들어가 있음 — 이 로직을 건드리거나 제거할 때는 반드시 이 제약을 다시 고려해야 함.

### 5-4. IndexedDB 기반 템플릿 저장의 한계
- 관리자 모드에서 업로드하는 마스터 ZIP 템플릿은 **서버가 아니라 브라우저 IndexedDB**에 저장됨.
- **브라우저 + 도메인(origin) 단위로 완전히 분리된 저장소**라서:
  - 로컬(`localhost:5173`)에서 업로드한 템플릿은 배포 도메인에서 안 보임 → 배포 후 최초 1회 재업로드 필요.
  - **여러 사용자가 각자 다른 브라우저로 접속하면, 각자 브라우저에 템플릿이 없어서 각자 업로드해야 함.** "관리자 한 명이 등록하면 모두가 공유"되는 구조가 아님.
  - 이 구조를 여러 사용자가 함께 쓰는 서비스로 만들려면, 템플릿을 서버/클라우드 스토리지로 옮기는 재설계가 필요함 (아직 미착수).

### 5-5. 저작 도구(App.jsx)와 마스터 템플릿(view0X.js)은 서로 다른 코드베이스
- 이 둘을 혼동해서 한쪽 문제를 다른 쪽에서 고치려 하면 안 됨. 실제로 대화 중 여러 번 "캔버스 미리보기는 맞는데 병합 추출 결과가 다르다"는 문제가 있었고, 원인은 매번 둘 중 하나였음(가끔은 저작 도구 쪽 근사치 문제, 가끔은 마스터 템플릿 자체의 로직 부재).
- **마스터 템플릿(`view0X.js`, `view0X.css`) 수정이 필요한 이슈는 이 프로젝트의 "저작 도구 대화"가 아니라 별도의 "마스터 템플릿 대화"에서 처리하는 것으로 이미 관행이 정해짐** (2-8 참고). Claude Code로 작업을 이어받을 때도 이 구분을 유지할 것.

### 5-6. 근거 없는 추측으로 코드를 고치지 말 것 (실제로 있었던 실수)
- 과거 한 번, 사용자가 준 스크린샷만 보고 "zipper 타입은 한글이 항상 노출되나 보다"라고 임의로 추론해서 코드를 고쳤다가, 실제로는 근거가 없어서(사용자가 "어디 정의되어 있냐"고 되물어서) 되돌린 사례가 있음 (4-3 참고).
- **색상/좌표/폰트/동작 방식 등을 "그럴듯해 보여서" 임의로 정하지 말고, 반드시 구버전 파일(260601 등) 또는 실제 마스터 템플릿 코드에서 근거를 찾아 검증한 뒤 반영할 것.** 근거를 못 찾으면 사용자에게 솔직히 "추측"이라고 밝히고 확인을 구할 것.

### 5-7. 캔버스는 `scale(...)`로 축소되어 있음
- 저작 도구의 2단계 편집 캔버스는 항상 1280×720 기준으로 만들어지고, 화면 크기에 맞춰 전체가 `transform: scale(...)`로 축소됨.
- **실제 DOM 요소의 픽셀 위치를 측정해서 뭔가를 배치하는 로직(예: zipper 한글 위치 계산)을 만들 때는, 측정값을 반드시 이 `scale`로 나눠서 논리적 좌표로 변환한 뒤 사용해야 함.** 이걸 빠뜨리면 화면 크기에 따라 위치가 어긋남.

### 5-8. 외부 CDN 의존성
- 비디오 버튼(`btn_video.png`), 더보기 화살표 아이콘(`icon_arrow_0.svg`) 등이 **사내 개발용 CDN**(`aidtcdn-dev.aitextbook.co.kr`) 이미지를 직접 참조함.
- 그 CDN에 접근할 수 없는 네트워크 환경(예: 외부 배포 후 다른 회사망)에서는 이 이미지들이 깨져 보일 수 있음. 필요 시 이미지를 프로젝트에 내장하는 방식으로 바꿔야 할 수 있음.

### 5-9. `node_modules`는 절대 전달/커밋 대상이 아님
- 루트 `node_modules`와 `server/node_modules`는 서로 다른 패키지가 들어있는 별개 폴더(2-3 참고)이지만, 둘 다 `npm install` / `npm run server-install`로 언제든 재생성 가능한 캐시성 파일이므로 Git에 커밋하거나 채팅으로 전달할 필요가 전혀 없음. (`.gitignore`에 이미 반영됨)

### 5-10. 설정 변경 후 재시작이 필요한 경우
- `server/.env` 변경 → 서버(`npm run server` 또는 `dev:all`) 재시작 필요 (`.env`는 서버 시작 시 1회만 읽음).
- `vite.config.js` 변경(특히 `server.proxy`) → Vite 개발 서버 재시작 필요.

### 5-11. 핵심 데이터 구조 (data.js 스키마) 요약
- `GLOBAL_DATA.header`: `{ letter, text, instruction, color, btn_aria_label }`
- `GLOBAL_DATA.video_file_name`, `GLOBAL_DATA.video_aria_label`, `GLOBAL_DATA.more_content: { has_content, content_text }`
- `PAGE_DATA[n].bubble`: `{ width, x, y, tail_dir(top/bottom/left/right), tail_pos(0~100), tail_tip(left/right), bg_color, border_color }`
- `PAGE_DATA[n].text.type`: `"inline" | "lines" | "zipper"`
  - `inline`/`zipper`: `text.eng`는 `{ sentence, kor, audio_id }` 배열
  - `lines`: `text.eng`는 `[{ lines: [{ en, ko }, ...], audio_id }]` (오디오 1개에 여러 줄)
- Roleplay A: `dialogues`(대화) + `tableQuiz`(표 퀴즈: `headers`, `staticRow`, `rowCount`)
- Roleplay B: 최상위 변수 `rolePlayData`(**배열을 바로 사용, `scenes`라는 감싸는 키는 없음** — 예전 버전 문서에 `scenes` 배열이라고 적혀 있었는데 실제 export 코드와 달라 정정함, 7-5 참고). 각 원소(씬)는 `{ type, sceneId, rolePlayImage, panelBtnImage, panelBtnLabel, roleA, roleB, dialogues }`이고, `dialogues`는 `{ role, text: [string], translation: [string], audio: [string] }` 배열. 저작 도구 내부 편집 상태는 이보다 단순한 flat 구조(`speaker/sentence/kor/audio_id`)를 쓰다가 export 시점에 위 형태로 변환됨(7-5 참고). `rolePlayImage`/`panelBtnImage`가 가리키는 실제 이미지 파일은 ZIP 안에 **`images/view01/{파일명}`** 경로로 심어야 마스터 템플릿이 찾음(2-27에서 `view01.js`로 확인, 이전엔 `images/{파일명}`으로 잘못 내보내고 있었음).

---

## 6. 현재 진행 상태

### 완료된 것
- **Understand 유형**: 소실됐던 함수 전부 복원(9건), 캔버스-실제 병합 결과 간 정밀도 불일치 다수 해결(색상/좌표/여백/에셋 등), AI 분석 프롬프트 개선(좌표 추출, textType 판정), zipper 텍스트 렌더링을 마스터 템플릿과 동일한 알고리즘으로 최종 포팅, 이전/다음 컷 네비게이션 신규 구현. **사실상 마무리 단계**로 판단하고 있었음(사용자가 "언더스탠드 유형은 어느정도 된것같은데"라고 표현).
- **Roleplay A**: 1차 검수 완료. 구조적 문제(함수 누락)는 없었고, "How to play" 버튼 스타일 정밀화만 필요해서 수정함. **깊은 검수는 아직 안 함** (실사용 테스트는 사용자 몫으로 남겨둠).
- **배포 준비 (코드 작업)**:
  - `server/index.js` → `api/analyze-image.js`, `api/health.js`(Vercel 서버리스 함수)로 변환 완료
  - `App.jsx`의 `AI_PROXY_URL`을 상대경로로 변경 완료
  - 이미지 업로드 시 조건부 리사이즈/압축 로직 추가 완료 (3MB 초과 시에만 동작)
  - `vite.config.js`에 로컬 개발용 프록시 설정 추가 완료 (기존 `port: 5173` 유지)
  - `.gitignore` 생성 완료
- **문서화**: 전체 고도화 이력을 엑셀로 정리(시간순 재배열까지 완료), 이 `CLAUDE.md` 작성 중.
- **보류 질문 3건 해결 (Claude Code 인수 후)**: Understand 메인 이미지 늘림 처리로 통일(2-14), `ANALYZE_PROMPT` 공유 모듈 분리(2-15), 죽은 코드 `handleGlobalDataChange` 삭제(2-16).
- **배포 완료 확인됨** (7-7 참고): GitHub 연동을 통해 Vercel 배포가 실제로 완료됨을 사용자가 확인.
- **Roleplay B형 1차 고도화**: 언더스탠드/롤플레이 A형은 이번 작업 범위에서 "픽스"(더 이상 수정하지 않음)로 확정하고, 롤플레이 B형에 다음을 신규 구현함 — 대사 필드 스키마 통일(`speaker/sentence/kor/audio_id`), 씬 추가/삭제 UI, 씬 이미지 업로드 및 ZIP 임베드 파이프라인, AI 분석의 다중 씬 인식(장면별 이미지 크롭 + 대사 매핑), A형의 실측 기반 한글 정밀 배치 로직을 B 전용으로 이식. 상세는 7-5 참고.
- **롤플레이 B형 마스터 템플릿(view01.js) 반영 완료**: `docs/roleplay_b_master_template_prompt.md`로 이관했던 질문 5개의 답을 실제 `view01.js`/`view01.css`로 받아 확인·반영함 — 이미지 export 경로를 `images/view01/{파일명}`으로 수정, B형 한글 배치를 (틀렸던) 실측 절대배치 로직에서 마스터 템플릿과 동일한 `.sentence-group` flex-column 방식으로 전면 교체, emp 강조색(`col-0/1/2`)이 이미 일치함을 확인하고 캔버스 미리보기에도 적용. 상세는 2-27 참고.
- **강조 표현(emp) UX 개선 + A형 마스터 템플릿 호환성 확인 완료**: B형·A형 양쪽에 "텍스트 선택 → 색상 버튼 클릭" 방식의 emp 강조 UI를 반영(2-28)하고, 이어서 실제 A형 마스터 템플릿 파일(view01.js/css, B형과는 완전히 다른 별개 파일)을 받아 emp 3색 지원 여부를 확인함 — 이미 정확히 일치해서 추가 수정 불필요로 확정. 상세는 2-29 참고.
- **Understand 꼬리 없는 말풍선(`tail_dir: "none"`) 지원 완료**: AI가 캡션형(꼬리 없음) 말풍선을 자동 판정하도록 프롬프트 개선, 캔버스 렌더링/수동 삭제 UI 추가, 마스터 템플릿(view01.js/data.js) 반영까지 확인 완료. 상세는 2-33 참고.
- **Roleplay A/B/C형 How to play 안내 문구 편집 기능 완료**: 하드코딩되어 있던 4단계 안내 문구를 "공통 설정" 탭에서 콘텐츠별로 자유롭게 편집 가능하게 함. 1차 구현 직후 발견된 "Enter로 줄바꿈 안 되는" 버그도 같은 날 수정·검증 완료. 상세는 2-34 참고.
- **Intro 유형(레슨 인트로 표지) 신규 추가 완료**: 페이지/씬 없는 단일 화면 유형을 새로 구현 — AI는 mainColor·mainImageAriaLabel만 추출(2-36), 배경/타이틀 이미지는 항상 수동 업로드(플레이스홀더 예시 이미지 + 미업로드 시 export 차단). 초기 AI 오분류(understand로 계속 판정) 버그를 프롬프트 규칙 번호 정렬로 수정(2-37). 메인 색상 입력을 다른 유형과 동일한 스와치+HEX 페어 UI로 통일(2-38). 타이틀 이미지 드래그 이동+너비 조정 기능을 추가하고 마스터 템플릿(view01.html) 반영까지 완료(2-39).

### 진행 중 / 아직 안 끝난 것
- 없음.

### 다음에 해야 할 일 (남은 작업 목록)
1. **배포 후 실사용 테스트** — 실제 도메인에서 이미지 업로드 → AI 분석 → 편집 → ZIP 추출까지 전 과정 테스트. 특히 이미지 리사이즈(3MB 기준, 1600px/82% 품질)가 실제 교과서 사진들에 적절한지, 롤플레이 B형 export ZIP이 마스터 템플릿에 실제로 정상 병합되는지(2-27/2-30/2-31 반영분 포함) 검증 필요.
2. **Roleplay A 실사용 검수 계속** — 구조적으로는 문제없다고 확인했지만, 실제 콘텐츠를 만들어보면서 정밀도 이슈(understand처럼)가 나올 수 있음. (2-28/2-29의 강조색 UX 통일은 사용자가 명시적으로 예외 요청해서 반영·검증된 것이고, 그 외 A형 코드는 여전히 "픽스" 대상)
3. **A형 대사 텍스트가 실제로 어떻게 반영되는지 전체 검증(참고, 급하지 않음)** — 2-29에서 새로 알게 된 사실: A형 마스터 템플릿 JS에는 B형과 달리 "데이터 → DOM" 생성 함수가 없고, 대사 텍스트가 별도 정적 HTML에 이미 박혀있는 구조로 보임. `contentData`(App.jsx가 export하는 A형 데이터)가 실제로 그 HTML에 어떻게 반영되는지는 이번 emp 색상 확인 범위 밖이라 미확인 — 위 2번(A형 실사용 검수) 때 함께 확인.

~~3. Roleplay B형 AI 다중 씬 인식 정확도 개선(별도 리서치 대화)~~ → `docs/roleplay_b_ai_layout_research_prompt.md`를 이관해 받은 리서치 결과가 이미 `lib/analyzePrompt.js` 9번 지시문(tips/target 슬롯, B형 예시 3개, 강조 마킹 규칙)에 반영되어 있음을 확인 — 2-23/2-24에서 이미 완료된 항목이었고, 이 목록 정리가 누락돼 있었던 것뿐임. 완료로 정정.
~~4. Understand 이미지 렌더링 방식 결정~~ → 늘림 처리로 확정, 반영 완료 (2-14).
~~5. `ANALYZE_PROMPT` 중복 관리 방식 결정~~ → 공유 모듈 분리로 확정, 반영 완료 (2-15).
~~6. `handleGlobalDataChange` 죽은 코드 정리 여부~~ → 삭제로 확정, 반영 완료 (2-16).
~~7. 롤플레이 B형 마스터 템플릿 반영~~ → `view01.js`/`view01.css` 확인 후 반영 완료 (2-27).
~~8. A형 마스터 템플릿 emp 3색 지원 여부 검증~~ → 실제 파일 확인 후 이미 지원됨을 확인, 수정 불필요로 확정 (2-29).
~~9. 롤플레이 B형 미니 썸네일 폭 마스터 템플릿 반영~~ → 마스터 템플릿(`view01.js`/`view01.css`) 수정 완료 확인 후, 동일 계산식을 App.jsx 캔버스에도 포팅 완료 (2-31).

---

## 7. 미해결/판단 보류된 질문

### 7-1. Understand 메인 이미지 렌더링 방식 — ✅ 해결됨 (2-14 참고)
- **문제였던 것**: 마스터 템플릿 원본은 `backgroundSize: '100% 100%'`(비율 무시하고 늘림)를 쓰는데, 저작 도구 캔버스는 `object-cover`(비율 유지, 크롭)를 씀 (발견 2).
- **결정**: Claude Code 인수 후 사용자에게 재질의하여 "늘림 처리로 통일"로 확정, `src/App.jsx`의 메인 배경 이미지를 `object-fill`로 수정 완료.

### 7-2. `handleGlobalDataChange` 죽은 코드 — ✅ 해결됨 (2-16 참고)
- **문제였던 것**: `App.jsx`에 `updateGlobalData`(실제 사용됨)와 이름이 비슷한 `handleGlobalDataChange`(정의는 있지만 어디서도 호출 안 됨)가 공존하는 상태.
- **결정**: 코드 용량(5줄)이 작아 삭제 여부를 판단 기준으로 삼기로 하고, 실제로 작음을 확인한 뒤 삭제함.

### 7-3. `bubble: null` 처리가 마스터 템플릿에서 실제로 작동하는지 — ✅ 해결됨
- Understand에서 문장이 비어있을 때 ZIP 추출 시 `bubble` 필드를 `null`로 내보내도록 만들었는데(2-13), "마스터 템플릿이 `bubble: null`을 보면 말풍선을 안 그릴 것"이라는 가정 하에 만든 것이었음.
- **확인 결과**: 사용자가 실제 병합 추출 후 마스터 템플릿에서 테스트해본 결과, 말풍선이 정상적으로 안 그려지는 것으로 확인됨. 추가 조치 불필요.

### 7-4. 이미지 리사이즈 설정값(3MB 기준, 1600px, JPEG 82%) — 현재 값 유지로 확정
- 이 숫자들은 계산상 안전할 것으로 추정한 값. 사용자 확인 결과 **지금까지 실사용 중 3MB를 초과하는 교과서 이미지 사례가 없었고, 앞으로 발생할지도 불확실**한 상태.
- **결정**: 지금 로직(3MB 기준 조건부 리사이즈)을 그대로 유지하고, 실제로 3MB를 넘는 이미지가 발생하면 그때 재검토하는 것으로 픽스.

### 7-5. Roleplay B 고도화 — ✅ 해결됨 (마스터 템플릿 반영까지 완료, 2-27 참고)
- **기존 상태**: 검수조차 안 된 상태였고, 실제 코드 조사 결과 씬 이미지 업로드/저장, 씬 추가·삭제, AI 분석의 다중 씬 인식, 한글 해석 정밀 배치가 전부 빠져 있었음.
- **방향 확정**: (1) 롤플레이 A형이 베이스 — 현재 App.jsx의 B형 캔버스 레이아웃을 기반으로 고도화하되, A형의 실측 기반 한글 배치 로직을 B형에도 도입. (2) 구역화 — understand/A형이 서로 영향 안 주듯 B형도 독립된 코드 구역으로 분리. (3) 필드 통일 — B형 대사 데이터가 `speaker/sentence/kor/audio_id`와 `role/text[]/translation[]/audio[]` 두 형태로 혼재되어 있던 것을 전자로 통일.
- **이번에 구현한 것** (`src/App.jsx`, `lib/analyzePrompt.js`): 대사 필드 스키마 통일, 씬 추가/삭제(`addSceneB`/`deleteSceneB`) UI(사용자 확인 후 유지하기로 확정 — 처음엔 "4개 고정, 나중에 고도화"가 맞는지 재확인했으나 이미 구현된 걸 유지하기로 함), 씬 이미지 업로드(`handleSceneImageUpload`) 및 ZIP 임베드(썸네일은 업로드 이미지에서 자동 축소 생성), AI 분석 프롬프트에 롤플레이 B 전용 다중 씬 "텍스트만" 추출 지시/예시 추가(이미지 좌표·자동 크롭은 제거 — 2-19/2-20 참고) 및 제목 키워드 판정 규칙(2-22), A형과 별도 구현한 B 전용 한글 정밀 배치(`roleplayBScriptRef`/`roleplayBKorFragments`) — Playwright로 씬 추가/삭제, 이미지 업로드, 줄바꿈 시 한글 배치까지 헤드리스 브라우저로 검증 완료.
- **1차 구현 후 사용자 피드백으로 재조정한 것**: (a) 씬 이미지를 교과서 원본에서 AI가 자동으로 잘라 채우던 로직을 제거하고 수동 업로드 전용으로 되돌림(2-19), (b) AI 다중 씬 인식은 유지하되 좌표/크롭 없이 텍스트 분리에만 집중하도록 단순화(2-20), (c) B형 판정에 제목 키워드 규칙 추가(2-22), (d) 롤플레이 B형 교과서 레이아웃 다양성에 대한 AI 인식 정확도 개선은 별도 Claude 리서치 대화로 이관(2-23, 작업 프롬프트는 `docs/roleplay_b_ai_layout_research_prompt.md`).
- **남은 것**: 없음 — 마스터 템플릿(view01.js/view01.css) 반영까지 2-27에서 완료됨. 롤플레이 B형 레이아웃 리서치 결과(2-23, `docs/roleplay_b_ai_layout_research_prompt.md`)를 받으면 `lib/analyzePrompt.js` 9번 지시문을 추가로 보강하는 것만 남음(AI 인식 정확도 개선, 마스터 템플릿과는 무관한 별도 트랙).

### 7-6. 마스터 템플릿의 롤플레이 B형(view01.js) 대응 로직 확인 필요 — ✅ 해결됨 (2-27 참고)
- Understand의 `placeZipperKorean()` 원본 코드는 이관된 별도 대화에만 있고 이 문서에는 없음(필요 시 그 대화 기록 참고).
- **롤플레이 B형**: `docs/roleplay_b_master_template_prompt.md` 작업 프롬프트로 이관해 실제 `view01.js`/`view01.css`를 받아 확인함 — 이미지 폴더 경로(`images/view01/`), 대사 필드명(`role/text[]/translation[]/audio[]`, 기존과 일치), 한글 배치 방식(실측 절대배치가 아니라 flex-column 구조였음, 2-21의 가정과 달랐음)을 전부 확인하고 `src/App.jsx`에 반영 완료. 상세는 2-27 참고.

### 7-7. 배포 완료 여부 — ✅ 해결됨
- Git/GitHub 연동을 통한 Vercel 배포가 실제로 완료된 것으로 사용자가 확인함.

### 7-8. `ANALYZE_PROMPT` 중복 관리를 그대로 둘지, 공유 모듈로 뺄지 — ✅ 해결됨 (2-15 참고)
- **문제였던 것**: `server/index.js`(로컬)와 `api/analyze-image.js`(배포)에 이미지 분석 프롬프트가 완전히 동일하게 중복되어 있었음 (5-2 참고).
- **결정**: `lib/analyzePrompt.js` 공유 모듈로 분리해서 두 곳에서 import하도록 리팩토링 완료. (단, `extractJson`/`analyzeWithClaude`는 이번 리팩토링 범위 밖이라 여전히 중복 — 3-4 참고)

### 7-9. A형 마스터 템플릿의 emp 3색(강조 표현) 지원 여부 — ✅ 해결됨, 수정 불필요 (2-29 참고)
- **문제였던 것**: 2-28에서 A형 캔버스에도 B형과 같은 텍스트선택+색상버튼 강조 UI를 반영했는데, A형의 실제 마스터 템플릿 파일을 받아본 적이 없어서 `.emp.col-0/1/2` 색상이 실제로 정의돼 있는지, 있다면 값이 얼마인지 확인이 안 된 상태였음.
- **확인 결과**: 실제 A형 마스터 템플릿(view01.js/view01.css, 파일명은 B형과 같지만 내용은 완전히 다른 별개 파일)을 받아 확인함 — `.emp.col-0{color:#b42c13}`, `.emp.col-1{color:#018f9e}`, `.emp.col-2{color:#e0629d}`가 B형과 **완전히 동일한 값**으로 이미 정의돼 있었음. App.jsx의 `EMP_COLORS`도 그대로 일치 — **수정 불필요**. 상세는 2-29 참고.