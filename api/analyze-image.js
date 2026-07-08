// 💡 Vercel 서버리스 함수 버전 — server/index.js의 analyzeWithClaude 로직을 그대로 이식.
// 요청이 올 때만 실행되고 끝나는 구조라 Express의 app.post(...) 대신
// 파일 하나 = 엔드포인트 하나(/api/analyze-image)로 동작합니다.

const ANALYZE_PROMPT = `업로드된 이미지는 종이 교과서 페이지입니다. 이 페이지를 디지털 콘텐츠용 이미지로 분할하고, 텍스트를 추출해야 합니다.
1. 대화나 상황극을 포함하는 페이지이며, 우측에 표 퀴즈(Table Quiz)가 존재한다면 'roleplay'(롤플레이 A형)로 설정하세요.
2. 표 퀴즈가 없고 단지 가로로 넓은 역할극 대화 스크립트와 멀티 상황 이미지가 존재한다면 'roleplay_b'(롤플레이 B형)로 설정하세요.
3. 그 외 말풍선 중심의 본문 탐색형 내용이라면 'understand'로 설정하세요.
4. 최상단의 메인 발문(지시문) 텍스트를 찾아 'instruction' 필드에 추출하세요. (예: "친구의 고민에 공감을 표현하고 조언한 후...")
5. 최상단 제목의 알파벳(예: B)을 'letter' 필드에, 텍스트(예: Talk and Complete, Understand)를 'title' 필드에 추출하세요.
6. [Understand인 경우] 코믹 컷(보통 4개)을 찾아 각 컷의 좌표를 백분율(%)로 정확히 추출하세요.
   - 각 컷마다 'x_percent'(왼쪽 시작 위치), 'y_percent'(위쪽 시작 위치), 'width_percent'(너비), 'height_percent'(높이)를 반드시 채우세요. 전체 이미지 기준 백분율이며, 컷끼리 좌표가 겹치지 않아야 합니다.
   - 예를 들어 2x2 배열의 4컷 만화라면: 1번 컷(좌상단)은 x_percent:0, y_percent:0, width_percent:50, height_percent:50 근처, 2번 컷(우상단)은 x_percent:50, y_percent:0, width_percent:50, height_percent:50 근처와 같은 방식으로, 실제 그림이 배치된 위치를 보고 정확히 추정하세요.
   - 각 컷의 말풍선 안 영어 문장을 추출한 뒤, 아래 절차로 'textType'을 판정하세요 (말풍선 너비는 550px, 폰트는 27px 굵은 sans-serif 기준이며, 이 조건에서 한 줄에 들어갈 수 있는 글자 수는 대략 35~40자입니다):
     1) 말풍선 안에 서로 다른(각각 별도 음성으로 재생될) 영어 문장이 몇 개인지 센다.
     2) 문장이 정확히 1개이면: 그 문장의 길이가 약 35~40자 이내로 한 줄에 들어가면 'inline', 그보다 길어서 한 줄에 못 들어가면(줄바꿈이 필요하면) 'lines'로 판정한다.
     3) 문장이 2개 이상이면: 모든 문장을 합쳤을 때 총 길이가 약 35~40자 이내로 한 줄에 다 들어가면 'inline', 못 들어가면(강제로 문장 하나당 줄 하나를 차지하는 게 아니라, 여러 문장의 영어 텍스트가 자연스럽게 쭉 이어지다가 필요한 지점에서 줄바꿈되고 그 줄바꿈 위치에 맞춰 대응하는 한글 해석도 함께 나뉘어 배치되는 형태) 'zipper'로 판정한다.
   - 컷마다 문장 개수와 길이가 다르므로, 4개 컷 모두 같은 textType으로 몰아서 판정하지 말고 컷별로 위 절차를 각각 새로 적용하세요.
7. [Roleplay 및 Roleplay_b인 경우] 컷 구분 없이 전체를 1개의 컷으로 간주하세요. 이미지 내에 있는 대화문(A, B 등)을 순서대로 읽어내어 speaker, sentence(영어), kor(한국어 해석)로 배열화하여 추출하세요.

결과물은 반드시 아래 JSON 구조(views 배열 필수 포함)로만 답변하세요, 다른 설명이나 마크다운 없이 순수 JSON만 출력하세요:
[Understand 예시 - 문장 2개가 한 줄에 들어가서 inline]
{ "contentType": "understand", "letter": "A", "title": "Understand", "instruction": "다음을 보고, 여러 나라의 건강한 삶의 방식을 알아봅시다.", "views": [ { "originalInfo": "컷 1", "x_percent": 0, "y_percent": 0, "width_percent": 50, "height_percent": 50, "textType": "inline", "eng": [ { "sentence": "Hi, I'm Lisa.", "kor": "안녕, 나는 리사야." }, { "sentence": "I live in the Netherlands.", "kor": "나는 네덜란드에 살아." } ] },
[Understand 예시 - 문장 1개가 길어서 줄바꿈, lines]
{ "originalInfo": "컷 2", "x_percent": 50, "y_percent": 0, "width_percent": 50, "height_percent": 50, "textType": "lines", "eng": [ { "lines": [ { "en": "I stay healthy because I", "ko": "나는 건강해요, 왜냐하면" }, { "en": "always ride a bike to school.", "ko": "항상 자전거로 등교하기 때문이에요." } ] } ] },
[Understand 예시 - 문장 2개를 합치면 한 줄에 안 들어가서 zipper]
{ "originalInfo": "컷 3", "x_percent": 0, "y_percent": 50, "width_percent": 50, "height_percent": 50, "textType": "zipper", "eng": [ { "sentence": "Hi, I'm Julian from Greece.", "kor": "안녕, 나는 그리스에 사는 줄리안이야." }, { "sentence": "I'm 90 years old, and I'm healthy.", "kor": "나는 90살이고, 건강해." } ] } ] }
[Roleplay 예시]
{ "contentType": "roleplay", "letter": "B", "title": "Talk and Complete", "instruction": "친구의 고민에 공감을 표현하고 조언한 후, 표를 채워 봅시다.", "views": [ { "originalInfo": "전체 뷰", "textType": "lines", "eng": [ { "speaker": "A", "sentence": "What do you usually do?", "kor": "보통 무엇을 하니?" } ] } ] }`;

