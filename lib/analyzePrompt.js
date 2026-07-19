// 💡 교과서 페이지 이미지 분석용 프롬프트.
// server/index.js(로컬 Express)와 api/analyze-image.js(Vercel 서버리스)가
// 이 파일 하나를 공유해서 import합니다 — 두 곳에 복붙해서 따로 관리하던 것을
// 여기로 합쳐서 동기화 누락 위험을 없앴습니다 (CLAUDE.md 5-2/7-8 참고).
export const ANALYZE_PROMPT = `업로드된 이미지는 종이 교과서 페이지입니다. 이 페이지를 디지털 콘텐츠용 이미지로 분할하고, 텍스트를 추출해야 합니다.
1. 업로드된 지면이 어떤 콘텐츠 유형인지 먼저 판별해 contentType을 설정하세요. 값은 'understand', 'roleplay'(A형), 'roleplay_b'(B형) 중 하나입니다. 판별은 제목 문구가 아니라 지면의 레이아웃(구성 요소)을 근거로 합니다.
2. [A형 vs B형 구분 — '교체 표현 영역' 유무 기준]
   - 이 구분은 understand가 아닌 '대화 활동 지면'에만 적용합니다. 먼저 말풍선 중심의 본문 탐색형(코믹 컷)이면 understand로 판정하고(3번), 그 외의 대화 활동 지면에서만 아래 A형/B형 구분을 적용하세요.
   - 지면에 '교체 표현 영역'이 있으면 'roleplay_b'(B형)로 설정하세요. 교체 표현 영역이란, 예시 대화 속 특정 표현(target 슬롯)에 통째로 갈아끼울 수 있는 표현 후보들을 모아 놓은 영역입니다. 생김새는 다양합니다 — 우측/하단의 세로 목록형 'Tips' 상자, 여러 개의 선택지 박스 묶음(각 묶음이 중심어 + 좌우 선택지로 구성) 등. 생김새가 달라도 '대화 표현을 갈아끼우는 후보 목록' 역할이면 모두 교체 표현 영역으로 봅니다.
   - 지면에 교체 표현 영역이 없으면 'roleplay'(A형)로 설정하세요. 격자형 표 퀴즈가 있는 형태든, 표도 교체 영역도 없이 예시 대화만 있는 형태(화살표로 경로가 갈리는 분기 대화 포함)든, 교체 표현 영역이 없으면 A형입니다.
   - 주의: '격자형 표 퀴즈'와 '교체 표현 영역'은 서로 다른 것입니다. 표 퀴즈는 정보를 채우거나 대조하는 격자 과제이고, 교체 표현 영역은 대화 슬롯에 갈아끼울 표현 후보 목록입니다. 표 퀴즈가 있다고 해서 교체 표현 영역이 있는 것으로 보지 마세요.
   - 제목이 'Look and Talk' 또는 'Think and Talk'(대소문자·띄어쓰기·일부 색상 강조 변형 포함)이어도 그것만으로 B형으로 판정하지 마세요. 같은 제목이어도 교체 표현 영역이 없으면 A형입니다. 제목은 보조 참고로만 쓰고, 최종 판정은 교체 표현 영역의 유무로 합니다.
   - 표도 교체 영역도 없이 화살표로 대화가 두 갈래 이상으로 갈리는 '분기 대화형'은 A형의 하위 변형입니다. 'roleplay'(A형)로 판정하고, 텍스트 추출은 8-1번 지시를 따르세요.
3. 그 외 말풍선 중심의 본문 탐색형 내용이라면 'understand'로 설정하세요.
4. 최상단의 메인 발문(지시문) 텍스트를 찾아 'instruction' 필드에 추출하세요. (예: "친구의 고민에 공감을 표현하고 조언한 후...")
5. 최상단 제목의 알파벳(예: B)을 'letter' 필드에, 텍스트(예: Talk and Complete, Understand)를 'title' 필드에 추출하세요. 단, contentType이 roleplay_b이면 9-(1)의 활동 블록 머리글 기준을 우선 적용하세요(한 페이지에 다른 활동이 함께 있을 때 최상단 제목이 아니라 이 활동 블록 자체의 머리글을 써야 합니다).
6. [Understand인 경우] 코믹 컷(보통 4개)을 찾아 각 컷의 좌표를 백분율(%)로 정확히 추출하세요.
   - 각 컷마다 'x_percent'(왼쪽 시작 위치), 'y_percent'(위쪽 시작 위치), 'width_percent'(너비), 'height_percent'(높이)를 반드시 채우세요. 전체 이미지 기준 백분율이며, 컷끼리 좌표가 겹치지 않아야 합니다.
   - 예를 들어 2x2 배열의 4컷 만화라면: 1번 컷(좌상단)은 x_percent:0, y_percent:0, width_percent:50, height_percent:50 근처, 2번 컷(우상단)은 x_percent:50, y_percent:0, width_percent:50, height_percent:50 근처와 같은 방식으로, 실제 그림이 배치된 위치를 보고 정확히 추정하세요.
   - 각 컷의 말풍선 안 영어 문장을 추출한 뒤, 아래 절차로 'textType'을 판정하세요 (말풍선 너비는 550px, 폰트는 27px 굵은 sans-serif 기준이며, 이 조건에서 한 줄에 들어갈 수 있는 글자 수는 대략 35~40자입니다):
     1) 말풍선 안에 서로 다른(각각 별도 음성으로 재생될) 영어 문장이 몇 개인지 센다.
     2) 문장이 정확히 1개이면: 그 문장의 길이가 약 35~40자 이내로 한 줄에 들어가면 'inline', 그보다 길어서 한 줄에 못 들어가면(줄바꿈이 필요하면) 'lines'로 판정한다.
     3) 문장이 2개 이상이면: 모든 문장을 합쳤을 때 총 길이가 약 35~40자 이내로 한 줄에 다 들어가면 'inline', 못 들어가면(강제로 문장 하나당 줄 하나를 차지하는 게 아니라, 여러 문장의 영어 텍스트가 자연스럽게 쭉 이어지다가 필요한 지점에서 줄바꿈되고 그 줄바꿈 위치에 맞춰 대응하는 한글 해석도 함께 나뉘어 배치되는 형태) 'zipper'로 판정한다.
   - 컷마다 문장 개수와 길이가 다르므로, 4개 컷 모두 같은 textType으로 몰아서 판정하지 말고 컷별로 위 절차를 각각 새로 적용하세요.
7. [Roleplay(A형)인 경우] 먼저 지면에 화살표로 대화가 두 갈래 이상 갈리는 구조가 있는지부터 확인하세요.
   **있다면 이 7번 규칙을 적용하지 말고 8-1번 지시를 따르세요** (7번은 분기가 없는 일반 A형 지면 전용
   규칙입니다). 분기가 없다면: 컷 구분 없이 전체를 1개의 컷(views 배열에 originalInfo:"전체 뷰" 1개만)으로
   간주하고, 이미지 내에 있는 대화문(A, B 등)을 순서대로 읽어내어 speaker, sentence(영어), kor(한국어 해석)로
   배열화하여 추출하세요.
8. [Roleplay(A형)이고, 대화문 우측(또는 하단)에 표(Table) 형태의 퀴즈가 함께 보이는 경우] 최상위에 'tableQuiz' 객체를 추가하고, 아래를 추출하세요.
   - 'headers': 표의 맨 위 헤더 행(열 제목)에 적힌 텍스트를 왼쪽 열부터 순서대로 문자열 배열로 추출하세요. (예: ["Name", "Activity", "How often?"])
   - 'staticRow': 헤더 바로 아래에 예시로 이미 채워져 있는 첫 번째 데이터 행(학생이 채워야 할 빈칸 행이 아니라, 견본으로 미리 적혀 있는 행)의 텍스트를 headers와 같은 순서/개수로 문자열 배열로 추출하세요. (예: ["Minho", "playing basketball", "every day"])
   - 표 전체가 비어 있거나(학생이 채울 빈칸만 있고 예시 행이 없음) 표 자체가 이미지에 없다면 'tableQuiz' 필드를 아예 생략하세요. 오디오 ID는 이미지만으로 알 수 없으므로 추출하지 마세요.
   - Roleplay_b(표 퀴즈가 없는 유형)에는 이 필드를 사용하지 마세요.
8-1. [Roleplay(A형)이고, 화살표로 대화가 두 갈래 이상으로 갈리는 '분기 대화형'인 경우 — 텍스트 추출]
   지면에 공통으로 시작하는 대사 뒤에 화살표(➘➙ 등, 방향·모양 무관)가 여러 갈래로 뻗어나가고, 갈래마다
   이어지는 대사가 다르게 이어지는 구조입니다(예: 첫 질문에 "Yes"로 답하는 갈래와 "No"로 답하는 갈래가
   나란히 배치됨). 이 경우 7번의 "컷 구분 없이 view 1개" 규칙 대신 아래를 따르세요.
   - 갈래(화살표로 갈라진 경로) 개수만큼 views를 만드세요(예: 화살표가 2개면 view 2개, originalInfo는
     "view 1", "view 2"...).
   - 각 view는 "분기 이전 공통 대사"부터 "그 갈래의 마지막 대사"까지, 실제 그 갈래를 처음부터 끝까지
     읽었을 때의 순서 그대로 전부 담아 완결된 하나의 대화가 되게 하세요. 공통 대사를 생략하거나 갈래
     시작점부터만 담으면 안 됩니다 — 각 view는 다른 view를 참조하지 않고도 그 자체로 완전한 대화여야
     합니다.
   - 화자(speaker)는 지면에 표시된 대로(A/B) 유지하고, 공통 대사와 갈래별 대사 모두 동일한 speaker
     교대 규칙을 따릅니다.
   - tableQuiz는 사용하지 않습니다(분기형 지면에는 표 퀴즈가 없습니다).
   - 화살표 분기 구조가 아닌(단순 순차 대화) 일반 A형 지면에는 이 지시를 적용하지 말고 7번을 그대로
     따르세요.
9. [contentType이 'roleplay_b'(B형)인 경우 — 텍스트 추출]
   B형 지면은 '짝과 나누는 예시 대화' 1개와, 그 대화의 특정 표현을 갈아끼우는 '교체 표현 영역'으로 구성됩니다. 씬 이미지 좌표(x_percent 등)는 추출하지 마세요(씬 이미지는 사용자가 편집 도구에서 직접 업로드하며, 지면에 이미지가 아예 없는 경우도 있습니다). 아래 규칙에 따라 텍스트만 정확히 추출하세요.

   (1) [머리글] 이 활동 블록의 머리글에서 letter(예: "B"), title(예: "Look and Talk"/"Think and Talk"), instruction(발문)을 가져오세요. 한 페이지에 다른 활동(듣기, Get Ready 등)이 함께 있어도 이 블록의 것만 사용하고, 페이지 상단 제목이나 다른 활동의 발문을 넣지 마세요.
   (2) [발문 정규화] 발문에 "위 그림"·"아래 그림"처럼 그림의 위치를 가리키는 표현이 있으면 모두 "다음 그림~" 형태로 바꿔서 instruction에 넣으세요. (위치 언급이 있어도 그 때문에 view를 나누지 않습니다.)
   (3) [교체 표현 영역 추출] 교체 표현 영역의 항목들을 순서대로 tips 배열에 추출하세요. 항목은 짧은 명사구일 수도, 문장 전체일 수도 있습니다. 선택지 박스 묶음처럼 '중심어 + 선택지들'로 된 경우에는 한 묶음을 한 tips 항목으로 묶어(예: "running — in the park / by the river") 담으세요.
   (4) [target 슬롯 판정] 예시 대화 속에서 tips 첫 항목과 글자가 일치하는 표현을 찾아, 그 표현을 '교체 대상 슬롯(target 슬롯)'으로 봅니다. 색으로 판정하지 마세요 — 색은 지면마다 다를 수 있고, 일치 여부가 기준입니다.
   (5) [view 전개 — 단일 슬롯형] 교체 표현 영역이 단순 목록형이고 target 슬롯이 대화에 1군데이면, tips 항목 수만큼 views를 만드세요. view 1 = 지면 인쇄 원문 그대로(슬롯에 tips[0]), view 2 = 그 슬롯만 tips[1]로 교체, … tips[i]를 슬롯에 갈아끼운 대화를 각 view의 eng로 넣습니다. 슬롯 이외의 대사는 모든 view에서 동일합니다. 교체 단위는 명사구일 수도, 문장 전체일 수도 있으며 tips 항목을 그대로 슬롯에 넣습니다. views는 tips 항목 수와 반드시 동일한 개수로 전부 생성하세요 — 아래 예시에서 지면 절약을 위해 일부 view만 표기했더라도, 실제 출력에는 생략 없이 tips 개수만큼 전부 포함해야 합니다.
   (6) [view 전개 — 다중 선택지형] 교체 표현 영역이 여러 묶음/여러 선택지로 된 경우에는 view를 자동으로 전개하거나 조합하지 마세요. 예시 대화 원문만 view 1로 추출하고, 각 묶음의 부품(중심어·선택지)은 (3)의 tips에 보존하세요. 조합은 이후 편집 단계에서 사용자가 수행합니다.
   (7) [고정 강조 표현] target 슬롯이 아닌데 강조된 표현(tips에 없는 강조 표현)은 view별로 자동 교체하지 마세요. 원문 그대로 모든 view에 동일하게 두세요(이후 사용자가 편집 도구에서 직접 수정합니다).
   (8) [대사 필드] 각 대사는 speaker(A/B), sentence(영어 원문), kor(한국어 해석)로 추출하세요. 지면에 해석이 있으면 그대로 쓰고, 영어만 있으면 자연스러운 한국어 해석을 생성해 넣으세요.
   (9) [강조 마킹] 지면에서 색으로 강조된 표현은 sentence 안에서 <span class='emp col-N'>...</span>로 감싸세요. 색-클래스 매핑은 파란색=col-1, 분홍색=col-2, 붉은색=col-0입니다. 지면의 실제 강조 색을 살려 배정하세요.

결과물은 반드시 아래 JSON 구조(views 배열 필수 포함)로만 답변하세요, 다른 설명이나 마크다운 없이 순수 JSON만 출력하세요. contentType이 roleplay_b인 경우 tips 배열도 최상위에 반드시 포함하세요:
[Understand 예시 - 문장 2개가 한 줄에 들어가서 inline]
{ "contentType": "understand", "letter": "A", "title": "Understand", "instruction": "다음을 보고, 여러 나라의 건강한 삶의 방식을 알아봅시다.", "views": [ { "originalInfo": "컷 1", "x_percent": 0, "y_percent": 0, "width_percent": 50, "height_percent": 50, "textType": "inline", "eng": [ { "sentence": "Hi, I'm Lisa.", "kor": "안녕, 나는 리사야." }, { "sentence": "I live in the Netherlands.", "kor": "나는 네덜란드에 살아." } ] },
[Understand 예시 - 문장 1개가 길어서 줄바꿈, lines]
{ "originalInfo": "컷 2", "x_percent": 50, "y_percent": 0, "width_percent": 50, "height_percent": 50, "textType": "lines", "eng": [ { "lines": [ { "en": "I stay healthy because I", "ko": "나는 건강해요, 왜냐하면" }, { "en": "always ride a bike to school.", "ko": "항상 자전거로 등교하기 때문이에요." } ] } ] },
[Understand 예시 - 문장 2개를 합치면 한 줄에 안 들어가서 zipper]
{ "originalInfo": "컷 3", "x_percent": 0, "y_percent": 50, "width_percent": 50, "height_percent": 50, "textType": "zipper", "eng": [ { "sentence": "Hi, I'm Julian from Greece.", "kor": "안녕, 나는 그리스에 사는 줄리안이야." }, { "sentence": "I'm 90 years old, and I'm healthy.", "kor": "나는 90살이고, 건강해." } ] } ] }
[Roleplay 예시 - 우측에 표 퀴즈가 함께 있는 경우]
{ "contentType": "roleplay", "letter": "B", "title": "Talk and Complete", "instruction": "친구의 고민에 공감을 표현하고 조언한 후, 표를 채워 봅시다.", "views": [ { "originalInfo": "전체 뷰", "textType": "lines", "eng": [ { "speaker": "A", "sentence": "What do you usually do?", "kor": "보통 무엇을 하니?" } ] } ], "tableQuiz": { "headers": ["Name", "Activity", "How often?"], "staticRow": ["Minho", "playing basketball", "every day"] } }
[Roleplay 예시 - 화살표 분기형(8-1번). 공통 대사(Have you heard...) 뒤 화살표가 Yes/No 두 갈래로 갈림 → view 2개, 각 view가 공통 대사부터 그 갈래 끝까지 전부 포함. 표 퀴즈 없음]
{ "contentType": "roleplay", "letter": "B", "title": "Think and Talk", "instruction": "최근 개봉 예정인 영화에 대해 짝과 대화해 봅시다.", "views": [ { "originalInfo": "view 1", "eng": [ { "speaker": "A", "sentence": "Have you heard about the new movie A Stranger from Mars?", "kor": "새로 나온 영화 「화성에서 온 이방인」에 대해 들어본 적이 있니?" }, { "speaker": "B", "sentence": "Yes, I have. I heard it has a great story.", "kor": "응, 있어. 나는 그것의 이야기가 멋지다고 들었어." }, { "speaker": "A", "sentence": "Let's watch it together.", "kor": "함께 보러 가자." }, { "speaker": "B", "sentence": "Sounds good! I'm looking forward to it.", "kor": "좋아! 나는 그것이 기대돼." } ] }, { "originalInfo": "view 2", "eng": [ { "speaker": "A", "sentence": "Have you heard about the new movie A Stranger from Mars?", "kor": "새로 나온 영화 「화성에서 온 이방인」에 대해 들어본 적이 있니?" }, { "speaker": "B", "sentence": "No, I haven't.", "kor": "아니, 없어." }, { "speaker": "A", "sentence": "I heard it has a great story. I'm looking forward to it.", "kor": "나는 그것의 이야기가 멋지다고 들었어. 나는 그것이 기대돼." }, { "speaker": "B", "sentence": "Sounds good! Let's watch it together.", "kor": "좋아! 함께 보러 가자." } ] } ] }
[B형 예시 1 - 단일 슬롯형 / 문장 통째 교체 / 강조 2색(파란=고정 표현 col-1, 분홍=target 슬롯 col-2). tips 4개 → view 4개. target 외 파란 강조는 전 view 고정]
{ "contentType": "roleplay_b", "letter": "B", "title": "Look and Talk", "instruction": "동영상의 내용 중 흥미로운 것을 골라 짝과 대화를 나누어 봅시다.", "views": [ {"originalInfo":"view 1 (발 크기)","eng":[{"speaker":"A","sentence":"I heard from a video that <span class='emp col-1'>our foot size changes during the day</span>.","kor":"영상에서 봤는데, 우리 발 크기가 하루 동안 변한대."},{"speaker":"B","sentence":"Really? Can you tell me more about it?","kor":"정말? 좀 더 말해줄래?"},{"speaker":"A","sentence":"<span class='emp col-2'>Our feet are bigger in the evening than in the morning.</span>","kor":"우리 발은 아침보다 저녁에 더 커."},{"speaker":"B","sentence":"That's interesting!","kor":"흥미롭다!"}]}, {"originalInfo":"view 2 (웃음)","eng":[{"speaker":"A","sentence":"I heard from a video that <span class='emp col-1'>our foot size changes during the day</span>.","kor":"영상에서 봤는데, 우리 발 크기가 하루 동안 변한대."},{"speaker":"B","sentence":"Really? Can you tell me more about it?","kor":"정말? 좀 더 말해줄래?"},{"speaker":"A","sentence":"<span class='emp col-2'>Laughing hard for 10 to 15 minutes can burn about 40 calories.</span>","kor":"10~15분 동안 크게 웃으면 약 40칼로리를 태울 수 있어."},{"speaker":"B","sentence":"That's interesting!","kor":"흥미롭다!"}]}, {"originalInfo":"view 3 (뼈)","eng":[{"speaker":"A","sentence":"I heard from a video that <span class='emp col-1'>our foot size changes during the day</span>.","kor":"영상에서 봤는데, 우리 발 크기가 하루 동안 변한대."},{"speaker":"B","sentence":"Really? Can you tell me more about it?","kor":"정말? 좀 더 말해줄래?"},{"speaker":"A","sentence":"<span class='emp col-2'>Some small, soft bones join together as babies grow.</span>","kor":"작고 부드러운 뼈 몇 개가 아기가 자라면서 서로 붙어."},{"speaker":"B","sentence":"That's interesting!","kor":"흥미롭다!"}]}, {"originalInfo":"view 4 (눈물)","eng":[{"speaker":"A","sentence":"I heard from a video that <span class='emp col-1'>our foot size changes during the day</span>.","kor":"영상에서 봤는데, 우리 발 크기가 하루 동안 변한대."},{"speaker":"B","sentence":"Really? Can you tell me more about it?","kor":"정말? 좀 더 말해줄래?"},{"speaker":"A","sentence":"<span class='emp col-2'>It's because the eyes and nose are connected.</span>","kor":"눈과 코가 연결되어 있어서 그래."},{"speaker":"B","sentence":"That's interesting!","kor":"흥미롭다!"}] } ], "tips": [ "Our feet are bigger in the evening than in the morning.", "Laughing hard for 10 to 15 minutes can burn about 40 calories.", "Some small, soft bones join together as babies grow.", "It's because the eyes and nose are connected." ] }
[B형 예시 2 - 단일 슬롯형 / 명사구 교체 / 강조 1색(파란=col-1). tips 6개 → view 6개. 아래는 view 1~2만 표기, view 3~6은 target 슬롯("a flower pattern" 자리)만 tips[2]~tips[5]로 교체하고 나머지는 동일. umbrella·yellow는 tips에 없으므로 전 view 고정]
{ "contentType": "roleplay_b", "letter": "B", "title": "Look and Talk", "instruction": "다음 그림을 보고, 분실물 센터에서 잃어버린 것을 찾는 대화를 나눠 봅시다.", "views": [ {"originalInfo":"view 1","eng":[{"speaker":"A","sentence":"Hello, may I help you?","kor":"안녕하세요, 도와드릴까요?"},{"speaker":"B","sentence":"I lost my <span class='emp col-1'>umbrella</span> in this park.","kor":"이 공원에서 우산을 잃어버렸어요."},{"speaker":"A","sentence":"I'm sorry to hear that. What does it look like?","kor":"저런, 어떻게 생겼나요?"},{"speaker":"B","sentence":"It's <span class='emp col-1'>yellow</span>. Also, it has <span class='emp col-1'>a flower pattern</span>.","kor":"노란색이에요. 그리고 꽃무늬가 있어요."},{"speaker":"A","sentence":"Okay. I'll call you when we find it.","kor":"알겠습니다. 찾으면 연락드릴게요."}]}, {"originalInfo":"view 2","eng":[{"speaker":"A","sentence":"Hello, may I help you?","kor":"안녕하세요, 도와드릴까요?"},{"speaker":"B","sentence":"I lost my <span class='emp col-1'>umbrella</span> in this park.","kor":"이 공원에서 우산을 잃어버렸어요."},{"speaker":"A","sentence":"I'm sorry to hear that. What does it look like?","kor":"저런, 어떻게 생겼나요?"},{"speaker":"B","sentence":"It's <span class='emp col-1'>yellow</span>. Also, it has <span class='emp col-1'>a brown handle</span>.","kor":"노란색이에요. 그리고 갈색 손잡이가 있어요."},{"speaker":"A","sentence":"Okay. I'll call you when we find it.","kor":"알겠습니다. 찾으면 연락드릴게요."}] } ], "tips": [ "a flower pattern", "a brown handle", "many pockets", "a star pattern", "a long body", "short ears" ] }
[B형 예시 3 - 다중 선택지형 / view 자동 전개·조합 안 함(view 1만) / 교체 후보는 tips에 묶음 단위로 보존]
{ "contentType": "roleplay_b", "letter": "B", "title": "Think and Talk", "instruction": "각 항목에서 선호하는 것을 고른 후, 짝과 함께 대화를 나누어 봅시다.", "views": [ {"originalInfo":"view 1","eng":[{"speaker":"A","sentence":"I'm thinking of <span class='emp col-1'>running</span> this weekend.","kor":"나 이번 주말에 달리기 할까 생각 중이야."},{"speaker":"B","sentence":"That sounds good. Which do you prefer, <span class='emp col-1'>running in the park</span> or <span class='emp col-1'>by the river</span>?","kor":"좋다. 공원에서 달리는 게 좋아, 아니면 강가에서 달리는 게 좋아?"},{"speaker":"A","sentence":"I prefer <span class='emp col-1'>running by the river</span>. The view is beautiful.","kor":"난 강가에서 달리는 게 좋아. 경치가 아름답거든."}] } ], "tips": [ "running — in the park / by the river", "watching a movie — at home / at the theater", "reading books — in the library / at home", "playing games — alone / with friends" ] }`;
