# بيبراس موهبة 🦫 — موقع تدريب على التفكير الحاسوبي

موقع عربي مجاني وثابت (HTML + CSS + JavaScript فقط، بدون أي build) للتدريب على مسابقة «بيبراس موهبة».
يعمل على الجوال والكمبيوتر، بدون تسجيل دخول، ويحفظ تقدّم الطالب في جهازه فقط (localStorage).

**المحتوى الجاهز:** 12 درسًا + 12 ملخصًا للطباعة + 20 سؤالًا أصليًا للمرحلة المتوسطة (الصف ٧–٩) + 20 مهمة من كتاب النشاط الرسمي لموهبة + 4 اختبارات + مولّد اختبار مخصص + مساعد ذكي.

---

## 1) نشر الموقع على GitHub Pages (رابط دائم ومجاني)

الرابط **لا ينتهي** ولا يحتاج تجديدًا، ويبقى شغّالًا ما دام المستودع موجودًا.

1. أنشئ حسابًا في <https://github.com> (إذا ما عندك).
2. اضغط **New repository**، سمّه مثلًا `bebras`، واختر **Public**، ثم **Create repository**.
3. في صفحة المستودع اضغط **uploading an existing file**، واسحب **محتويات** مجلد `bebras-site` كلها (وليس المجلد نفسه)، ثم **Commit changes**.
4. افتح **Settings ← Pages**، وفي **Branch** اختر `main` والمجلد `/ (root)`، ثم **Save**.
5. بعد دقيقة أو دقيقتين يظهر رابط موقعك: `https://اسم-حسابك.github.io/bebras/`

> لتعديل أي شيء لاحقًا: ارفع الملف المعدّل بنفس الطريقة، والموقع يتحدّث تلقائيًا.

---

## 2) تفعيل المساعد الذكي (Cloudflare Worker مجاني)

الموقع يعمل كاملًا بدون هذه الخطوة، ما عدا صفحة «المساعد الذكي».
مفتاح الـ API **لا يوضع أبدًا** في ملفات الموقع؛ يُحفظ كـ Secret داخل Cloudflare فقط.

1. أنشئ حسابًا مجانيًا في <https://dash.cloudflare.com>.
2. **Workers & Pages ← Create ← Create Worker**، سمّه `bebras-chat`، ثم **Deploy**.
3. اضغط **Edit code**، احذف الكود الموجود، والصق محتوى الملف [`worker/worker.js`](worker/worker.js) كاملًا، ثم **Deploy**.
4. من **Settings ← Variables and Secrets** أضف:
   | النوع | الاسم | القيمة |
   |---|---|---|
   | Secret | `ANTHROPIC_API_KEY` | مفتاح Claude من <https://console.anthropic.com> |
   | Text | `ALLOWED_ORIGINS` | `https://اسم-حسابك.github.io` (بدون مسار وبدون `/` في النهاية) |

   لاستخدام Gemini بدلًا من Claude: أضف Secret باسم `GEMINI_API_KEY` و Text باسم `PROVIDER` قيمته `gemini`.
5. انسخ رابط الـ Worker (مثل `https://bebras-chat.اسمك.workers.dev`) وضعه في ملف [`data/config.json`](data/config.json):
   ```json
   "chatEndpoint": "https://bebras-chat.اسمك.workers.dev"
   ```
   ثم ارفع الملف المعدّل إلى GitHub.

### الإعدادات (أعلى ملف `worker/worker.js`)
| الإعداد | المعنى |
|---|---|
| `provider` | `claude` أو `gemini` |
| `claude.model` | الافتراضي `claude-opus-5-5`. للتوفير: `claude-haiku-5-5` (واجعل `serverFallback: false`) |
| `claude.effort` | عمق التفكير قبل الرد: `low` / `medium` / `high` |
| `gemini.models` | النماذج بالترتيب: الأول أساسي والباقي احتياطي إذا كان مشغولًا (الافتراضي `gemini-3.5-flash` ثم `gemini-3.8-flash`) |
| `gemini.thinkingLevel` | عمق التفكير: `low` (أسرع، الافتراضي) / `medium` / `high` (أدق وأبطأ) |
| `gemini.temperature` | `null` = الافتراضي. نماذج Gemini 3 لا يُنصح فيها بخفض temperature |
| `limits.perMinute` | رسائل في الدقيقة لكل مستخدم، حماية من السبام (الافتراضي 10، و`0` = بلا حد) |
| `limits.perDay` | حد يومي لكل مستخدم (الافتراضي `0` = بلا حد) |
| `limits.maxMessageChars` | أقصى طول لرسالة الطالب (1000 حرف) |

**ملاحظة عن `temperature` في Claude:** واجهة Claude الحالية لم تعد تقبل `temperature` (ترفض الطلب)، لذلك يستخدم الـ Worker «التفكير التكيّفي»: النموذج يحل ويتحقق داخليًا قبل أن يكتب الرد، وهذا يحقق هدف الدقة. أما Gemini فيستخدم `temperature: 0.2` كما هو.

