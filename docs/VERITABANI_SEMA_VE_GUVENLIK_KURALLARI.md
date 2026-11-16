# YÖKDİL Master – Veritabanı Şeması ve Güvenlik Kuralları

Bu doküman, uygulamanın telefon ve bilgisayar arasında çoklu cihaz senkronizasyonu için desteklediği **Supabase (PostgreSQL)** ve **Firebase (Firestore)** veritabanı şemalarını ve satır düzeyinde güvenlik (Row-Level Security - RLS) kurallarını içerir.

---

## 1. Supabase (PostgreSQL) Şeması ve RLS Kuralları

Supabase SQL Editöründe aşağıdaki SQL komutunu çalıştırarak gerekli tabloları, indeksleri ve güvenlik kurallarını tek seferde oluşturabilirsiniz.

```sql
-- 1. Haftalar Tablosu (weeks)
CREATE TABLE IF NOT EXISTS public.weeks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Okuma Metinleri Tablosu (readings)
CREATE TABLE IF NOT EXISTS public.readings (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_id TEXT REFERENCES public.weeks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'Genel Akademik',
    date_added TIMESTAMPTZ DEFAULT NOW(),
    file_type TEXT DEFAULT 'manual',
    file_name TEXT,
    word_count INT DEFAULT 0,
    saved_word_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Kelime Kartları Tablosu (vocab_cards)
CREATE TABLE IF NOT EXISTS public.vocab_cards (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    english TEXT NOT NULL,
    turkish TEXT NOT NULL,
    ipa TEXT,
    part_of_speech TEXT NOT NULL,
    lemma TEXT,
    original_sentence TEXT NOT NULL,
    sentence_translation TEXT,
    prepositions TEXT[] DEFAULT '{}',
    collocations TEXT[] DEFAULT '{}',
    academic_usage TEXT DEFAULT 'Genel Akademik',
    reading_id TEXT REFERENCES public.readings(id) ON DELETE SET NULL,
    reading_title TEXT,
    week_id TEXT REFERENCES public.weeks(id) ON DELETE SET NULL,
    week_title TEXT,
    sources JSONB DEFAULT '[]'::jsonb,
    source_type TEXT DEFAULT 'user_reading',
    exam_info JSONB,
    is_difficult BOOLEAN DEFAULT FALSE,
    notes TEXT,
    
    -- Spaced Repetition (SRS) Alanları
    srs_state TEXT DEFAULT 'new',
    srs_interval INT DEFAULT 0,
    srs_ease_factor NUMERIC(3,2) DEFAULT 2.50,
    srs_repetitions INT DEFAULT 0,
    srs_lapses INT DEFAULT 0,
    srs_last_reviewed_at TIMESTAMPTZ,
    srs_next_review_at DATE NOT NULL DEFAULT CURRENT_DATE,
    review_history JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Kullanıcı Ayarları Tablosu (user_settings)
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'system',
    notification_time TEXT DEFAULT '20:00',
    telegram_enabled BOOLEAN DEFAULT FALSE,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    app_url TEXT,
    daily_review_goal INT DEFAULT 20,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hızlı Sorgulama İndeksleri
CREATE INDEX IF NOT EXISTS idx_vocab_user ON public.vocab_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_next_review ON public.vocab_cards(user_id, srs_next_review_at);
CREATE INDEX IF NOT EXISTS idx_readings_week ON public.readings(week_id);

-- ==========================================
-- GÜVENLİK KURALLARI: Row Level Security (RLS)
-- Her kullanıcı YALNIZCA kendi verilerini okuyabilir, ekleyebilir, güncelleyebilir ve silebilir.
-- ==========================================

ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own weeks"
ON public.weeks FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access their own readings"
ON public.readings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access their own vocab cards"
ON public.vocab_cards FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only access their own settings"
ON public.user_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## 2. Firebase Firestore Güvenlik Kuralları (firestore.rules)

Firebase Console -> Firestore Database -> Rules sekmesine aşağıdaki kuralları yapıştırabilirsiniz:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Her kullanıcı yalnızca kendi kullanıcı kimliği (UID) altındaki alt koleksiyonlara erişebilir
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /{allSubcollections=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Diğer tüm yollar varsayılan olarak erişime kapalıdır
    match /{document=**} {
      allow read, write: false;
    }
  }
}
```
