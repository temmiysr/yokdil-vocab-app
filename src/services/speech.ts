/**
 * Tarayıcı yerleşik Web Speech API (speechSynthesis) ile İngilizce telaffuz servisi.
 * Harici API gerektirmez, sıfır maliyetlidir ve çevrimdışı da çalışır.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
  });
}

/**
 * İngilizce kelime veya cümleyi seslendirir.
 * Tercihen en kaliteli en-US veya en-GB sesini seçer.
 */
export async function speakEnglish(text: string, rate: number = 0.9): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Tarayıcınızda Web Speech API desteklenmiyor.');
    return;
  }

  // Önceki konuşmayı durdur
  window.speechSynthesis.cancel();

  const cleanText = text.trim();
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = rate; // Doğal ve net telaffuz için hafifçe yavaşlatılmış
  utterance.pitch = 1.0;

  if (cachedVoices.length === 0) {
    await loadVoices();
  }

  // Uygun İngilizce ses seçimi (Google, Microsoft veya doğal sistem sesleri)
  const englishVoice =
    cachedVoices.find((v) => v.lang === 'en-US' && (v.name.includes('Natural') || v.name.includes('Google'))) ||
    cachedVoices.find((v) => v.lang.startsWith('en-US')) ||
    cachedVoices.find((v) => v.lang.startsWith('en-GB')) ||
    cachedVoices.find((v) => v.lang.startsWith('en'));

  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  window.speechSynthesis.speak(utterance);
}
