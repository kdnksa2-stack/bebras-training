-- صلاحيات لوحة المشرف
-- أجهزة المالك: تدخل اللوحة بدون كلمة مرور وترى كلمة المرور (يُحفظ هاش الرمز فقط)
CREATE TABLE IF NOT EXISTS owner_devices (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  label TEXT,
  created INTEGER NOT NULL,
  last_used INTEGER
);
-- أشخاص من الموقع (طلاب/معلمون) مسموح لهم بالمشاهدة فقط من أجهزتهم
CREATE TABLE IF NOT EXISTS viewers (
  user_id TEXT PRIMARY KEY,
  created INTEGER NOT NULL
);
-- جلسات مؤقتة (12 ساعة) تُعطى لمن لديه صلاحية المشاهدة عند ضغطه زر «لوحة المشرف»
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
