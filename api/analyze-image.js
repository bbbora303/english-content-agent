// 💡 Vercel 서버리스 함수 버전 — server/index.js의 analyzeWithClaude 로직을 그대로 이식.
// 요청이 올 때만 실행되고 끝나는 구조라 Express의 app.post(...) 대신
// 파일 하나 = 엔드포인트 하나(/api/analyze-image)로 동작합니다.

import { ANALYZE_PROMPT } from '../lib/analyzePrompt.js';

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
