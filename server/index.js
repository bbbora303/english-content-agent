import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ANALYZE_PROMPT } from '../lib/analyzePrompt.js';

// 💡 이 파일이 실제로 위치한 폴더(server/)를 기준으로 .env를 찾습니다.
// "node server/index.js"처럼 루트 폴더에서 실행하더라도, cwd(현재 실행 위치)와 무관하게
// 항상 server/.env를 정확히 찾도록 합니다.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 3001;

function extractJson(rawText) {
  const cleaned = (rawText || '{}').replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
  return JSON.parse(cleaned);
}

async function analyzeWithClaude(base64Data, mimeType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다. server/.env를 확인하세요.');

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

app.post('/api/analyze-image', async (req, res) => {
  const { imageDataUrl, mimeType } = req.body || {};

  if (!imageDataUrl || !mimeType) {
    return res.status(400).json({ error: 'imageDataUrl과 mimeType이 필요합니다.' });
  }

  const base64Data = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;

  try {
    const result = await analyzeWithClaude(base64Data, mimeType);
    res.json(result);
  } catch (err) {
    console.error('분석 실패:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ 콘텐츠 양산 에이전트 프록시 서버 실행 중: http://localhost:${PORT}`);
});
