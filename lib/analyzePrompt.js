// 💡 교과서 페이지 이미지 분석용 프롬프트.
// server/index.js(로컬 Express)와 api/analyze-image.js(Vercel 서버리스)가
// 이 파일 하나를 공유해서 import합니다 — 두 곳에 복붙해서 따로 관리하던 것을
// 여기로 합쳐서 동기화 누락 위험을 없앴습니다 (CLAUDE.md 5-2/7-8 참고).
export const ANALYZE_PROMPT = `업로드된 이미지는 종이 교과서 페이지입니다. 이 페이지를 디지털 콘텐츠용 이미지로 분할하고, 텍스트를 추출해야 합니다.
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
8. [Roleplay(A형)이고, 대화문 우측(또는 하단)에 표(Table) 형태의 퀴즈가 함께 보이는 경우] 최상위에 'tableQuiz' 객체를 추가하고, 아래를 추출하세요.
   - 'headers': 표의 맨 위 헤더 행(열 제목)에 적힌 텍스트를 왼쪽 열부터 순서대로 문자열 배열로 추출하세요. (예: ["Name", "Activity", "How often?"])
   - 'staticRow': 헤더 바로 아래에 예시로 이미 채워져 있는 첫 번째 데이터 행(학생이 채워야 할 빈칸 행이 아니라, 견본으로 미리 적혀 있는 행)의 텍스트를 headers와 같은 순서/개수로 문자열 배열로 추출하세요. (예: ["Minho", "playing basketball", "every day"])
   - 표 전체가 비어 있거나(학생이 채울 빈칸만 있고 예시 행이 없음) 표 자체가 이미지에 없다면 'tableQuiz' 필드를 아예 생략하세요. 오디오 ID는 이미지만으로 알 수 없으므로 추출하지 마세요.
   - Roleplay_b(표 퀴즈가 없는 유형)에는 이 필드를 사용하지 마세요.

결과물은 반드시 아래 JSON 구조(views 배열 필수 포함)로만 답변하세요, 다른 설명이나 마크다운 없이 순수 JSON만 출력하세요:
[Understand 예시 - 문장 2개가 한 줄에 들어가서 inline]
{ "contentType": "understand", "letter": "A", "title": "Understand", "instruction": "다음을 보고, 여러 나라의 건강한 삶의 방식을 알아봅시다.", "views": [ { "originalInfo": "컷 1", "x_percent": 0, "y_percent": 0, "width_percent": 50, "height_percent": 50, "textType": "inline", "eng": [ { "sentence": "Hi, I'm Lisa.", "kor": "안녕, 나는 리사야." }, { "sentence": "I live in the Netherlands.", "kor": "나는 네덜란드에 살아." } ] },
[Understand 예시 - 문장 1개가 길어서 줄바꿈, lines]
{ "originalInfo": "컷 2", "x_percent": 50, "y_percent": 0, "width_percent": 50, "height_percent": 50, "textType": "lines", "eng": [ { "lines": [ { "en": "I stay healthy because I", "ko": "나는 건강해요, 왜냐하면" }, { "en": "always ride a bike to school.", "ko": "항상 자전거로 등교하기 때문이에요." } ] } ] },
[Understand 예시 - 문장 2개를 합치면 한 줄에 안 들어가서 zipper]
{ "originalInfo": "컷 3", "x_percent": 0, "y_percent": 50, "width_percent": 50, "height_percent": 50, "textType": "zipper", "eng": [ { "sentence": "Hi, I'm Julian from Greece.", "kor": "안녕, 나는 그리스에 사는 줄리안이야." }, { "sentence": "I'm 90 years old, and I'm healthy.", "kor": "나는 90살이고, 건강해." } ] } ] }
[Roleplay 예시 - 우측에 표 퀴즈가 함께 있는 경우]
{ "contentType": "roleplay", "letter": "B", "title": "Talk and Complete", "instruction": "친구의 고민에 공감을 표현하고 조언한 후, 표를 채워 봅시다.", "views": [ { "originalInfo": "전체 뷰", "textType": "lines", "eng": [ { "speaker": "A", "sentence": "What do you usually do?", "kor": "보통 무엇을 하니?" } ] } ], "tableQuiz": { "headers": ["Name", "Activity", "How often?"], "staticRow": ["Minho", "playing basketball", "every day"] } }`;
