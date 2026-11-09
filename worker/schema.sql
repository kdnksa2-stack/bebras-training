-- جداول سجلات الطلاب والمعلمين
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,          -- معرّف عشوائي يُنشأ في جهاز الطالب
  role TEXT NOT NULL,           -- student | teacher
  name TEXT NOT NULL,
  grade TEXT,                   -- m1 | m2 | m3 (للطلاب فقط)
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ts INTEGER NOT NULL,          -- وقت الحدث (ملي ثانية)
  type TEXT NOT NULL,           -- visit | practice | exam
  page TEXT,
  ref TEXT,                     -- رقم السؤال أو الاختبار
  title TEXT,
  ok INTEGER,                   -- 1 صحيح / 0 خطأ (للتدريب)
  score INTEGER, total INTEGER, seconds INTEGER,
  detail TEXT                   -- JSON صغير (مثل الأسئلة الخاطئة)
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, ts);
