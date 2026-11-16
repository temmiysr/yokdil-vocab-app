import { PartOfSpeech } from '../types/vocab';
import { getUserSettings } from './storage';

export interface AIAnalysisResult {
  turkish: string;
  ipa?: string;
  partOfSpeech: PartOfSpeech;
  lemma?: string;
  sentenceTranslation?: string;
  prepositions?: string[];
  collocations?: string[];
  academicUsage?: string;
}

/**
 * Kullanıcının isteğe bağlı girdiği API anahtarı (Gemini veya OpenAI) ile
 * seçilen ifadenin Türkçe çevirisini, kökünü, edatlarını ve collocations analizini üretir.
 * 
 * ÖNEMLİ KURAL: Bu veriler asla doğrudan veritabanına yazılmaz; kullanıcıya formda
 * düzenlenebilir öneriler olarak sunulur ve onayına bırakılır.
 */
export async function analyzeVocabularyWithAI(
  expression: string,
  sentence: string
): Promise<AIAnalysisResult | null> {
  const settings = getUserSettings();

  if (settings.aiProvider === 'none' || !settings.aiApiKey) {
    return null;
  }

  const prompt = `Sen uzman bir YÖKDİL ve Akademik İngilizce eğitmenisin.
Aşağıda verilen İngilizce kelime/ifadeyi ve geçtiği cümleyi analiz et:
Hedef İfade: "${expression}"
Cümle: "${sentence}"

Lütfen YALNIZCA geçerli bir JSON yanıtı döndür (markdown kod bloğu veya başka metin ekleme).
JSON formatı:
{
  "turkish": "İfadenin bu cümledeki Türkçe akademik karşılığı",
  "ipa": "İngilizce telaffuz fonetiği (IPA)",
  "partOfSpeech": "noun | verb | adjective | adverb | phrasal_verb | prepositional_phrase | idiom | collocation | conjunction | other",
  "lemma": "Kelimenin kök / yalın hali",
  "sentenceTranslation": "Cümlenin akıcı ve doğru Türkçe çevirisi",
  "prepositions": ["birlikte kullanılan edatlar örn: to, for"],
  "collocations": ["yaygın kelime birliktelikleri örn: major challenge"],
  "academicUsage": "Fen Bilimleri | Sağlık Bilimleri | Sosyal Bilimler | Genel Akademik"
}`;

  try {
    if (settings.aiProvider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${settings.aiApiKey.trim()}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API Hatası: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        return JSON.parse(rawText) as AIAnalysisResult;
      }
    } else if (settings.aiProvider === 'openai') {
      const url = 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.aiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'YÖKDİL ve akademik İngilizce dil analizi asistanı.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API Hatası: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content;
      if (rawText) {
        return JSON.parse(rawText) as AIAnalysisResult;
      }
    }
  } catch (err) {
    console.warn('AI Analizi çağrılamadı veya hata verdi:', err);
  }

  return null;
}