**ما يحميه الـ Worker:**
- المفتاح محفوظ كـ Secret، والـ system prompt (قواعد الدقة وطريقة الشرح والأمان) مكتوب في السيرفر ولا يمكن تغييره من المتصفح.
- يقبل الطلبات من نطاق موقعك فقط (CORS عبر `ALLOWED_ORIGINS`).
- يحدّ طول الرسالة وطول المحادثة وعدد الرسائل في الدقيقة.
- لا يخزّن المحادثات.

**التكلفة:** كل رسالة تُحسب على حساب مزود الذكاء الاصطناعي (Anthropic أو Google). راجع الأسعار في موقع المزود، وضع حدًّا للإنفاق من لوحة التحكم هناك.

---

## 3) إضافة محتوى بدون لمس الكود

كل المحتوى في مجلد `data/`:

| الملف | المحتوى |
|---|---|
| `data/skills.json` | قائمة المهارات (الاسم، الأيقونة، الوصف) |
| `data/skills/<id>.json` | الدرس `lesson` والملخص `summary` لكل مهارة |
| `data/questions/*.json` | الأسئلة، ملف لكل فئة. لإضافة ملف جديد اذكره في `data/questions/index.json` |
| `data/quizzes.json` | الاختبارات الجاهزة (قائمة أرقام الأسئلة؛ تُرتّب تلقائيًا من السهل للصعب) |
| `data/config.json` | رابط المساعد والأسئلة المقترحة في الدردشة |

### شكل السؤال
```json
{
  "id": "mid-21", "level": "mid", "skill": "patterns", "difficulty": "easy", "type": "mcq",
  "title": "عنوان قصير",
  "story": "القصة. **غامق** و `كود` وسطر جديد بـ \n",
  "question": "المطلوب",
  "figure": { "type": "row", "items": ["⭐", "🔵", "?"] },
  "options": ["أ", "ب", "ج", "د"], "answer": 1,
  "hint": "تلميح", "solution": ["خطوة 1", "خطوة 2"], "ct": "وين التفكير الحاسوبي هنا؟"
}
```
- `level`: `mid` | `book1` | `book2` — `difficulty`: `easy` | `medium` | `hard`
- `type` وحقوله:
  - `mcq`: `options` + `answer` (رقم الخيار يبدأ من 0)
  - `short`: `answer` نص، و`accept` قائمة إجابات مقبولة أخرى (اختياري). المقارنة تتجاهل المسافات والهمزات والأرقام العربية/الإنجليزية.
  - `order`: `items: [{id, label}]` بترتيب العرض، و`answer: [ids]` بالترتيب الصحيح
  - `drag`: `items`، و`bins: [{id, label, cap?}]`، و`answer: {itemId: binId}`
  - `map`: `figure` من نوع `graph` أو `grid`، و`mode`: `single` | `set` | `path`، و`answer` (رقم عقدة، أو قائمة، و`"r-c"` لخلايا الشبكة)

### الرسومات (تُرسم بالكود كـ SVG)
| النوع | مثال |
|---|---|
| `graph` | `{"type":"graph","nodes":[{"id":"A","x":40,"y":60,"label":"أ","sub":"البيت"}],"edges":[{"a":"A","b":"B","w":3}],"directed":false}` |
| `grid` | `{"type":"grid","rows":[". # 🤖", "⭐ . ."]}` — `.` فارغ، `#` جدار، وأي رمز آخر يُكتب داخل الخلية |
| `tree` | `{"type":"tree","root":{"label":"سؤال؟","children":[{"label":"ورقة","edge":"نعم"}]}}` |
| `row` | `{"type":"row","items":["1","2"],"arrows":true,"start":"البداية"}` (يُقرأ من اليمين) |
| `stack` | `{"type":"stack","items":["الأسفل","الأعلى"]}` |
| `bits` | `{"type":"bits","bits":"1011"}` |
| `table` | `{"type":"table","head":["أ","ب"],"rows":[["1","2"]]}` |
| `multi` | `{"type":"multi","items":[ ...رسومات... ]}` |
| `svg` | `{"type":"svg","svg":"<svg ...>...</svg>"}` |

ألوان التعبئة: `a` أزرق، `b` برتقالي، `c` أخضر، `d` بنفسجي، `e` أحمر، `f` أصفر، `wall` رمادي. تتغير تلقائيًا مع الوضع الداكن والطباعة.

---

## 4) التجربة على جهازك
المتصفح يمنع تحميل ملفات JSON إذا فتحت `index.html` مباشرة. شغّل خادمًا بسيطًا داخل المجلد:
```
python -m http.server 8000
```
ثم افتح `http://localhost:8000`. (أضف `http://localhost:8000` إلى `ALLOWED_ORIGINS` إذا أردت تجربة المساعد محليًا.)

---

## ملاحظات
- الموقع **غير رسمي**. المواعيد والشروط والتسجيل في الموقع الرسمي: <https://bebrasksa.org>
- كل الأسئلة من تأليف الموقع على نمط بيبراس، وليست منسوخة من الأسئلة الرسمية.
- الطباعة: زر «طباعة / حفظ PDF» في الدروس والملخصات والاختبارات وبنك الأسئلة يُخرج صفحات A4 نظيفة، مع مفتاح إجابات اختياري في صفحة منفصلة.