function extractJson(rawText) {
  const cleaned = (rawText || '{}').replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
  return JSON.parse(cleaned);
}

async function analyzeWithClaude(base64Data, mimeType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다. Vercel 프로젝트 환경변수를 확인하세요.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYZE_PROMPT },
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Claude API 오류 (${response.status})`);
  }

  const data = await response.json();
  const rawText = (data.content || []).find((block) => block.type === 'text')?.text || '{}';
  return extractJson(rawText);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  }

  const { imageDataUrl, mimeType } = req.body || {};

  if (!imageDataUrl || !mimeType) {
    return res.status(400).json({ error: 'imageDataUrl과 mimeType이 필요합니다.' });
  }

  const base64Data = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;

  try {
    const result = await analyzeWithClaude(base64Data, mimeType);
    res.status(200).json(result);
  } catch (err) {
    console.error('분석 실패:', err.message);
    res.status(502).json({ error: err.message });
  }
}

// ⚠️ [중요 제약사항] Vercel 서버리스 함수(Node.js 런타임)는 요청 본문(body) 크기가
// 기본적으로 최대 4.5MB로 고정되어 있고, 이 프로젝트는 Next.js가 아니라 순수 Vite라서
// "export const config = { api: { bodyParser: ... } }" 같은 설정으로 늘릴 수 없습니다.
// 사진을 찍은 원본 이미지는 base64로 변환하면 크기가 약 1.33배 커지기 때문에,
// 3.3MB가 넘는 원본 사진은 여기서 실패할 수 있습니다.
// → 프론트엔드(App.jsx)에서 이미지를 canvas로 리사이즈/압축한 뒤 전송하는 걸 강력히 권장합니다.
// (아래에서 별도로 안내드릴게요)
