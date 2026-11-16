const {
  useState,
  useEffect,
  useRef
} = React;
const STORAGE_KEYS = {
  WEEKS: 'yokdil_weeks_v1',
  READINGS: 'yokdil_readings_v1',
  VOCAB: 'yokdil_vocab_cards_v1',
  SETTINGS: 'yokdil_user_settings_v1',
  ACTIVITY: 'yokdil_activity_v1'
};
function getStored(key, def) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : def;
  } catch (e) {
    return def;
  }
}
function setStored(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
const IDB_NAME = 'yokdil-master',
  IDB_STORE = 'kv';
const STORAGE_MODE_KEY = 'yokdil_storage_mode_v2';
let idbPromise = null;
const idbOpen = () => {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB yok'));
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB engellendi'));
    });
    idbPromise.catch(() => {
      idbPromise = null;
    });
  }
  return idbPromise;
};
const idbGet = async key => {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const r = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
};
const idbSet = async (key, val) => {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('İşlem iptal edildi'));
  });
};
const isQuotaError = e => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message || ''));
const DATA_KEYS = [STORAGE_KEYS.WEEKS, STORAGE_KEYS.READINGS, STORAGE_KEYS.VOCAB, STORAGE_KEYS.SETTINGS, STORAGE_KEYS.ACTIVITY];
async function loadAllData() {
  const fromLocal = () => Object.fromEntries(DATA_KEYS.map(k => [k, getStored(k, undefined)]));
  try {
    if (localStorage.getItem(STORAGE_MODE_KEY) === 'idb') {
      const out = {};
      for (const k of DATA_KEYS) {
        const v = await idbGet(k);
        out[k] = v !== undefined ? v : getStored(k, undefined);
      }
      return {
        data: out,
        mode: 'idb'
      };
    }
    const local = fromLocal();
    for (const k of DATA_KEYS) if (local[k] !== undefined) await idbSet(k, local[k]);
    for (const k of DATA_KEYS) {
      if (local[k] === undefined) continue;
      const back = await idbGet(k);
      if (JSON.stringify(back) !== JSON.stringify(local[k])) throw new Error('Taşıma doğrulanamadı: ' + k);
    }
    localStorage.setItem(STORAGE_MODE_KEY, 'idb');
    try {
      localStorage.setItem('yokdil_migrated_at', new Date().toISOString());
    } catch (e) {}
    return {
      data: local,
      mode: 'idb',
      migrated: true
    };
  } catch (e) {
    console.warn('IndexedDB kullanılamadı, localStorage ile devam ediliyor:', e);
    return {
      data: fromLocal(),
      mode: 'local',
      error: e
    };
  }
}
async function persistKey(mode, key, val) {
  try {
    if (mode === 'idb') await idbSet(key, val);else localStorage.setItem(key, JSON.stringify(val));
    return null;
  } catch (e) {
    return e;
  }
}
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function createSRS(cardId) {
  return {
    cardId,
    state: 'new',
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: null,
    nextReviewAt: getTodayStr()
  };
}
const FSRS_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const FSRS_RETENTION = 0.9,
  FSRS_DECAY = -0.5,
  FSRS_FACTOR = 19 / 81;
const clampN = (x, a, b) => Math.min(b, Math.max(a, x));
const fsrsInitD = g => clampN(FSRS_W[4] - (g - 3) * FSRS_W[5], 1, 10);
const fsrsRetr = (days, s) => Math.pow(1 + FSRS_FACTOR * days / s, FSRS_DECAY);
const fsrsInterval = s => clampN(Math.round(s / FSRS_FACTOR * (Math.pow(FSRS_RETENTION, 1 / FSRS_DECAY) - 1)), 1, 36500);
const daysBetween = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
function fsrsNext(item, rating) {
  const g = rating,
    w = FSRS_W;
  const today = getTodayStr();
  let S = item.stability,
    D = item.difficulty;
  const reviewed = item.repetitions > 0 || item.state && item.state !== 'new';
  if (!(S > 0) && reviewed) {
    S = Math.max(0.5, item.interval || 1);
    D = clampN(11 - ((item.easeFactor || 2.5) - 1.3) * 5, 1, 10);
  }
  let lapses = item.lapses || 0;
  if (!(S > 0)) {
    S = w[g - 1];
    D = fsrsInitD(g);
    if (g === 1) lapses += 1;
  } else {
    const elapsed = item.lastReviewedAt ? daysBetween(item.lastReviewedAt.slice(0, 10), today) : item.interval || 0;
    const R = fsrsRetr(elapsed, S);
    const D1 = D - w[6] * (g - 3);
    D = clampN(w[7] * fsrsInitD(4) + (1 - w[7]) * D1, 1, 10);
    if (g === 1) {
      S = Math.min(S, w[11] * Math.pow(D, -w[12]) * (Math.pow(S + 1, w[13]) - 1) * Math.exp(w[14] * (1 - R)));
      lapses += 1;
    } else if (elapsed < 1) {
      if (g === 4) S = S * 1.2;
    } else {
      const hard = g === 2 ? w[15] : 1,
        easy = g === 4 ? w[16] : 1;
      S = S * (Math.exp(w[8]) * (11 - D) * Math.pow(S, -w[9]) * (Math.exp(w[10] * (1 - R)) - 1) * hard * easy + 1);
    }
  }
  const interval = g === 1 ? 1 : fsrsInterval(S);
  return {
    ...item,
    stability: Math.round(S * 1000) / 1000,
    difficulty: Math.round(D * 1000) / 1000,
    state: g === 1 ? 'learning' : interval >= 30 ? 'mastered' : interval >= 7 ? 'review' : 'learning',
    interval,
    repetitions: (item.repetitions || 0) + 1,
    lapses,
    lastReviewedAt: new Date().toISOString(),
    nextReviewAt: addDays(today, interval)
  };
}
function processReview(item, rating) {
  return fsrsNext(item, rating);
}
const formatInterval = d => d < 30 ? d + ' gün' : d < 365 ? Math.round(d / 30) + ' ay' : Math.round(d / 36.5) / 10 + ' yıl';
function speakText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}
function extractSentence(text, target) {
  if (!text || !target) return '';
  const idx = text.toLowerCase().indexOf(target.toLowerCase());
  if (idx === -1) return target;
  let start = idx;
  while (start > 0) {
    const c = text[start - 1];
    if (c === '\n') break;
    if (['.', '!', '?'].includes(c)) {
      const pre = text.slice(Math.max(0, start - 8), start).toLowerCase();
      if (!/(e\.g|i\.e|e\.|i\.|dr|mr|vs|etc|u\.s)\.$/i.test(pre)) break;
    }
    start--;
  }
  let end = idx + target.length;
  while (end < text.length) {
    const c = text[end];
    if (c === '\n') break;
    if (['.', '!', '?'].includes(c)) {
      const sub = text.slice(Math.max(0, end - 6), end + 1).toLowerCase();
      const next = text.slice(end + 1, Math.min(text.length, end + 4)).toLowerCase();
      const isAbbr = /(e\.g|i\.e|dr|mr|vs|etc|u\.s)\.$/i.test(sub) || /\b[a-z]\.$/i.test(sub) && /^[a-z]\./i.test(next);
      if (!isAbbr) {
        end++;
        break;
      }
    }
    end++;
  }
  return text.slice(start, end).trim().replace(/\s+/g, ' ');
}
function findSmartCollocation(sentence, target) {
  if (!sentence || !target || target.length < 2) return '';
  const cleanTarget = target.trim();
  const lowerSentence = sentence.toLowerCase();
  const lowerTarget = cleanTarget.toLowerCase();
  const idx = lowerSentence.indexOf(lowerTarget);
  if (idx === -1) return '';
  const beforeText = sentence.slice(0, idx).trim();
  const afterText = sentence.slice(idx + cleanTarget.length).trim();
  const beforeTokens = beforeText ? beforeText.split(/\s+/) : [];
  const afterTokens = afterText ? afterText.split(/\s+/) : [];
  const prepositions = new Set(['of', 'to', 'in', 'on', 'with', 'for', 'from', 'at', 'by', 'into', 'as', 'about', 'against', 'upon', 'between']);
  const articles = new Set(['a', 'an', 'the']);
  const verbs = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'remains', 'remained', 'becomes', 'became', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must']);
  if (afterTokens.length >= 2 && prepositions.has(afterTokens[0].toLowerCase().replace(/[^a-z]/g, ''))) {
    const prep = afterTokens[0].replace(/[^a-z]/g, '');
    const nextWords = [];
    let i = 1;
    if (i < afterTokens.length && articles.has(afterTokens[i].toLowerCase().replace(/[^a-z]/g, ''))) {
      nextWords.push(afterTokens[i]);
      i++;
    }
    while (i < afterTokens.length && nextWords.length < 2) {
      const cleanW = afterTokens[i].replace(/[.,;:!?()"']/g, '');
      if (!cleanW || prepositions.has(cleanW.toLowerCase()) || verbs.has(cleanW.toLowerCase())) break;
      nextWords.push(cleanW);
      i++;
    }
    if (nextWords.length > 0) {
      return (cleanTarget + ' ' + prep + ' ' + nextWords.join(' ')).trim();
    }
  }
  if (beforeTokens.length >= 1 && cleanTarget.split(/\s+/).length <= 2) {
    const prevWord = beforeTokens[beforeTokens.length - 1].replace(/^[.,;:!?()"']+|[.,;:!?()"']+$/g, '');
    if (prevWord.length > 2 && !articles.has(prevWord.toLowerCase()) && !prepositions.has(prevWord.toLowerCase())) {
      return (prevWord + ' ' + cleanTarget).trim();
    }
  }
  return '';
}
function triggerHaptic(duration = 30) {
  try {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(duration);
    }
  } catch (e) {}
}
function formatBionicWord(word, key) {
  const m = word.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
  if (!m) return word + ' ';
  const lead = m[1],
    letters = m[2],
    trail = m[3];
  const len = letters.length;
  const fix = len <= 3 ? 1 : len <= 5 ? 2 : len <= 7 ? 3 : Math.ceil(len * 0.45);
  const boldPart = letters.slice(0, fix);
  const restPart = letters.slice(fix);
  return React.createElement("span", {
    key: key
  }, lead, React.createElement("strong", {
    className: "font-extrabold text-white"
  }, boldPart), React.createElement("span", {
    className: "opacity-80"
  }, restPart), trail, ' ');
}
function parseYokdilExamText(text, answerKeyText = '') {
  if (!text || text.trim().length < 20) return [];
  const answersMap = new Map();
  const combinedForKeys = answerKeyText + '\n' + text;
  const keyMatches = combinedForKeys.matchAll(/(?:^|[\s,;])(\d{1,2})\s*[-.:)]\s*([A-Ea-e])(?=[\s,;]|$)/g);
  for (const km of keyMatches) {
    const qn = parseInt(km[1], 10);
    const ans = km[2].toUpperCase();
    if (qn >= 1 && qn <= 80 && !answersMap.has(qn)) {
      answersMap.set(qn, ans);
    }
  }
  const clean = text.replace(/\r\n/g, '\n').replace(/\d{1,2}\s*[-–]\s*\d{1,2}\.\s*sorularda[^\n]+/gi, '').replace(/CEVAP ANAHTARI[\s\S]*$/i, '');
  const qRegex = /(?:^|\n)\s*(\d{1,2})\s*[\.\)]\s*([\s\S]*?)(?=(?:^|\n)\s*\d{1,2}\s*[\.\)]|\s*$)/g;
  const questions = [];
  for (const m of clean.matchAll(qRegex)) {
    const num = parseInt(m[1], 10);
    const body = m[2].trim();
    if (num < 1 || num > 80 || body.length < 10) continue;
    const optRegex = /(?:^|\s|\n)([A-Ea-e])\s*[\)\.\-]\s*([\s\S]*?)(?=(?:^|\s|\n)[A-Ea-e]\s*[\)\.\-]|\s*$)/g;
    const optsFound = [];
    let promptEnd = -1;
    for (const om of body.matchAll(optRegex)) {
      if (promptEnd === -1) {
        promptEnd = om.index;
      }
      optsFound.push({
        letter: om[1].toUpperCase(),
        text: om[2].trim().replace(/\s+/g, ' ')
      });
    }
    if (optsFound.length >= 4) {
      const prompt = promptEnd > 0 ? body.slice(0, promptEnd).trim().replace(/\s+/g, ' ') : body;
      const options = ['A', 'B', 'C', 'D', 'E'].map(L => {
        const found = optsFound.find(o => o.letter === L);
        return found ? found.text : '';
      });
      let category = 'Genel';
      if (num <= 6) category = 'Kelime Soruları (Soru 1-6)';else if (num <= 16) category = 'Gramer & Edat (Soru 7-16)';else if (num <= 26) category = 'Cloze Test (Soru 17-26)';else if (num <= 36) category = 'Cümle Tamamlama (Soru 27-36)';else if (num <= 48) category = 'Çeviri Soruları (Soru 37-48)';else if (num <= 60) category = 'Paragraf & Anlam Bütünlüğü (Soru 49-60)';else category = 'Okuma Parçası Soruları (Soru 61-80)';
      const correctLetter = answersMap.get(num);
      const answerIdx = correctLetter ? ['A', 'B', 'C', 'D', 'E'].indexOf(correctLetter) : -1;
      questions.push({
        num,
        prompt,
        options,
        answer: answerIdx,
        category,
        correctLetter: correctLetter || ''
      });
    }
  }
  return questions;
}
const STOPWORDS = new Set('the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were been being has had did does done said made used such each many much more very own same both few those here where why own while through during before above below between under again further once off down should may might must shall upon among within without into onto toward towards against along around across behind beyond however therefore thus although though whether either neither also yet still already always never often sometimes usually perhaps maybe really quite rather almost enough every another something anything nothing everything someone anyone everyone nobody thing things part parts place case point group number fact hand high great small large long little old big right left last next early late young sure able bad best better less least whole real true full open per via etc mr mrs ms dr st vs'.split(/\s+/));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ORIGIN_TAG = (() => {
  try {
    return btoa(location.origin).replace(/[^a-z0-9]/gi, '').slice(-12);
  } catch (e) {
    return 'x';
  }
})();
const fetchJson = async (url, tries = 3) => {
  if (/api\.datamuse\.com/.test(url)) url += (url.includes('?') ? '&' : '?') + 'o=' + ORIGIN_TAG;
  for (let a = 0; a < tries; a++) {
    try {
      const r = await fetch(url, {
        cache: 'no-store'
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (a === tries - 1) throw e;
      await sleep(500 * (a + 1));
    }
  }
};
const runPool = async (items, limit, fn, onProgress) => {
  const res = new Array(items.length);
  let next = 0,
    done = 0;
  const worker = async () => {
    while (next < items.length) {
      const k = next++;
      try {
        res[k] = await fn(items[k], k);
      } catch (e) {
        res[k] = null;
      }
      done++;
      if (onProgress) onProgress(done, items.length);
    }
  };
  await Promise.all(Array.from({
    length: Math.min(limit, items.length)
  }, worker));
  return res;
};
const CACHE_KEYS = {
  FREQ: 'yokdil_freq_cache_v1',
  DICT: 'yokdil_dict_cache_v2'
};
try {
  localStorage.removeItem('yokdil_dict_cache_v1');
} catch (e) {}
const cacheGet = k => {
  try {
    return JSON.parse(localStorage.getItem(k) || '{}');
  } catch (e) {
    return {};
  }
};
const CACHE_MAX = 1500;
const cacheSet = (k, v) => {
  const keys = Object.keys(v);
  if (keys.length > CACHE_MAX) keys.slice(0, keys.length - CACHE_MAX).forEach(x => delete v[x]);
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    try {
      localStorage.removeItem(k);
    } catch (e2) {}
  }
};
const freqCache = cacheGet(CACHE_KEYS.FREQ);
const lookupFreq = async w => {
  if (w in freqCache) return freqCache[w];
  const j = await fetchJson('https://api.datamuse.com/words?sp=' + encodeURIComponent(w) + '&md=fp&max=1');
  let v = null;
  if (j && j[0] && j[0].word === w) {
    const tags = j[0].tags || [];
    const f = parseFloat((tags.find(t => t.startsWith('f:')) || 'f:0').slice(2));
    v = {
      f,
      tags: tags.filter(t => !t.startsWith('f:'))
    };
  }
  freqCache[w] = v;
  return v;
};
const lemmaCandidates = w => {
  const c = [w];
  if (/ies$/.test(w)) c.push(w.slice(0, -3) + 'y');
  if (/(ches|shes|sses|xes|zes|oes)$/.test(w)) c.push(w.slice(0, -2));
  if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) c.push(w.slice(0, -1));
  if (/ied$/.test(w)) c.push(w.slice(0, -3) + 'y');
  if (/ed$/.test(w)) {
    const s = w.slice(0, -2);
    c.push(s, s + 'e');
    if (/([b-df-hj-np-tv-z])\1$/.test(s)) c.push(s.slice(0, -1));
  }
  if (/ing$/.test(w)) {
    const s = w.slice(0, -3);
    c.push(s, s + 'e');
    if (/([b-df-hj-np-tv-z])\1$/.test(s)) c.push(s.slice(0, -1));
  }
  return [...new Set(c)].filter(x => x.length >= 3);
};
const resolveLemma = async w => {
  const cands = lemmaCandidates(w);
  const infos = await Promise.all(cands.map(c => lookupFreq(c).catch(() => null)));
  const orig = infos[0];
  let best = null;
  cands.forEach((c, i) => {
    if (i === 0 || !infos[i]) return;
    if (!best || infos[i].f > best.info.f) best = {
      word: c,
      info: infos[i]
    };
  });
  if (best && (!orig || best.info.f >= orig.f * 0.3)) return best;
  return orig ? {
    word: w,
    info: orig
  } : null;
};
const extractCandidates = async (text, {
  maxFreq,
  minFreq = 0.2,
  onProgress
}) => {
  const plain = text.replace(/^##\s+/gm, '');
  const counts = new Map();
  (plain.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).forEach(tok => {
    if (/['’]/.test(tok)) tok = tok.replace(/['’]s$/i, '');
    if (/['’]/.test(tok)) return;
    const w = tok.toLowerCase();
    if (w.length < 4 || STOPWORDS.has(w)) return;
    const e = counts.get(w) || {
      count: 0,
      surface: tok
    };
    e.count++;
    counts.set(w, e);
  });
  const words = [...counts.keys()];
  const resolved = await runPool(words, 4, resolveLemma, onProgress);
  cacheSet(CACHE_KEYS.FREQ, freqCache);
  const groups = new Map();
  words.forEach((w, i) => {
    const r = resolved[i];
    if (!r || !r.info) return;
    if (r.info.tags.includes('prop')) return;
    if (STOPWORDS.has(r.word)) return;
    if (r.info.f > maxFreq || r.info.f < minFreq) return;
    const g = groups.get(r.word) || {
      lemma: r.word,
      freq: r.info.f,
      tags: r.info.tags,
      count: 0,
      forms: []
    };
    g.count += counts.get(w).count;
    g.forms.push(counts.get(w).surface);
    groups.set(r.word, g);
  });
  return [...groups.values()].map(g => ({
    ...g,
    pos: posFor(g.lemma, g.forms, g.tags),
    sentence: extractSentence(plain, g.forms[0])
  }));
};
const posFromTags = tags => {
  const first = (tags || []).find(t => ['n', 'v', 'adj', 'adv'].includes(t));
  return {
    n: 'noun',
    v: 'verb',
    adj: 'adjective',
    adv: 'adverb'
  }[first] || 'noun';
};
const posFor = (lemma, forms, tags) => {
  const f = (forms || []).map(x => x.toLowerCase());
  if (f.some(x => x !== lemma && /(ed|ing)$/.test(x)) && (tags || []).includes('v')) return 'verb';
  return posFromTags(tags);
};
const freqLevel = f => f < 3 ? {
  label: 'İleri',
  cls: 'bg-purple-950 text-purple-300'
} : f < 20 ? {
  label: 'Orta-İleri',
  cls: 'bg-blue-950 text-blue-300'
} : {
  label: 'Orta',
  cls: 'bg-emerald-950 text-emerald-300'
};
const ipaToTurkish = ipa => {
  if (!ipa) return '';
  let s = ipa.split(',')[0].replace(/\([^)]*\)/g, '').replace(/[\/\[\]]/g, '').trim();
  const map = [['t͡ʃ', 'ç'], ['tʃ', 'ç'], ['d͡ʒ', 'c'], ['dʒ', 'c'], ['eɪ', 'ey'], ['aɪ', 'ay'], ['ɔɪ', 'oy'], ['aʊ', 'av'], ['əʊ', 'ou'], ['oʊ', 'ou'], ['ɪə', 'iı'], ['eə', 'eı'], ['ɛə', 'eı'], ['ʊə', 'uı'], ['iː', 'i'], ['uː', 'u'], ['ɑː', 'a'], ['ɔː', 'o'], ['ɜː', 'ö'], ['ɝ', 'ör'], ['ɚ', 'ır'], ['ɪ', 'i'], ['ʊ', 'u'], ['ə', 'ı'], ['ʌ', 'a'], ['æ', 'e'], ['ɑ', 'a'], ['ɒ', 'o'], ['ɔ', 'o'], ['ɛ', 'e'], ['ɜ', 'ö'], ['ɐ', 'a'], ['ᵻ', 'i'], ['ɨ', 'ı'], ['θ', 't'], ['ð', 'd'], ['ʃ', 'ş'], ['j', 'y'], ['ʒ', 'j'], ['ŋ', 'ng'], ['ɹ', 'r'], ['ɾ', 't'], ['ɡ', 'g'], ['ɫ', 'l'], ['ʔ', ''], ['ː', ''], ['̩', ''], ['ˌ', '.']];
  for (const [a, b] of map) s = s.split(a).join(b);
  s = s.replace(/ˈ/g, '·').replace(/[^a-zçğıöşüy·.]/g, '');
  const isV = ch => 'aeıioöuü'.includes(ch);
  const stressPos = s.replace(/\./g, '').indexOf('·');
  const letters = s.replace(/[·.]/g, '');
  if (!letters) return '';
  const sylls = [];
  let cur = '';
  for (let i = 0; i < letters.length; i++) {
    cur += letters[i];
    if (!isV(letters[i])) continue;
    let j = i + 1;
    while (j < letters.length && !isV(letters[j])) j++;
    if (j >= letters.length) {
      cur += letters.slice(i + 1);
      break;
    }
    const cons = letters.slice(i + 1, j);
    if (cons.length <= 1) {
      sylls.push(cur);
      cur = '';
    } else {
      const keep = cons.slice(0, cons.length - 1);
      cur += keep;
      sylls.push(cur);
      cur = '';
      i += keep.length;
    }
  }
  if (cur) {
    if (sylls.length && !/[aeıioöuü]/.test(cur)) sylls[sylls.length - 1] += cur;else sylls.push(cur);
  }
  let stressed = -1;
  if (stressPos >= 0 && sylls.length > 1) {
    const firstV = letters.slice(stressPos).search(/[aeıioöuü]/) + stressPos;
    let pos = 0;
    for (let k = 0; k < sylls.length; k++) {
      if (firstV >= pos && firstV < pos + sylls[k].length) {
        stressed = k;
        break;
      }
      pos += sylls[k].length;
    }
  }
  return sylls.map((x, k) => k === stressed ? x.toLocaleUpperCase('tr') : x).join('-');
};
const fetchTurkish = async word => {
  const j = await fetchJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(word) + '&langpair=en|tr');
  if (!j) return {
    meanings: [],
    quota: false
  };
  if (j.quotaFinished) return {
    meanings: [],
    quota: true
  };
  const w = word.toLowerCase();
  const raw = [j.responseData && j.responseData.translatedText].concat((j.matches || []).filter(m => String(m.segment || '').trim().toLowerCase() === w).filter(m => m.quality == null || +m.quality >= 60).sort((a, b) => (+b.quality || 0) - (+a.quality || 0)).map(m => m.translation));
  const seen = new Set(),
    meanings = [];
  raw.forEach(t => {
    if (!t) return;
    const v = String(t).trim().replace(/\.+$/, '').trim().toLocaleLowerCase('tr');
    if (!v || v === w || seen.has(v)) return;
    if (!/^[a-zçğıöşüâîû][a-zçğıöşüâîû' -]*[a-zçğıöşüâîû]$/i.test(v)) return;
    if (v.split(/\s+/).length > 3) return;
    seen.add(v);
    meanings.push(v);
  });
  return {
    meanings: meanings.slice(0, 4),
    quota: false
  };
};
const cleanWikiItem = s => s.replace(/\{\{tt?\+?\|tr\|([^}|]+)[^}]*\}\}/g, '$1').replace(/\{\{l\|tr\|([^}|]+)[^}]*\}\}/g, '$1').replace(/\{\{[^}]*\}\}/g, '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\([^)]*\)/g, '').replace(/['"’]/g, '').replace(/\s+/g, ' ').trim();
const parseWiktionaryTurkish = wikitext => {
  if (!wikitext) return {
    senses: [],
    subpage: false
  };
  const parts = wikitext.split(/\n==(?!=)/);
  const en = parts.find(s => /^\s*English\s*==/.test(s)) || (parts[0].startsWith('==English==') ? parts[0] : '');
  const senses = [];
  let pos = null,
    sense = null;
  en.split('\n').forEach(line => {
    const h = line.match(/^===+\s*(Noun|Verb|Adjective|Adverb|Proper noun)\s*=+/);
    if (h) pos = h[1].toLowerCase();
    const tt = line.match(/\{\{trans-top(?:-also)?\|([^}|]*)/);
    if (tt) sense = tt[1].trim();else if (/\{\{trans-top\}\}/.test(line)) sense = '';
    if (/^\*\s*Turkish\s*:/.test(line)) {
      const body = line.replace(/^\*\s*Turkish\s*:/, '');
      const words = body.replace(/\{\{[^}]*\}\}/g, m => /^\{\{(tt?\+?|l)\|tr\|/.test(m) ? cleanWikiItem(m) + ',' : '').split(/[,;]/).map(cleanWikiItem).filter(w => w && /^[a-zçğıöşüâîû][a-zçğıöşüâîû ' -]*$/i.test(w) && w.split(' ').length <= 4);
      if (words.length) senses.push({
        pos,
        sense,
        words: [...new Set(words)]
      });
    }
  });
  return {
    senses,
    subpage: /\{\{see translation subpage/.test(en)
  };
};
const fetchWikiText = async page => {
  const j = await fetchJson('https://en.wiktionary.org/w/api.php?action=parse&page=' + encodeURIComponent(page) + '&prop=wikitext&format=json&formatversion=2&redirects=1&origin=*');
  return j && j.parse ? j.parse.wikitext : null;
};
const fetchWiktionaryTurkish = async (word, wantPos) => {
  let {
    senses,
    subpage
  } = parseWiktionaryTurkish(await fetchWikiText(word));
  if (subpage) {
    const sub = parseWiktionaryTurkish('==English==\n' + ((await fetchWikiText(word + '/translations').catch(() => null)) || ''));
    senses = senses.concat(sub.senses);
  }
  if (!senses.length) return {
    meanings: [],
    senses: []
  };
  const ordered = [...senses.filter(s => s.pos === wantPos), ...senses.filter(s => s.pos !== wantPos)];
  const meanings = [];
  ordered.forEach(s => s.words.forEach(w => {
    if (meanings.length < 5 && !meanings.includes(w)) meanings.push(w);
  }));
  return {
    meanings,
    senses: ordered.slice(0, 4)
  };
};
const fetchTurkishAuto = async (word, wantPos) => {
  try {
    const wk = await fetchWiktionaryTurkish(word, wantPos);
    if (wk.meanings.length) return {
      meanings: wk.meanings,
      senses: wk.senses,
      source: 'Wiktionary',
      quota: false
    };
  } catch (e) {}
  const mm = await fetchTurkish(word).catch(() => ({
    meanings: [],
    quota: false
  }));
  return {
    meanings: mm.meanings,
    senses: [],
    source: mm.meanings.length ? 'MyMemory' : '',
    quota: mm.quota
  };
};
const dictCache = cacheGet(CACHE_KEYS.DICT);
const fetchWordDetails = async (lemma, wantPos) => {
  const key = lemma + '|' + wantPos;
  if (dictCache[key]) return dictCache[key];
  const [dict, syn, ant, tr] = await Promise.all([fetchJson('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(lemma)).catch(() => null), fetchJson('https://api.datamuse.com/words?rel_syn=' + encodeURIComponent(lemma) + '&max=8').catch(() => []), fetchJson('https://api.datamuse.com/words?rel_ant=' + encodeURIComponent(lemma) + '&max=6').catch(() => []), fetchTurkishAuto(lemma, wantPos).catch(() => ({
    meanings: [],
    senses: [],
    source: '',
    quota: false
  }))]);
  const entries = Array.isArray(dict) ? dict : [];
  const phonetics = entries.flatMap(e => e.phonetics || []);
  let ipa = (entries.find(e => e.phonetic) || {}).phonetic || (phonetics.find(p => p.text) || {}).text || '';
  if (!ipa) {
    const pr = await fetchJson('https://api.datamuse.com/words?sp=' + encodeURIComponent(lemma) + '&md=r&ipa=1&max=1').catch(() => null);
    const tag = pr && pr[0] && (pr[0].tags || []).find(t => t.startsWith('ipa_pron:'));
    if (tag) ipa = tag.slice(9);
  }
  const audioUrl = (phonetics.find(p => p.audio && /-us\./.test(p.audio)) || phonetics.find(p => p.audio) || {}).audio || '';
  const meanings = entries.flatMap(e => e.meanings || []);
  const main = meanings.find(m => m.partOfSpeech === wantPos) || meanings[0];
  const pos = wantPos || main && main.partOfSpeech || 'noun';
  const defs = main ? main.definitions || [] : [];
  const examples = meanings.flatMap(m => (m.definitions || []).map(d => d.example)).filter(Boolean).slice(0, 2);
  const uniq = (arr, n) => [...new Set(arr.map(x => String(x).trim().toLowerCase()).filter(x => x && x !== lemma))].slice(0, n);
  const synonyms = uniq([...meanings.flatMap(m => (m.synonyms || []).concat((m.definitions || []).flatMap(d => d.synonyms || []))), ...(syn || []).map(x => x.word)], 6);
  const antonyms = uniq([...meanings.flatMap(m => (m.antonyms || []).concat((m.definitions || []).flatMap(d => d.antonyms || []))), ...(ant || []).map(x => x.word)], 5);
  const details = {
    turkish: tr.meanings.join(', '),
    trSenses: tr.senses || [],
    trSource: tr.source || '',
    trQuota: tr.quota,
    ipa: ipa.replace(/^\/|\/$/g, ''),
    okunus: ipaToTurkish(ipa),
    audioUrl,
    partOfSpeech: pos,
    definition: defs.slice(0, 2).map(d => d.definition).join(' / '),
    examples,
    synonyms,
    antonyms
  };
  if (!tr.quota) {
    dictCache[key] = details;
    cacheSet(CACHE_KEYS.DICT, dictCache);
  }
  return details;
};
const turengUrl = word => 'https://tureng.com/tr/turkce-ingilizce/' + encodeURIComponent(String(word || '').trim().toLowerCase());
const TurengLink = ({
  word,
  className
}) => React.createElement("a", {
  href: turengUrl(word),
  target: "_blank",
  rel: "noopener noreferrer",
  onClick: e => e.stopPropagation(),
  title: '"' + word + '" kelimesini Tureng\'de aç (yeni sekme)',
  className: "inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-950/60 border border-red-900 text-[10px] font-bold text-red-300 hover:bg-red-900 hover:text-white transition " + (className || '')
}, "Tureng \u2197");
const isMissingMeaning = c => !c.turkish || /^\(anlam bulunamadı/.test(c.turkish);
const playWord = card => {
  if (card.audioUrl) {
    const a = new Audio(card.audioUrl);
    a.play().catch(() => speakText(card.english));
  } else speakText(card.english);
};
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCKJsQfCTh2wtOZ5t0HcOMHf4fC1ua0VDs',
  authDomain: 'yokdil-master.firebaseapp.com',
  projectId: 'yokdil-master',
  storageBucket: 'yokdil-master.firebasestorage.app',
  messagingSenderId: '294443630442',
  appId: '1:294443630442:web:7ef2849a41c5d6e4b72f13'
};
const SYNC_KINDS = ['weeks', 'readings', 'cards', 'activity'];
const SYNC_TS_KEY = 'yokdil_sync_ts_v1';
const SYNC_MAX_BYTES = 900000;
let fbCache = null;
const getFirebase = () => {
  if (!window.firebase) return null;
  if (!fbCache) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      const db = firebase.firestore();
      try {
        db.enablePersistence({
          synchronizeTabs: true
        }).catch(() => {});
      } catch (e) {}
      fbCache = {
        auth: firebase.auth(),
        db
      };
    } catch (e) {
      console.warn('Firebase başlatılamadı', e);
      return null;
    }
  }
  return fbCache;
};
function useCloudSync({
  weeks,
  setWeeks,
  readings,
  setReadings,
  cards,
  setCards,
  activity,
  setActivity
}) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState('off');
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [tooBig, setTooBig] = useState([]);
  const data = {
    weeks,
    readings,
    cards,
    activity
  };
  const setters = {
    weeks: setWeeks,
    readings: setReadings,
    cards: setCards,
    activity: setActivity
  };
  const dataRef = useRef(data);
  dataRef.current = data;
  const synced = useRef({
    weeks: new Map(),
    readings: new Map(),
    cards: new Map(),
    activity: new Map()
  });
  const ready = useRef(false);
  const seen = useRef(null);
  const toMap = list => new Map((list || []).filter(x => x && x.id != null).map(x => [String(x.id), JSON.stringify(x)]));
  const tsAll = () => {
    try {
      return JSON.parse(localStorage.getItem(SYNC_TS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  };
  useEffect(() => {
    const cur = {
      weeks: toMap(weeks),
      readings: toMap(readings),
      cards: toMap(cards),
      activity: toMap(activity)
    };
    if (seen.current) {
      const all = tsAll();
      const now = Date.now();
      let changed = false;
      SYNC_KINDS.forEach(k => {
        all[k] = all[k] || {};
        cur[k].forEach((j, id) => {
          if (seen.current[k].get(id) !== j) {
            all[k][id] = now;
            changed = true;
          }
        });
      });
      if (changed) {
        try {
          localStorage.setItem(SYNC_TS_KEY, JSON.stringify(all));
        } catch (e) {}
      }
    }
    seen.current = cur;
  }, [weeks, readings, cards, activity]);
  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setAuthReady(true);
      return;
    }
    fb.auth.getRedirectResult().catch(e => setError(authErrorText(e)));
    return fb.auth.onAuthStateChanged(u => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);
  useEffect(() => {
    if (!user) {
      ready.current = false;
      setStatus('off');
      return;
    }
    const fb = getFirebase();
    const unsubs = [];
    let cancelled = false;
    (async () => {
      setStatus('syncing');
      setError('');
      try {
        const tsMap = tsAll();
        for (const kind of SYNC_KINDS) {
          const col = fb.db.collection('users').doc(user.uid).collection(kind);
          const snap = await col.get();
          if (cancelled) return;
          const remote = new Map();
          snap.forEach(d => remote.set(d.id, d.data()));
          const local = dataRef.current[kind] || [];
          const localIds = new Set(local.map(x => String(x.id)));
          const uploads = [];
          const remoteOnly = [];
          const merged = [];
          local.forEach(l => {
            const id = String(l.id),
              r = remote.get(id),
              lj = JSON.stringify(l);
            if (!r) {
              merged.push(l);
              uploads.push([id, lj]);
              return;
            }
            if (r.deleted) {
              if ((tsMap[kind] || {})[id] > (r.ts || 0)) {
                merged.push(l);
                uploads.push([id, lj]);
              }
              return;
            }
            if (r.json === lj) {
              merged.push(l);
              return;
            }
            if ((tsMap[kind] || {})[id] > (r.ts || 0)) {
              merged.push(l);
              uploads.push([id, lj]);
            } else merged.push(JSON.parse(r.json));
          });
          remote.forEach((r, id) => {
            if (!localIds.has(id) && !r.deleted && r.json) remoteOnly.push(JSON.parse(r.json));
          });
          const final = [...remoteOnly, ...merged];
          const okUploads = uploads.filter(([, json]) => json.length <= SYNC_MAX_BYTES);
          if (okUploads.length < uploads.length) setTooBig(prev => [...new Set([...prev, ...uploads.filter(([, j]) => j.length > SYNC_MAX_BYTES).map(([id]) => id)])]);
          for (let i = 0; i < okUploads.length; i += 400) {
            const batch = fb.db.batch();
            okUploads.slice(i, i + 400).forEach(([id, json]) => batch.set(col.doc(id), {
              json,
              ts: Date.now(),
              deleted: false
            }));
            await batch.commit();
          }
          synced.current[kind] = toMap(final);
          seen.current = {
            ...(seen.current || {}),
            [kind]: toMap(final)
          };
          setters[kind](final);
          unsubs.push(col.onSnapshot(s => {
            if (s.metadata.hasPendingWrites) return;
            const changes = s.docChanges();
            if (!changes.length) return;
            setters[kind](prev => {
              let next = prev;
              changes.forEach(ch => {
                const id = ch.doc.id,
                  r = ch.doc.data();
                const gone = ch.type === 'removed' || r.deleted;
                if (gone) {
                  if (next.some(x => String(x.id) === id)) next = next.filter(x => String(x.id) !== id);
                  synced.current[kind].delete(id);
                  return;
                }
                if (synced.current[kind].get(id) === r.json) return;
                synced.current[kind].set(id, r.json);
                const item = JSON.parse(r.json);
                const idx = next.findIndex(x => String(x.id) === id);
                next = idx >= 0 ? next.map((x, i) => i === idx ? item : x) : [item, ...next];
              });
              return next;
            });
            setLastSync(new Date());
          }, e => {
            setError('Canlı eşitleme hatası: ' + e.message);
            setStatus('error');
          }));
        }
        if (cancelled) return;
        ready.current = true;
        setStatus('synced');
        setLastSync(new Date());
      } catch (e) {
        if (cancelled) return;
        setError('Eşitleme hatası: ' + (e && e.message ? e.message : e));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      ready.current = false;
      unsubs.forEach(u => u());
    };
  }, [user]);
  useEffect(() => {
    if (!user || !ready.current) return;
    const t = setTimeout(async () => {
      const fb = getFirebase();
      if (!fb) return;
      const ops = [],
        big = [];
      SYNC_KINDS.forEach(kind => {
        const cur = toMap(dataRef.current[kind]);
        const prev = synced.current[kind];
        cur.forEach((json, id) => {
          if (prev.get(id) === json) return;
          if (json.length > SYNC_MAX_BYTES) {
            big.push(id);
            return;
          }
          ops.push([kind, id, json]);
        });
        prev.forEach((_, id) => {
          if (!cur.has(id)) ops.push([kind, id, null]);
        });
      });
      if (big.length) setTooBig(prevB => [...new Set([...prevB, ...big])]);
      if (!ops.length) return;
      setStatus('syncing');
      try {
        for (let i = 0; i < ops.length; i += 400) {
          const batch = fb.db.batch();
          ops.slice(i, i + 400).forEach(([kind, id, json]) => {
            const ref = fb.db.collection('users').doc(user.uid).collection(kind).doc(id);
            batch.set(ref, json === null ? {
              json: '',
              ts: Date.now(),
              deleted: true
            } : {
              json,
              ts: Date.now(),
              deleted: false
            });
          });
          await batch.commit();
        }
        ops.forEach(([kind, id, json]) => {
          json === null ? synced.current[kind].delete(id) : synced.current[kind].set(id, json);
        });
        setStatus('synced');
        setLastSync(new Date());
        setError('');
      } catch (e) {
        setError('Gönderilemedi: ' + (e && e.message ? e.message : e));
        setStatus('error');
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [weeks, readings, cards, activity, user]);
  const signIn = async () => {
    const fb = getFirebase();
    if (!fb) {
      setError('Firebase yüklenemedi (internet bağlantısını kontrol edin).');
      return;
    }
    setError('');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      await fb.auth.signInWithPopup(provider);
    } catch (e) {
      if (e && /popup-blocked|operation-not-supported/.test(e.code || '')) {
        try {
          await fb.auth.signInWithRedirect(provider);
        } catch (e2) {
          setError(authErrorText(e2));
        }
      } else if (!(e && /popup-closed|cancelled-popup/.test(e.code || ''))) setError(authErrorText(e));
    }
  };
  const signOut = async () => {
    const fb = getFirebase();
    if (fb) await fb.auth.signOut();
  };
  return {
    user,
    authReady,
    status,
    error,
    lastSync,
    signIn,
    signOut,
    available: !!window.firebase,
    tooBig
  };
}
const authErrorText = e => {
  const c = e && e.code || '';
  if (/unauthorized-domain/.test(c)) return 'Bu adres Firebase\'de izinli değil (Authentication → Settings → Authorized domains).';
  if (/network/.test(c)) return 'Bağlantı hatası; internetinizi kontrol edin.';
  return 'Giriş yapılamadı: ' + (e && e.message || c || 'bilinmeyen hata');
};
function BackupLinks({
  onExport,
  onImport
}) {
  const inputRef = useRef(null);
  return React.createElement("div", {
    className: "flex items-center gap-2 pt-1 border-t border-slate-800 mt-1"
  }, React.createElement("button", {
    onClick: onExport,
    className: "text-[10px] text-blue-400 hover:text-blue-300 underline",
    title: "T\xFCm haftalar\u0131, metinleri ve kartlar\u0131 bir dosyaya indir"
  }, "\u2B07 Yedek indir"), React.createElement("button", {
    onClick: () => inputRef.current && inputRef.current.click(),
    className: "text-[10px] text-blue-400 hover:text-blue-300 underline",
    title: "Daha \xF6nce indirdi\u011Finiz yedek dosyas\u0131n\u0131 ekle (mevcut veriler silinmez)"
  }, "\u2B06 Yedek y\xFCkle"), React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: ".json,application/json",
    className: "hidden",
    onChange: e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) onImport(f);
    }
  }));
}
function SyncPanel({
  sync,
  backup
}) {
  const links = backup ? React.createElement(BackupLinks, {
    onExport: backup.onExport,
    onImport: backup.onImport
  }) : null;
  if (!sync.available) {
    return React.createElement("div", {
      className: "p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400"
    }, "\u2601\uFE0F Bulut e\u015Fitleme y\xFCklenemedi (internet ba\u011Flant\u0131s\u0131 gerekli).", links);
  }
  if (!sync.authReady) return React.createElement("div", {
    className: "p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-500"
  }, "\u2601\uFE0F Kontrol ediliyor\u2026", links);
  if (!sync.user) {
    return React.createElement("div", {
      className: "p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2"
    }, React.createElement("p", null, React.createElement("span", {
      className: "font-bold text-slate-200"
    }, "\u2601\uFE0F Cihazlar aras\u0131 e\u015Fitleme"), React.createElement("br", null), "Giri\u015F yap\u0131nca kelimeleriniz, metinleriniz ve kartlar\u0131n\u0131z t\xFCm cihazlar\u0131n\u0131zda ayn\u0131 olur."), React.createElement("button", {
      onClick: sync.signIn,
      className: "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-bold hover:bg-slate-100"
    }, React.createElement("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 48 48",
      "aria-hidden": "true"
    }, React.createElement("path", {
      fill: "#FFC107",
      d: "M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
    }), React.createElement("path", {
      fill: "#FF3D00",
      d: "M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    }), React.createElement("path", {
      fill: "#4CAF50",
      d: "M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
    }), React.createElement("path", {
      fill: "#1976D2",
      d: "M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
    })), "Google ile giri\u015F yap"), sync.error && React.createElement("p", {
      className: "text-red-400"
    }, sync.error), links);
  }
  const label = {
    syncing: '⟳ Eşitleniyor…',
    synced: '✓ Eşitlendi' + (sync.lastSync ? ' · ' + sync.lastSync.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    }) : ''),
    error: '⚠ Eşitleme sorunu',
    off: ''
  }[sync.status];
  const cls = {
    syncing: 'text-blue-300',
    synced: 'text-emerald-400',
    error: 'text-red-400',
    off: 'text-slate-500'
  }[sync.status];
  return React.createElement("div", {
    className: "p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1.5"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, sync.user.photoURL ? React.createElement("img", {
    src: sync.user.photoURL,
    alt: "",
    referrerPolicy: "no-referrer",
    className: "w-6 h-6 rounded-full"
  }) : React.createElement("span", {
    className: "w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold"
  }, (sync.user.email || '?')[0].toUpperCase()), React.createElement("span", {
    className: "truncate text-slate-200 font-semibold",
    title: sync.user.email
  }, sync.user.displayName || sync.user.email)), React.createElement("p", {
    role: "status",
    className: cls
  }, "\u2601\uFE0F ", label), sync.error && React.createElement("p", {
    className: "text-red-400"
  }, sync.error), (sync.tooBig || []).length > 0 && React.createElement("p", {
    className: "text-amber-400"
  }, sync.tooBig.length, " \xE7ok uzun metin buluta s\u0131\u011Fmad\u0131\u011F\u0131 i\xE7in yaln\u0131zca bu cihazda saklan\u0131yor."), React.createElement("button", {
    onClick: sync.signOut,
    className: "text-[10px] text-slate-500 hover:text-slate-300 underline"
  }, "\xC7\u0131k\u0131\u015F yap (veriler bu cihazda kal\u0131r)"), links);
}
function App({
  initial,
  storageMode
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [weeks, setWeeks] = useState(() => initial[STORAGE_KEYS.WEEKS] || []);
  const [readings, setReadings] = useState(() => initial[STORAGE_KEYS.READINGS] || []);
  const [cards, setCards] = useState(() => initial[STORAGE_KEYS.VOCAB] || []);
  const [storageWarning, setStorageWarning] = useState('');
  const [activity, setActivity] = useState(() => initial[STORAGE_KEYS.ACTIVITY] || []);
  const sync = useCloudSync({
    weeks,
    setWeeks,
    readings,
    setReadings,
    cards,
    setCards,
    activity,
    setActivity
  });
  const logActivity = (patch, byType) => {
    const day = getTodayStr();
    setActivity(prev => {
      const cur = prev.find(a => a.id === day) || {
        id: day,
        reviews: 0,
        correct: 0,
        again: 0,
        newCards: 0,
        examQ: 0,
        examCorrect: 0,
        examByType: {}
      };
      const next = {
        ...cur
      };
      Object.entries(patch).forEach(([k, v]) => {
        next[k] = (next[k] || 0) + v;
      });
      if (byType) {
        next.examByType = {
          ...(cur.examByType || {})
        };
        Object.entries(byType).forEach(([t, [c, n]]) => {
          const p = next.examByType[t] || [0, 0];
          next.examByType[t] = [p[0] + c, p[1] + n];
        });
      }
      return [next, ...prev.filter(a => a.id !== day)].slice(0, 400);
    });
  };
  const exportBackup = () => {
    const payload = {
      app: 'yokdil-master',
      version: 1,
      exportedAt: new Date().toISOString(),
      weeks,
      readings,
      cards
    };
    const blob = new Blob([JSON.stringify(payload, null, 1)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yokdil-yedek-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('Yedek indirildi: ' + weeks.length + ' hafta, ' + readings.length + ' metin, ' + cards.length + ' kart.');
  };
  const importBackup = async file => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app && data.app !== 'yokdil-master' || !Array.isArray(data.cards || [])) throw new Error('Bu dosya bir YÖKDİL Master yedeği değil.');
      const stamp = x => Date.parse(x.updatedAt || x.createdAt || x.dateAdded || 0) || 0;
      const mergeList = (cur, inc) => {
        const map = new Map(cur.map(x => [String(x.id), x]));
        let added = 0,
          updated = 0;
        (inc || []).filter(x => x && x.id != null).forEach(x => {
          const id = String(x.id),
            ex = map.get(id);
          if (!ex) {
            map.set(id, x);
            added++;
          } else if (stamp(x) > stamp(ex) && JSON.stringify(x) !== JSON.stringify(ex)) {
            map.set(id, x);
            updated++;
          }
        });
        const incIds = new Set((inc || []).map(x => String(x.id)));
        const newOnes = (inc || []).filter(x => x && !cur.some(c => String(c.id) === String(x.id)));
        const rest = cur.map(c => map.get(String(c.id)));
        return {
          list: [...newOnes, ...rest],
          added,
          updated,
          incIds
        };
      };
      const w = mergeList(weeks, data.weeks),
        r = mergeList(readings, data.readings),
        c = mergeList(cards, data.cards);
      setWeeks(w.list);
      setReadings(r.list);
      setCards(c.list);
      showToast('Yedek yüklendi: ' + w.added + ' hafta, ' + r.added + ' metin, ' + c.added + ' kart eklendi' + (w.updated + r.updated + c.updated ? ', ' + (w.updated + r.updated + c.updated) + ' öğe güncellendi' : '') + (sync.user ? '. Buluta eşitleniyor…' : '.'));
    } catch (e) {
      showToast('Yedek yüklenemedi: ' + (e instanceof SyntaxError ? 'dosya geçerli bir yedek değil.' : e && e.message ? e.message : 'dosya okunamadı'), true);
    }
  };
  const [settings, setSettings] = useState(() => initial[STORAGE_KEYS.SETTINGS] || {
    theme: 'dark',
    notificationTime: '20:00',
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    appUrl: window.location.href,
    cloudProvider: 'none'
  });
  const persist = (key, val) => {
    persistKey(storageMode, key, val).then(err => {
      if (!err) return;
      setStorageWarning(isQuotaError(err) ? 'Depolama alanı doldu; son değişiklikler bu cihaza kaydedilemedi. "⬇ Yedek indir" ile yedek alın ve kullanılmayan uzun metinleri silin.' : 'Veriler kaydedilemedi: ' + (err.message || err) + '. "⬇ Yedek indir" ile yedek almanız önerilir.');
    });
  };
  const [selectedWeekId, setSelectedWeekId] = useState(null);
  const [selectedReadingId, setSelectedReadingId] = useState(null);
  const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [initialWord, setInitialWord] = useState('');
  const [initialSentence, setInitialSentence] = useState('');
  const [isNewWeekOpen, setIsNewWeekOpen] = useState(false);
  const [isUploadReadingOpen, setIsUploadReadingOpen] = useState(false);
  const [isUploadExamOpen, setIsUploadExamOpen] = useState(false);
  const [customExams, setCustomExams] = useState(() => getStored('custom_exams', []));
  const [autoVocabReadingId, setAutoVocabReadingId] = useState(null);
  const [recentCardIds, setRecentCardIds] = useState([]);
  const [toast, setToast] = useState('');
  const showToast = (msg, isError) => {
    setToast((isError ? '⚠ ' : '') + msg);
    setTimeout(() => setToast(''), 6000);
  };
  const [duplicateCard, setDuplicateCard] = useState(null);
  useEffect(() => {
    setStored('custom_exams', customExams);
  }, [customExams]);
  const handleExtractVocabFromExam = exam => {
    const vocabQs = exam.questions.filter(q => q.num <= 6 || q.category.includes('Kelime'));
    if (!vocabQs.length) {
      showToast('Bu sınavda ayrıştırılmış kelime sorusu bulunamadı.', true);
      return;
    }
    const existingWords = new Set(cards.map(c => String(c.lemma || c.english).toLowerCase()));
    const newCards = [];
    const now = new Date().toISOString();
    vocabQs.forEach(q => {
      q.options.forEach((opt, idx) => {
        const clean = opt.trim().toLowerCase().replace(/[^a-z\s-]/g, '');
        if (clean.length >= 3 && !existingWords.has(clean) && !STOPWORDS.has(clean)) {
          existingWords.add(clean);
          const isCorrect = q.answer === idx;
          const cardId = 'card_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          newCards.push({
            id: cardId,
            english: opt.trim(),
            lemma: clean,
            turkish: '(çıkmış sınav kelimesi)',
            partOfSpeech: clean.endsWith('ly') ? 'adverb' : clean.endsWith('tion') ? 'noun' : 'verb',
            originalSentence: isCorrect ? q.prompt.replace(/----/g, opt.trim()) : q.prompt,
            questionType: 'Kelime Soruları (Soru 1-6)',
            sourceType: 'verified_exam',
            examInfo: {
              year: exam.year,
              term: exam.term,
              field: exam.field,
              verified: true
            },
            isDifficult: false,
            srs: createSRS(cardId),
            createdAt: now,
            updatedAt: now
          });
        }
      });
    });
    if (newCards.length > 0) {
      setCards([...newCards, ...cards]);
      showToast(`"${exam.title}" sınavından ${newCards.length} doğrulanmış çıkmış kelime bankanıza eklendi!`);
    } else {
      showToast('Sınavdaki hedef kelimeler zaten kelime bankanızda mevcut.');
    }
  };
  const [selectionText, setSelectionText] = useState('');
  const [popoverPos, setPopoverPos] = useState(null);
  const [expandedPhrase, setExpandedPhrase] = useState('');
  const [bionicReading, setBionicReading] = useState(false);
  const [wordPop, setWordPop] = useState(null);
  const [awlHighlight, setAwlHighlight] = useState(false);
  const [sentenceToAnalyze, setSentenceToAnalyze] = useState(null);
  const [audioOpen, setAudioOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [examPreset, setExamPreset] = useState(null);
  const handleWordClick = (e, reading) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 1) return;
    let node = null,
      offset = 0;
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) {
        node = r.startContainer;
        offset = r.startOffset;
      }
    } else if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (p) {
        node = p.offsetNode;
        offset = p.offset;
      }
    }
    if (!node || node.nodeType !== 3) {
      setWordPop(null);
      return;
    }
    const text = node.textContent;
    const isW = ch => /[A-Za-z'’-]/.test(ch || '');
    let s = offset,
      en = offset;
    while (s > 0 && isW(text[s - 1])) s--;
    while (en < text.length && isW(text[en])) en++;
    while (s < en && /['’-]/.test(text[s])) s++;
    while (en > s && /['’-]/.test(text[en - 1])) en--;
    let word = text.slice(s, en);
    if (/['’]s$/i.test(word)) {
      word = word.slice(0, -2);
      en -= 2;
    }
    if (word.length < 2 || !/[A-Za-z]{2}/.test(word)) {
      setWordPop(null);
      return;
    }
    const range = document.createRange();
    range.setStart(node, s);
    range.setEnd(node, en);
    const rect = range.getBoundingClientRect();
    if (!rect || rect.left === 0 && rect.top === 0) return;
    setPopoverPos(null);
    setWordPop({
      word,
      sentence: extractSentence(reading.content.replace(/^##\s+/gm, ''), word),
      x: rect.left + rect.width / 2,
      y: rect.bottom,
      top: rect.top,
      readingId: reading.id
    });
  };
  const addWordFromPopover = (info, pop) => {
    const reading = readings.find(r => r.id === pop.readingId);
    const now = new Date().toISOString();
    const lemma = (info.lemma || pop.word).toLowerCase();
    const source = {
      readingId: reading ? reading.id : '',
      readingTitle: reading ? reading.title : '',
      weekId: reading ? reading.weekId : '',
      sentence: pop.sentence,
      dateAdded: now
    };
    const existing = cards.find(c => String(c.lemma || c.english).toLowerCase() === lemma);
    if (existing) {
      setCards(cards.map(c => c.id === existing.id ? {
        ...c,
        sources: [...(c.sources || []), source],
        updatedAt: now
      } : c));
      showToast('"' + lemma + '" zaten bankada; yeni cümle eklendi.');
    } else {
      const id = 'card_' + Date.now();
      setCards([{
        id,
        english: lemma,
        lemma,
        turkish: info.turkish || '(anlam bulunamadı – düzenleyin)',
        trSenses: info.trSenses || [],
        trSource: info.trSource || '',
        ipa: info.ipa || '',
        okunus: info.okunus || '',
        audioUrl: info.audioUrl || '',
        definition: info.definition || '',
        examples: info.examples || [],
        synonyms: info.synonyms || [],
        antonyms: info.antonyms || [],
        partOfSpeech: info.pos || 'noun',
        originalSentence: pop.sentence,
        readingId: source.readingId,
        readingTitle: source.readingTitle,
        weekId: source.weekId,
        sources: [source],
        sourceType: 'user_reading',
        isDifficult: false,
        srs: createSRS(id),
        createdAt: now,
        updatedAt: now
      }, ...cards]);
      if (reading) setReadings(readings.map(r => r.id === reading.id ? {
        ...r,
        savedWordIds: [...(r.savedWordIds || []), id]
      } : r));
      showToast('"' + lemma + '" karta eklendi.');
    }
    setWordPop(null);
  };
  useEffect(() => {
    persist(STORAGE_KEYS.WEEKS, weeks);
  }, [weeks]);
  useEffect(() => {
    persist(STORAGE_KEYS.READINGS, readings);
  }, [readings]);
  useEffect(() => {
    (async () => {
      try {
        if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
      } catch (e) {}
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const {
            usage,
            quota
          } = await navigator.storage.estimate();
          if (quota && usage / quota > 0.85) setStorageWarning('Depolama alanının %' + Math.round(usage / quota * 100) + '\'i dolu. "⬇ Yedek indir" ile yedek alın.');
        }
      } catch (e) {}
    })();
  }, []);
  const deleteReading = id => {
    const r = readings.find(x => x.id === id);
    if (!r) return;
    if (!window.confirm('"' + r.title + '" metni silinsin mi? Bu işlem geri alınamaz.\n(Bu metinden kaydettiğiniz kelimeler silinmez.)')) return;
    setReadings(prev => prev.filter(x => x.id !== id));
    if (selectedReadingId === id) setSelectedReadingId(null);
  };
  useEffect(() => {
    persist(STORAGE_KEYS.VOCAB, cards);
  }, [cards]);
  useEffect(() => {
    persist(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);
  useEffect(() => {
    persist(STORAGE_KEYS.ACTIVITY, activity);
  }, [activity]);
  const today = getTodayStr();
  const dueCards = cards.filter(c => c.srs.nextReviewAt <= today);
  const [extraReviewIds, setExtraReviewIds] = useState(null);
  const reviewCards = extraReviewIds ? cards.filter(c => extraReviewIds.includes(c.id)) : dueCards;
  const streakNow = computeStreak(activity);
  const todayRec = activity.find(a => a.id === today) || {};
  const examLeft = daysUntil(settings.examDate);
  const difficultCards = cards.filter(c => c.isDifficult || c.srs.lapses >= 3);
  const masteredCards = cards.filter(c => c.srs.state === 'mastered');
  const handleReaderSelection = readingContent => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setPopoverPos(null);
      setExpandedPhrase('');
      return;
    }
    const text = sel.toString().trim();
    if (text.length >= 2) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const cleanContent = readingContent.replace(/^##\s+/gm, '');
      const sentence = extractSentence(cleanContent, text);
      setSelectionText(text);
      setInitialSentence(sentence);
      const smartExp = findSmartCollocation(sentence, text);
      setExpandedPhrase(smartExp && smartExp.toLowerCase() !== text.toLowerCase() ? smartExp : '');
      setPopoverPos({
        top: rect.top,
        left: rect.left + rect.width / 2
      });
    }
  };
  const handleAddSelection = () => {
    const norm = selectionText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const dup = cards.find(c => c.english.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim() === norm);
    if (dup) {
      setDuplicateCard(dup);
      setPopoverPos(null);
    } else {
      setInitialWord(selectionText);
      setEditingCard(null);
      setIsVocabModalOpen(true);
      setPopoverPos(null);
    }
  };
  const handleAppendSource = () => {
    if (!duplicateCard) return;
    const currentReading = readings.find(r => r.id === selectedReadingId);
    const updated = cards.map(c => {
      if (c.id === duplicateCard.id) {
        const sources = c.sources || [];
        sources.push({
          readingId: currentReading?.id || '',
          readingTitle: currentReading?.title || '',
          sentence: initialSentence,
          dateAdded: new Date().toISOString()
        });
        return {
          ...c,
          sources,
          updatedAt: new Date().toISOString()
        };
      }
      return c;
    });
    setCards(updated);
    setDuplicateCard(null);
    alert('Mevcut karta yeni örnek cümle ve kaynak başarıyla eklendi!');
  };
  const navItems = [{
    id: 'dashboard',
    label: 'Ana Sayfa',
    short: 'Ana',
    icon: '📊'
  }, {
    id: 'daily-review',
    label: 'Günlük Tekrar',
    short: 'Tekrar',
    icon: '🔄',
    badge: dueCards.length
  }, {
    id: 'weeks',
    label: 'Haftalık Listelerim',
    icon: '📅'
  }, {
    id: 'readings',
    label: 'Okuma Parçalarım',
    short: 'Metinler',
    icon: '📖'
  }, {
    id: 'bank',
    label: 'YÖKDİL Kelime Bankası',
    icon: '🗄️'
  }, {
    id: 'flashcards',
    label: 'Kelime Kartları',
    short: 'Kartlar',
    icon: '🃏',
    badge: cards.filter(isMissingMeaning).length
  }, {
    id: 'study',
    label: 'Sınavlar & Testler',
    short: 'Sınav',
    icon: '🎓'
  }, {
    id: 'difficult',
    label: 'Zorlandığım Kelimeler',
    icon: '⚠️',
    badge: difficultCards.length
  }, {
    id: 'stats',
    label: 'İstatistikler',
    icon: '📈'
  }, {
    id: 'settings',
    label: 'Ayarlar',
    icon: '⚙️'
  }];
  const MOBILE_MAIN = ['dashboard', 'daily-review', 'readings', 'flashcards', 'study'];
  const goTab = id => {
    setActiveTab(id);
    setMoreOpen(false);
    if (id !== 'weeks') setSelectedWeekId(null);
    if (id !== 'readings') setSelectedReadingId(null);
    if (id !== 'daily-review') setExtraReviewIds(null);
  };
  return React.createElement("div", {
    className: "flex h-screen w-screen overflow-hidden bg-slate-900 text-slate-100 font-sans"
  }, React.createElement("nav", {
    className: "md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex safe-area-bottom",
    "aria-label": "Ana men\xFC"
  }, navItems.filter(n => MOBILE_MAIN.includes(n.id)).map(item => React.createElement("button", {
    key: item.id,
    onClick: () => goTab(item.id),
    "aria-current": activeTab === item.id ? 'page' : undefined,
    className: "relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold " + (activeTab === item.id ? 'text-blue-400' : 'text-slate-400')
  }, React.createElement("span", {
    className: "text-lg leading-none"
  }, item.icon), item.short, item.badge > 0 && React.createElement("span", {
    className: "absolute top-1 right-1/4 text-[9px] bg-blue-600 text-white px-1.5 rounded-full font-black"
  }, item.badge))), React.createElement("button", {
    onClick: () => setMoreOpen(true),
    className: "flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold " + (!MOBILE_MAIN.includes(activeTab) ? 'text-blue-400' : 'text-slate-400')
  }, React.createElement("span", {
    className: "text-lg leading-none"
  }, "\u2630"), "Daha")), moreOpen && React.createElement("div", {
    className: "md:hidden fixed inset-0 z-50 bg-black/60",
    onClick: () => setMoreOpen(false)
  }, React.createElement("div", {
    className: "absolute bottom-0 inset-x-0 bg-slate-950 border-t border-slate-800 rounded-t-3xl p-4 space-y-2 max-h-[85vh] overflow-y-auto safe-area-bottom",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "w-10 h-1 rounded bg-slate-700 mx-auto mb-2"
  }), React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, navItems.filter(n => !MOBILE_MAIN.includes(n.id)).map(item => React.createElement("button", {
    key: item.id,
    onClick: () => goTab(item.id),
    className: "flex items-center gap-2 px-3 py-3 rounded-xl text-xs font-semibold " + (activeTab === item.id ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-200')
  }, React.createElement("span", null, item.icon), item.label, item.badge > 0 && React.createElement("span", {
    className: "ml-auto text-[10px] bg-white text-blue-700 px-1.5 rounded-full font-black"
  }, item.badge)))), React.createElement(SyncPanel, {
    sync: sync,
    backup: {
      onExport: exportBackup,
      onImport: importBackup
    }
  }))), React.createElement("aside", {
    className: "hidden md:flex flex-col w-64 bg-slate-950 border-r border-slate-800 p-4 select-none"
  }, React.createElement("div", {
    className: "flex items-center gap-3 pb-5 border-b border-slate-800"
  }, React.createElement("div", {
    className: "w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/20"
  }, "Y"), React.createElement("div", null, React.createElement("h1", {
    className: "font-extrabold text-base tracking-tight text-white flex items-center gap-1.5"
  }, "Y\xD6KD\u0130L Master", React.createElement("span", {
    className: "text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold"
  }, "SRS")), React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Ki\u015Fisel Kelime Sistemi"))), React.createElement("nav", {
    className: "flex-1 py-4 space-y-1"
  }, navItems.map(item => React.createElement("button", {
    key: item.id,
    onClick: () => goTab(item.id),
    className: `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${activeTab === item.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-300 hover:bg-slate-800/80'}`
  }, React.createElement("div", {
    className: "flex items-center gap-3"
  }, React.createElement("span", null, item.icon), React.createElement("span", null, item.label)), item.badge !== undefined && item.badge > 0 && React.createElement("span", {
    className: "text-[10px] bg-white text-blue-700 px-2 py-0.5 rounded-full font-black"
  }, item.badge)))), React.createElement(SyncPanel, {
    sync: sync,
    backup: {
      onExport: exportBackup,
      onImport: importBackup
    }
  })), React.createElement("div", {
    className: "flex-1 flex flex-col h-full overflow-hidden"
  }, React.createElement("header", {
    className: "bg-slate-950 border-b border-slate-800 px-4 md:px-6 py-3 md:py-3.5 flex items-center justify-between gap-2"
  }, React.createElement("div", {
    className: "min-w-0"
  }, React.createElement("h2", {
    className: "text-sm md:text-base font-bold text-white capitalize truncate"
  }, {
    'dashboard': 'Ana Sayfa',
    'daily-review': 'Günlük Tekrar (Spaced Repetition)',
    'weeks': 'Haftalık Listelerim',
    'readings': 'Okuma Parçalarım',
    'bank': 'YÖKDİL Kelime Bankası',
    'flashcards': 'Kelime Kartları',
    'study': 'Sınavlar & Testler',
    'difficult': 'Zorlandığım Kelimeler',
    'stats': 'İstatistikler',
    'settings': 'Ayarlar'
  }[activeTab] || activeTab)), React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("button", {
    onClick: () => setIsUploadReadingOpen(true),
    className: "px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 transition whitespace-nowrap"
  }, "+ Metin", React.createElement("span", {
    className: "hidden sm:inline"
  }, " Y\xFCkle")), React.createElement("button", {
    onClick: () => {
      setEditingCard(null);
      setInitialWord('');
      setInitialSentence('');
      setIsVocabModalOpen(true);
    },
    className: "px-2.5 md:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow transition whitespace-nowrap"
  }, "+ Kelime", React.createElement("span", {
    className: "hidden sm:inline"
  }, " Ekle")))), React.createElement("main", {
    className: "flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 max-w-6xl w-full mx-auto pb-24 md:pb-6"
  }, activeTab === 'dashboard' && React.createElement("div", {
    className: "space-y-6"
  }, React.createElement("div", {
    className: "bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden"
  }, React.createElement("h2", {
    className: "text-2xl font-black"
  }, dueCards.length > 0 ? `Bugün ${dueCards.length} Kelime Tekrar Bekliyor!` : 'Harika! Bugünkü Tüm Tekrarlarını Tamamladın.'), React.createElement("p", {
    className: "text-xs text-blue-100 mt-2 max-w-xl"
  }, "Aral\u0131kl\u0131 tekrar algoritmas\u0131 bilginizi unutulma e\u015Fi\u011Finde haf\u0131zan\u0131za \xE7a\u011F\u0131rarak uzun vadeli kal\u0131c\u0131l\u0131k sa\u011Flar."), React.createElement("div", {
    className: "mt-5 flex gap-3"
  }, dueCards.length > 0 ? React.createElement("button", {
    onClick: () => setActiveTab('daily-review'),
    className: "px-5 py-2.5 rounded-xl bg-white text-blue-900 font-extrabold text-xs shadow-lg hover:bg-blue-50 transition"
  }, "Tekrar\u0131 Ba\u015Flat (", dueCards.length, ")") : React.createElement("button", {
    onClick: () => setActiveTab('study'),
    className: "px-5 py-2.5 rounded-xl bg-white/20 text-white font-bold text-xs hover:bg-white/30 transition"
  }, "S\u0131nav Modlar\u0131"), React.createElement("button", {
    onClick: () => setIsUploadReadingOpen(true),
    className: "px-4 py-2.5 rounded-xl bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition"
  }, "Yeni Metin Y\xFCkle"))), React.createElement("div", {
    className: "grid grid-cols-3 gap-3"
  }, React.createElement("button", {
    onClick: () => setActiveTab('stats'),
    className: "text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-orange-600 transition"
  }, React.createElement("p", {
    className: "text-[11px] text-slate-400"
  }, "\uD83D\uDD25 Seri"), React.createElement("p", {
    className: "text-xl font-black text-orange-400"
  }, streakNow, " g\xFCn")), React.createElement("button", {
    onClick: () => setActiveTab('daily-review'),
    className: "text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-blue-600 transition"
  }, React.createElement("p", {
    className: "text-[11px] text-slate-400"
  }, "\uD83C\uDFAF Bug\xFCn"), React.createElement("p", {
    className: "text-xl font-black text-white"
  }, todayRec.reviews || 0, React.createElement("span", {
    className: "text-xs text-slate-500"
  }, "/", settings.dailyGoal || 20)), React.createElement("div", {
    className: "h-1.5 mt-1 rounded bg-slate-800 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-blue-500",
    style: {
      width: Math.min(100, (todayRec.reviews || 0) / (settings.dailyGoal || 20) * 100) + '%'
    }
  }))), React.createElement("button", {
    onClick: () => setActiveTab('stats'),
    className: "text-left bg-slate-950 p-4 rounded-2xl border border-slate-800 hover:border-indigo-600 transition"
  }, React.createElement("p", {
    className: "text-[11px] text-slate-400"
  }, "\uD83D\uDCC5 S\u0131nava"), React.createElement("p", {
    className: "text-xl font-black text-indigo-300"
  }, examLeft == null ? 'Tarih gir' : examLeft > 0 ? examLeft + ' gün' : examLeft === 0 ? 'Bugün' : '—'))), React.createElement("div", {
    className: "grid grid-cols-2 sm:grid-cols-4 gap-4"
  }, React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800"
  }, React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Toplam Kay\u0131tl\u0131 Kelime"), React.createElement("p", {
    className: "text-3xl font-black text-white mt-1"
  }, cards.length)), React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800"
  }, React.createElement("p", {
    className: "text-xs text-blue-400"
  }, "Bug\xFCn Tekrar"), React.createElement("p", {
    className: "text-3xl font-black text-blue-400 mt-1"
  }, dueCards.length)), React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800"
  }, React.createElement("p", {
    className: "text-xs text-emerald-400"
  }, "Kal\u0131c\u0131 Haf\u0131zada"), React.createElement("p", {
    className: "text-3xl font-black text-emerald-400 mt-1"
  }, masteredCards.length)), React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800"
  }, React.createElement("p", {
    className: "text-xs text-amber-400"
  }, "Zorland\u0131\u011F\u0131m"), React.createElement("p", {
    className: "text-3xl font-black text-amber-400 mt-1"
  }, difficultCards.length))), React.createElement("div", {
    className: "bg-slate-950 p-6 rounded-2xl border border-slate-800"
  }, React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, React.createElement("h3", {
    className: "font-bold text-sm text-white"
  }, "Haftal\u0131k \xC7al\u0131\u015Fma Listelerim"), React.createElement("button", {
    onClick: () => setIsNewWeekOpen(true),
    className: "text-xs text-blue-400 font-bold hover:underline"
  }, "+ Yeni Hafta Olu\u015Ftur")), weeks.length === 0 ? React.createElement("div", {
    className: "text-center py-10 border border-dashed border-slate-800 rounded-xl text-xs text-slate-400"
  }, "Hen\xFCz \xE7al\u0131\u015Fma haftas\u0131 olu\u015Fturulmad\u0131. \"Yeni Hafta Olu\u015Ftur\" butonuna basarak ba\u015Flayabilirsiniz.") : React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-3"
  }, weeks.map(w => {
    const wReadings = readings.filter(r => r.weekId === w.id);
    const wCards = cards.filter(c => c.weekId === w.id);
    return React.createElement("div", {
      key: w.id,
      onClick: () => {
        setSelectedWeekId(w.id);
        setActiveTab('weeks');
      },
      className: "p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500 cursor-pointer transition flex justify-between items-center"
    }, React.createElement("div", null, React.createElement("h4", {
      className: "font-bold text-sm text-white"
    }, w.title), React.createElement("p", {
      className: "text-xs text-slate-400 mt-1"
    }, wReadings.length, " metin \u2022 ", wCards.length, " kelime")), React.createElement("span", {
      className: "text-xs font-bold text-blue-400"
    }, "G\xF6r\xFCnt\xFCle \u2192"));
  })))), activeTab === 'daily-review' && React.createElement("div", {
    className: "max-w-xl mx-auto space-y-4"
  }, extraReviewIds && React.createElement("div", {
    className: "flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-200"
  }, React.createElement("span", null, "Zorland\u0131\u011F\u0131m kelimeler tekrar ediliyor (", extraReviewIds.length, ")"), React.createElement("button", {
    onClick: () => setExtraReviewIds(null),
    className: "underline"
  }, "Normal tekrara d\xF6n")), reviewCards.length === 0 ? React.createElement("div", {
    className: "text-center py-16 bg-slate-950 rounded-3xl border border-slate-800 p-8 space-y-4"
  }, React.createElement("div", {
    className: "text-5xl"
  }, "\uD83C\uDF89"), React.createElement("h3", {
    className: "text-xl font-bold text-white"
  }, "Harika \u0130\u015F!"), React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "Bug\xFCn tekrar bekleyen kelimeniz bulunmuyor. Yeni bir okuma par\xE7as\u0131 ekleyebilir veya s\u0131nav modlar\u0131n\u0131 deneyebilirsiniz."), React.createElement("button", {
    onClick: () => setActiveTab('study'),
    className: "px-5 py-2.5 rounded-xl bg-blue-600 font-bold text-xs text-white"
  }, "S\u0131nav Modlar\u0131na Git")) : React.createElement(DailyReviewSession, {
    key: 'review-' + getTodayStr() + (extraReviewIds ? '-extra' : ''),
    cards: reviewCards,
    goal: settings.dailyGoal || 20,
    doneToday: (activity.find(a => a.id === getTodayStr()) || {}).reviews || 0,
    onComplete: () => {
      if (window.confetti) window.confetti({
        particleCount: 100
      });
      setExtraReviewIds(null);
      setActiveTab('dashboard');
    },
    onRate: (cardId, rating) => {
      const now = new Date().toISOString();
      setCards(prev => prev.map(c => c.id === cardId ? {
        ...c,
        srs: processReview(c.srs, rating),
        updatedAt: now
      } : c));
      logActivity({
        reviews: 1,
        correct: rating >= 3 ? 1 : 0,
        again: rating === 1 ? 1 : 0
      });
    }
  })), activeTab === 'readings' && (selectedReadingId ? (() => {
    const current = readings.find(r => r.id === selectedReadingId);
    if (!current) return null;
    return React.createElement("div", {
      className: "space-y-4 max-w-4xl mx-auto"
    }, React.createElement("div", {
      className: "flex justify-between items-center"
    }, React.createElement("button", {
      onClick: () => setSelectedReadingId(null),
      className: "text-xs font-bold text-slate-400 hover:text-blue-400"
    }, "\u2190 T\xFCm Okuma Par\xE7alar\u0131na D\xF6n"), React.createElement("button", {
      onClick: () => setAutoVocabReadingId(current.id),
      className: "ml-auto mr-2 px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 transition"
    }, "\u2728 Kelimeleri \xC7\u0131kar"), React.createElement("button", {
      onClick: () => deleteReading(current.id),
      className: "px-3 py-1.5 rounded-lg bg-red-600/15 border border-red-600/40 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition"
    }, "\uD83D\uDDD1 Metni Sil")), React.createElement("div", {
      className: "bg-slate-950 p-6 rounded-2xl border border-slate-800"
    }, React.createElement("h2", {
      className: "text-xl font-black text-white"
    }, current.title), React.createElement("p", {
      className: "text-xs text-slate-400 mt-1"
    }, current.category, " \u2022 ", current.wordCount, " kelime")), (() => {
      const bank = new Set(cards.map(c => String(c.lemma || c.english).toLowerCase()));
      const inBank = w => bank.has(w) || lemmaCandidates(w).some(x => bank.has(x));
      const seen = new Map();
      (plainText(current.content).match(/[A-Za-z]+/g) || []).forEach(t => {
        const w = t.toLowerCase();
        if (w.length < 3 || seen.has(w) || STOPWORDS.has(w)) return;
        const n = awlSublist(w);
        if (n) seen.set(w, n);
      });
      const list = [...seen.entries()].sort((a, b) => a[1] - b[1]);
      if (!list.length) return null;
      const missing = list.filter(([w]) => !inBank(w));
      return React.createElement("div", {
        className: "bg-slate-950 p-4 rounded-2xl border border-purple-900/50 space-y-2"
      }, React.createElement("div", {
        className: "flex flex-wrap items-center gap-2"
      }, React.createElement("p", {
        className: "text-xs text-purple-200 font-bold mr-auto"
      }, "\uD83D\uDCDA Bu metinde ", list.length, " akademik kelime (AWL) var", missing.length ? ', ' + missing.length + ' tanesi bankanızda yok' : ' — hepsi bankanızda ✓'), React.createElement("label", {
        className: "flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none"
      }, React.createElement("input", {
        type: "checkbox",
        checked: awlHighlight,
        onChange: e => setAwlHighlight(e.target.checked),
        className: "accent-purple-500"
      }), "Metinde vurgula")), React.createElement("div", {
        className: "flex flex-wrap gap-1"
      }, list.slice(0, 80).map(([w, n]) => React.createElement("button", {
        key: w,
        onClick: e => {
          const r = e.currentTarget.getBoundingClientRect();
          setWordPop({
            word: w,
            sentence: extractSentence(plainText(current.content), w),
            x: r.left + r.width / 2,
            y: r.bottom,
            top: r.top,
            readingId: current.id
          });
        },
        title: 'Alt liste ' + n + (inBank(w) ? ' · bankada var' : ' · anlamını gör / karta ekle'),
        className: "px-2 py-0.5 rounded-full text-[11px] border " + (inBank(w) ? 'border-emerald-800 text-emerald-300 bg-emerald-950/40' : 'border-purple-800 text-purple-200 bg-purple-950/40 hover:bg-purple-900')
      }, w, React.createElement("sup", {
        className: "ml-0.5 text-[8px] opacity-70"
      }, n)))));
    })(), React.createElement("div", {
      className: "flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs"
    }, React.createElement("span", {
      className: "text-slate-400 font-medium"
    }, "\uD83D\uDCA1 \u0130pucu: Kelimeye t\u0131klay\u0131p anlam\u0131n\u0131 g\xF6r\xFCn veya fareyle/dokunarak se\xE7ip kal\u0131p olarak ekleyin."), React.createElement("label", {
      className: "flex items-center gap-1.5 text-xs text-amber-300 cursor-pointer select-none font-bold bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-800/60 hover:bg-amber-950/70 transition"
    }, React.createElement("input", {
      type: "checkbox",
      checked: bionicReading,
      onChange: e => setBionicReading(e.target.checked),
      className: "accent-amber-400"
    }), "\u26A1 Bionic Reading (Akademik Odak)")), React.createElement("div", {
      "data-reader": true,
      title: "Bir kelimeye t\u0131klay\u0131n: anlam\u0131 g\xF6r\xFCns\xFCn",
      onMouseUp: () => handleReaderSelection(current.content),
      onTouchEnd: () => handleReaderSelection(current.content),
      onClick: e => handleWordClick(e, current),
      className: "bg-slate-950 p-8 rounded-2xl border border-slate-800 text-slate-200 font-serif leading-loose text-base whitespace-pre-wrap select-text"
    }, (() => {
      const hl = awlHighlight && current.content.length < 120000;
      const bank = hl ? new Set(cards.map(c => String(c.lemma || c.english).toLowerCase())) : null;
      const renderLine = line => {
        if (bionicReading) {
          return line.split(/(\s+)/).map((tok, k) => {
            if (/^\s+$/.test(tok)) return tok;
            return formatBionicWord(tok, k);
          });
        }
        if (!hl) return line;
        return line.split(/([A-Za-z]+)/).map((tok, k) => {
          if (k % 2 === 0) return tok;
          const w = tok.toLowerCase();
          if (w.length < 3 || STOPWORDS.has(w) || !awlSublist(w)) return tok;
          const own = bank.has(w) || lemmaCandidates(w).some(x => bank.has(x));
          return React.createElement("span", {
            key: k,
            className: "underline decoration-2 underline-offset-4 " + (own ? 'decoration-emerald-500/70' : 'decoration-purple-400')
          }, tok);
        });
      };
      return current.content.split('\n').map((line, i) => /^##\s+/.test(line) ? React.createElement("strong", {
        key: i,
        className: "block font-sans font-black text-white text-lg leading-snug mt-2 mb-1"
      }, line.replace(/^##\s+/, '')) : React.createElement(React.Fragment, {
        key: i
      }, renderLine(line), '\n'));
    })()));
  })() : React.createElement("div", {
    className: "space-y-4"
  }, React.createElement("div", {
    className: "flex justify-between items-center"
  }, React.createElement("h3", {
    className: "font-bold text-lg text-white"
  }, "Y\xFCkledi\u011Finiz Okuma Par\xE7alar\u0131"), React.createElement("button", {
    onClick: () => setIsUploadReadingOpen(true),
    className: "px-3.5 py-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white"
  }, "+ Metin Y\xFCkle")), readings.length === 0 ? React.createElement("div", {
    className: "text-center py-16 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400"
  }, "Hen\xFCz okuma metni y\xFCklenmedi.") : React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 gap-4"
  }, readings.map(r => React.createElement("div", {
    key: r.id,
    onClick: () => setSelectedReadingId(r.id),
    className: "relative p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500 cursor-pointer transition"
  }, React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      deleteReading(r.id);
    },
    title: "Metni sil",
    "aria-label": '"' + r.title + '" metnini sil',
    className: "absolute top-3 right-3 px-2 py-1 rounded-lg text-xs text-slate-500 hover:bg-red-600 hover:text-white transition"
  }, "\uD83D\uDDD1 Sil"), React.createElement("span", {
    className: "text-[10px] font-bold text-blue-400"
  }, r.category), React.createElement("h4", {
    className: "font-bold text-base text-white mt-1"
  }, r.title), React.createElement("p", {
    className: "text-xs text-slate-400 line-clamp-3 mt-2 font-serif"
  }, r.content.replace(/^##\s+/gm, '')), React.createElement("p", {
    className: "text-[11px] text-blue-400 font-bold mt-4"
  }, "A\xE7 ve Kelime Se\xE7 \u2192")))))), activeTab === 'stats' && React.createElement(StatsSection, {
    cards: cards,
    activity: activity,
    settings: settings,
    setSettings: setSettings
  }), activeTab === 'difficult' && React.createElement(DifficultSection, {
    cards: cards,
    onUnmark: id => setCards(prev => prev.map(c => c.id === id ? {
      ...c,
      isDifficult: false,
      updatedAt: new Date().toISOString()
    } : c)),
    onStudy: ids => {
      setExtraReviewIds(ids);
      setActiveTab('daily-review');
    }
  }), activeTab === 'study' && React.createElement(ExamSection, {
    cards: cards,
    readings: readings,
    customExams: customExams,
    onOpenUploadExam: () => setIsUploadExamOpen(true),
    onDeleteExam: id => {
      if (window.confirm('Bu çıkmış sınavı silmek istediğinize emin misiniz?')) {
        setCustomExams(prev => prev.filter(e => e.id !== id));
        showToast('Sınav silindi.');
      }
    },
    onExtractVocabFromExam: handleExtractVocabFromExam,
    onAnswer: (type, ok) => logActivity({
      examQ: 1,
      examCorrect: ok ? 1 : 0
    }, {
      [type]: [ok ? 1 : 0, 1]
    }),
    prepBest: settings.prepBest || 0,
    onPrepBest: n => setSettings(s => ({
      ...s,
      prepBest: n
    })),
    preset: examPreset,
    onPresetUsed: () => setExamPreset(null),
    onCheckupDone: (c, n) => {
      logActivity({
        checkups: 1,
        checkupCorrect: c,
        checkupTotal: n
      });
      showToast('Haftalık check-up: ' + c + '/' + n + ' (%' + Math.round(c / n * 100) + ')');
    },
    onMarkDifficult: ids => {
      const set = new Set(ids);
      setCards(prev => prev.map(c => set.has(c.id) ? {
        ...c,
        isDifficult: true,
        updatedAt: new Date().toISOString()
      } : c));
      showToast(ids.length + ' kelime "Zorlandığım Kelimeler"e eklendi.');
    }
  }), activeTab === 'flashcards' && React.createElement(FlashcardsSection, {
    cards: cards,
    readings: readings,
    recentIds: recentCardIds,
    onUpdate: updated => setCards(prev => prev.map(c => c.id === updated.id ? updated : c)),
    onUpdateMany: list => {
      const m = new Map(list.map(c => [c.id, c]));
      setCards(prev => prev.map(c => m.get(c.id) || c));
    },
    onAudio: () => setAudioOpen(true),
    onDelete: id => {
      const word = (cards.find(c => c.id === id) || {}).english;
      setCards(prev => prev.filter(c => c.id !== id));
      setRecentCardIds(prev => prev.filter(x => x !== id));
      setReadings(prev => prev.map(r => (r.savedWordIds || []).includes(id) ? {
        ...r,
        savedWordIds: r.savedWordIds.filter(x => x !== id)
      } : r));
      setToast('"' + word + '" kartı silindi.');
      setTimeout(() => setToast(''), 3000);
    }
  }), activeTab === 'bank' && React.createElement("div", {
    className: "space-y-4"
  }, React.createElement("div", {
    className: "flex justify-between items-center"
  }, React.createElement("h3", {
    className: "font-bold text-lg text-white"
  }, "Kelime Bankas\u0131 (", cards.length, ")"), React.createElement("button", {
    onClick: () => {
      const q = v => '"' + String(Array.isArray(v) ? v.join('; ') : v || '').replace(/"/g, '""') + '"';
      const csvContent = "English,Turkish,IPA,Okunus,PartOfSpeech,Synonyms,Antonyms,OriginalSentence,Examples\n" + cards.map(c => [c.english, c.turkish, c.ipa, c.okunus, c.partOfSpeech, c.synonyms, c.antonyms, c.originalSentence, c.examples].map(q).join(',')).join("\n");
      const blob = new Blob(['﻿' + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'yokdil_kelimeler.csv';
      a.click();
    },
    className: "px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
  }, "CSV D\u0131\u015Fa Aktar")), React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
  }, cards.map(c => React.createElement("div", {
    key: c.id,
    className: "p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
  }, React.createElement("div", {
    className: "flex justify-between items-center"
  }, React.createElement("span", {
    className: "text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300"
  }, c.partOfSpeech), React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement(TurengLink, {
    word: c.lemma || c.english
  }), React.createElement("button", {
    onClick: () => playWord(c),
    className: "text-xs text-blue-400"
  }, "\uD83D\uDD0A Dinle"))), React.createElement("h4", {
    className: "font-bold text-base text-white"
  }, c.english), (c.ipa || c.okunus) && React.createElement("p", {
    className: "text-[11px] text-slate-400"
  }, c.ipa && React.createElement("span", {
    className: "font-mono"
  }, "/", c.ipa, "/"), c.okunus && React.createElement("span", {
    className: "text-amber-300 ml-1.5"
  }, "[", c.okunus, "]")), React.createElement("p", {
    className: "text-xs font-semibold text-blue-400"
  }, c.turkish), c.originalSentence && React.createElement("p", {
    className: "text-[11px] text-slate-400 font-serif italic line-clamp-2"
  }, "\"", c.originalSentence, "\""), (c.examples || [])[0] && React.createElement("p", {
    className: "text-[11px] text-slate-500 font-serif line-clamp-2"
  }, "\u2022 ", c.examples[0]), (c.synonyms || []).length > 0 && React.createElement("p", {
    className: "text-[10px]"
  }, React.createElement("span", {
    className: "text-slate-500"
  }, "E\u015F:"), " ", React.createElement("span", {
    className: "text-emerald-300"
  }, c.synonyms.slice(0, 4).join(', '))), (c.antonyms || []).length > 0 && React.createElement("p", {
    className: "text-[10px]"
  }, React.createElement("span", {
    className: "text-slate-500"
  }, "Z\u0131t:"), " ", React.createElement("span", {
    className: "text-red-300"
  }, c.antonyms.slice(0, 3).join(', '))))))), activeTab === 'settings' && React.createElement("div", {
    className: "max-w-xl mx-auto space-y-6"
  }, React.createElement("div", {
    className: "bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4"
  }, React.createElement("h3", {
    className: "font-bold text-base text-white"
  }, "Telegram Bildirim Ayarlar\u0131"), React.createElement("div", null, React.createElement("label", {
    className: "block text-xs font-semibold text-slate-300 mb-1"
  }, "Telegram Bot Token"), React.createElement("input", {
    type: "password",
    value: settings.telegramBotToken,
    onChange: e => setSettings({
      ...settings,
      telegramBotToken: e.target.value
    }),
    className: "w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-mono",
    placeholder: "BotFather'dan al\u0131nan token"
  })), React.createElement("div", null, React.createElement("label", {
    className: "block text-xs font-semibold text-slate-300 mb-1"
  }, "Telegram Chat ID"), React.createElement("input", {
    type: "text",
    value: settings.telegramChatId,
    onChange: e => setSettings({
      ...settings,
      telegramChatId: e.target.value
    }),
    className: "w-full px-3 py-2 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-mono",
    placeholder: "@userinfobot ile \xF6\u011Frenilen ID"
  })), React.createElement("button", {
    onClick: async () => {
      if (!settings.telegramBotToken || !settings.telegramChatId) {
        alert('Lütfen Bot Token ve Chat ID giriniz.');
        return;
      }
      try {
        const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: `🔔 <b>YÖKDİL Master Test Bildirimi</b>\n\nTelegram bağlantınız başarıyla sağlandı!`,
            parse_mode: 'HTML'
          })
        });
        const d = await res.json();
        if (d.ok) alert('Test bildirimi Telegram hesabınıza gönderildi!');else alert('Hata: ' + d.description);
      } catch (err) {
        alert('Ağ hatası: ' + err.message);
      }
    },
    className: "px-4 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white shadow"
  }, "Test Bildirimi G\xF6nder"))))), popoverPos && React.createElement("div", {
    style: {
      top: `${popoverPos.top}px`,
      left: `${popoverPos.left}px`,
      transform: 'translate(-50%, -100%) translateY(-10px)'
    },
    className: "fixed z-50 bg-slate-950 border border-slate-700 text-white p-2 rounded-xl shadow-2xl flex flex-wrap items-center gap-2 max-w-sm"
  }, React.createElement("button", {
    onClick: handleAddSelection,
    className: "px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow transition"
  }, "+ Kelime Listeme Ekle"), expandedPhrase && React.createElement("button", {
    onClick: () => {
      setSelectionText(expandedPhrase);
      setExpandedPhrase('');
    },
    title: "Se\xE7imi bu tamlamaya/kal\u0131ba geni\u015Flet",
    className: "px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow transition flex items-center gap-1"
  }, React.createElement("span", null, "\uD83D\uDD17 Kal\u0131b\u0131 Geni\u015Flet:"), " ", React.createElement("span", {
    className: "underline italic"
  }, "\"", expandedPhrase, "\"")), React.createElement("span", {
    className: "text-xs text-slate-300 font-mono"
  }, "\"", selectionText, "\"")), duplicateCard && React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  }, React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4"
  }, React.createElement("h3", {
    className: "font-bold text-base text-white"
  }, "Kelime Zaten Kay\u0131tl\u0131!"), React.createElement("p", {
    className: "text-xs text-slate-300"
  }, React.createElement("b", null, "\"", duplicateCard.english, "\""), " ifadesi daha \xF6nce kaydedilmi\u015F. \u0130kinci bir kart a\xE7mak yerine bu okuma par\xE7as\u0131ndaki c\xFCmleyi mevcut karta eklemek ister misiniz?"), React.createElement("div", {
    className: "flex gap-2"
  }, React.createElement("button", {
    onClick: handleAppendSource,
    className: "flex-1 py-2 rounded-xl bg-blue-600 text-xs font-bold text-white"
  }, "(\xD6nerilen) C\xFCmleyi Ekle"), React.createElement("button", {
    onClick: () => setDuplicateCard(null),
    className: "py-2 px-3 rounded-xl bg-slate-800 text-xs text-slate-300"
  }, "\u0130ptal")))), isVocabModalOpen && React.createElement(VocabAddModal, {
    initialWord: initialWord,
    initialSentence: initialSentence,
    onClose: () => setIsVocabModalOpen(false),
    onSave: newCard => {
      setCards([newCard, ...cards]);
      setIsVocabModalOpen(false);
    }
  }), wordPop && activeTab === 'readings' && React.createElement(WordPopover, {
    pop: wordPop,
    cards: cards,
    onAdd: addWordFromPopover,
    onClose: () => setWordPop(null),
    onAnalyze: s => {
      setWordPop(null);
      setSentenceToAnalyze(s);
    }
  }), audioOpen && React.createElement(AudioStudyModal, {
    cards: cards,
    dueCards: dueCards,
    onClose: () => setAudioOpen(false)
  }), sentenceToAnalyze && React.createElement(SentenceModal, {
    sentence: sentenceToAnalyze,
    cards: cards,
    onClose: () => setSentenceToAnalyze(null)
  }), autoVocabReadingId && readings.find(r => r.id === autoVocabReadingId) && React.createElement(AutoVocabModal, {
    reading: readings.find(r => r.id === autoVocabReadingId),
    cards: cards,
    onClose: () => setAutoVocabReadingId(null),
    onAdd: (newCards, updated) => {
      const upd = new Map(updated.map(c => [c.id, c]));
      setCards([...newCards, ...cards.map(c => upd.get(c.id) || c)]);
      const r = readings.find(x => x.id === autoVocabReadingId);
      if (r) {
        const ids = new Set([...(r.savedWordIds || []), ...newCards.map(c => c.id), ...updated.map(c => c.id)]);
        setReadings(readings.map(x => x.id === r.id ? {
          ...x,
          savedWordIds: [...ids]
        } : x));
      }
      setAutoVocabReadingId(null);
      setRecentCardIds([...newCards.map(c => c.id), ...updated.map(c => c.id)]);
      setSelectedReadingId(null);
      setActiveTab('flashcards');
      setToast(newCards.length + ' yeni kelime kartı oluşturuldu' + (updated.length ? ', ' + updated.length + ' mevcut kart güncellendi' : '') + '.');
      setTimeout(() => setToast(''), 4000);
    }
  }), storageWarning && React.createElement("div", {
    role: "alert",
    className: "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92vw] px-4 py-3 rounded-xl bg-red-700 text-white text-xs font-semibold shadow-2xl flex items-start gap-3"
  }, React.createElement("span", {
    className: "flex-1"
  }, "\u26A0 ", storageWarning), React.createElement("button", {
    onClick: exportBackup,
    className: "px-2 py-1 rounded bg-white text-red-700 font-bold whitespace-nowrap"
  }, "Yedek indir"), React.createElement("button", {
    onClick: () => setStorageWarning(''),
    "aria-label": "Uyar\u0131y\u0131 kapat",
    className: "px-1 text-white/80 hover:text-white"
  }, "\u2715")), toast && React.createElement("div", {
    role: "status",
    className: "fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-2xl max-w-[90vw] " + (toast.startsWith('⚠') ? 'bg-red-600' : 'bg-emerald-600')
  }, toast.startsWith('⚠') ? toast : '✓ ' + toast), isUploadReadingOpen && React.createElement(UploadModal, {
    weeks: weeks,
    onClose: () => setIsUploadReadingOpen(false),
    onSave: saved => {
      const list = Array.isArray(saved) ? saved : [saved];
      setReadings([...list, ...readings]);
      setIsUploadReadingOpen(false);
      setSelectedReadingId(list.length === 1 ? list[0].id : null);
      setActiveTab('readings');
    }
  }), isUploadExamOpen && React.createElement(UploadExamModal, {
    onClose: () => setIsUploadExamOpen(false),
    onSave: newExam => {
      setCustomExams([newExam, ...customExams]);
      setIsUploadExamOpen(false);
      showToast(`"${newExam.title}" başarıyla eklendi (${newExam.questions.length} soru ayrıştırıldı).`);
    }
  }), isNewWeekOpen && React.createElement(WeekAddModal, {
    onClose: () => setIsNewWeekOpen(false),
    onSave: newWeek => {
      setWeeks([newWeek, ...weeks]);
      setIsNewWeekOpen(false);
    }
  }));
}
function DailyReviewSession({
  cards,
  onComplete,
  onRate,
  goal,
  doneToday
}) {
  const [queue] = useState(() => cards);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const touch = useRef(null);
  const card = queue[idx];
  const handleRating = rating => {
    if (!card) return;
    triggerHaptic(35);
    onRate(card.id, rating);
    setRevealed(false);
    setDragX(0);
    setDragY(0);
    if (idx + 1 < queue.length) setIdx(idx + 1);else onComplete();
  };
  useEffect(() => {
    const onKey = e => {
      if (/input|textarea|select/i.test(e.target && e.target.tagName || '')) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && /^[1-4]$/.test(e.key)) handleRating(+e.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const onTouchStart = e => {
    touch.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  };
  const onTouchMove = e => {
    if (touch.current != null) {
      const dx = e.touches[0].clientX - touch.current.x;
      const dy = e.touches[0].clientY - touch.current.y;
      setDragX(dx);
      setDragY(dy);
    }
  };
  const onTouchEnd = () => {
    if (!revealed) {
      if (dragY < -40 || Math.abs(dragX) > 40) setRevealed(true);
    } else {
      if (dragX > 70) {
        handleRating(3);
      } else if (dragX < -70) {
        handleRating(1);
      } else if (dragY < -60 && Math.abs(dragY) > Math.abs(dragX)) {
        handleRating(2);
      }
    }
    setDragX(0);
    setDragY(0);
    touch.current = null;
  };
  if (!card) return null;
  const preview = [1, 2, 3, 4].map(g => fsrsNext(card.srs, g).interval);
  const isUp = dragY < -40 && Math.abs(dragY) > Math.abs(dragX);
  const swipeHint = dragX > 40 ? 'İyi →' : dragX < -40 ? '← Tekrar' : isUp ? '↑ Zor' : '';
  const borderCls = dragX > 40 ? 'border-emerald-500 shadow-emerald-950/50' : dragX < -40 ? 'border-red-500 shadow-red-950/50' : isUp ? 'border-amber-500 shadow-amber-950/50' : 'border-slate-800';
  return React.createElement("div", {
    onTouchStart: onTouchStart,
    onTouchMove: onTouchMove,
    onTouchEnd: onTouchEnd,
    style: {
      transform: dragX || isUp && dragY ? `translate(${dragX}px, ${isUp ? dragY : 0}px) rotate(${dragX / 30}deg)` : undefined,
      transition: dragX || dragY ? 'none' : 'transform .2s ease-out'
    },
    className: "bg-slate-950 p-6 sm:p-8 rounded-3xl border shadow-2xl text-center space-y-6 " + borderCls
  }, React.createElement("div", {
    className: "flex items-center justify-between text-xs text-slate-400 font-bold"
  }, React.createElement("span", null, "Kart ", idx + 1, " / ", queue.length), goal > 0 && React.createElement("span", {
    className: doneToday >= goal ? 'text-emerald-400' : ''
  }, "\uD83C\uDFAF Bug\xFCn ", doneToday, "/", goal)), swipeHint && React.createElement("div", {
    className: "text-base font-black animate-pulse " + (dragX > 0 ? 'text-emerald-400' : dragX < 0 ? 'text-red-400' : 'text-amber-400')
  }, swipeHint), React.createElement("div", null, React.createElement("div", {
    className: "flex items-center justify-center gap-1.5"
  }, React.createElement("span", {
    className: "text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300"
  }, card.partOfSpeech), card.questionType && React.createElement("span", {
    className: "text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300"
  }, card.questionType.split(' ')[0])), React.createElement("h2", {
    className: "text-3xl font-black text-white mt-2"
  }, card.english), card.ipa && React.createElement("p", {
    className: "text-xs text-slate-400 font-mono mt-1"
  }, "/", card.ipa, "/"), card.okunus && React.createElement("p", {
    className: "text-xs text-amber-300 mt-0.5"
  }, "[", card.okunus, "]"), React.createElement("button", {
    onClick: () => playWord(card),
    className: "mt-2 text-xs text-blue-400"
  }, "\uD83D\uDD0A Dinle")), revealed ? React.createElement("div", {
    className: "space-y-4 pt-4 border-t border-slate-800"
  }, React.createElement("p", {
    className: "text-2xl font-bold text-blue-400"
  }, card.turkish), card.originalSentence && React.createElement("p", {
    className: "text-xs text-slate-300 font-serif italic"
  }, "\"", card.originalSentence, "\""), (card.examples || []).slice(0, 2).map((ex, i) => React.createElement("p", {
    key: i,
    className: "text-[11px] text-slate-400 font-serif"
  }, "\u2022 ", ex)), ((card.synonyms || []).length > 0 || (card.antonyms || []).length > 0) && React.createElement("div", {
    className: "text-[11px] space-y-0.5"
  }, (card.synonyms || []).length > 0 && React.createElement("p", null, React.createElement("span", {
    className: "text-slate-500"
  }, "E\u015F anlaml\u0131:"), " ", React.createElement("span", {
    className: "text-emerald-300"
  }, card.synonyms.slice(0, 5).join(', '))), (card.antonyms || []).length > 0 && React.createElement("p", null, React.createElement("span", {
    className: "text-slate-500"
  }, "Z\u0131t anlaml\u0131:"), " ", React.createElement("span", {
    className: "text-red-300"
  }, card.antonyms.slice(0, 4).join(', ')))), React.createElement("div", {
    className: "grid grid-cols-4 gap-2 pt-2"
  }, [[1, 'Tekrar', 'bg-red-950/60 border-red-800 text-red-300'], [2, 'Zor', 'bg-amber-950/60 border-amber-800 text-amber-300'], [3, 'İyi', 'bg-blue-950/60 border-blue-800 text-blue-300'], [4, 'Kolay', 'bg-emerald-950/60 border-emerald-800 text-emerald-300']].map(([g, label, cls]) => React.createElement("button", {
    key: g,
    onClick: () => handleRating(g),
    className: "p-2.5 rounded-xl border text-xs font-bold " + cls
  }, label, React.createElement("span", {
    className: "block text-[10px] font-normal opacity-80"
  }, g === 1 ? 'yarın' : formatInterval(preview[g - 1]))))), React.createElement("p", {
    className: "text-[10px] text-slate-400 mt-2"
  }, "\uD83D\uDCF1 Telefonda: ", React.createElement("b", null, "Sa\u011Fa"), " = \u0130yi, ", React.createElement("b", null, "Sola"), " = Tekrar, ", React.createElement("b", null, "Yukar\u0131"), " = Zor \xB7 \u2328 Klavye: 1-4")) : React.createElement("button", {
    onClick: () => setRevealed(true),
    className: "w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-lg"
  }, "Anlam\u0131n\u0131 G\xF6ster ", React.createElement("span", {
    className: "opacity-60 font-normal"
  }, "(bo\u015Fluk veya yukar\u0131 kayd\u0131r)")));
}
const AWL_SUBLISTS = ['analyse approach area assess assume authority available benefit concept consist constitute context contract create data define derive distribute economy environment establish estimate evident export factor finance formula function identify income indicate individual interpret involve issue labour legal legislate major method occur percent period policy principle proceed process require research respond role section sector significant similar source specific structure theory vary', 'achieve acquire administrate affect appropriate aspect assist category chapter commission community complex compute conclude conduct consequent construct consume credit culture design distinct element equate evaluate feature final focus impact injure institute invest item journal maintain normal obtain participate perceive positive potential previous primary purchase range region regulate relevant reside resource restrict secure seek select site strategy survey text tradition transfer', 'alternative circumstance comment compensate component consent considerable constant constrain contribute convene coordinate core corporate correspond criteria deduce demonstrate document dominate emphasis ensure exclude framework fund illustrate immigrate imply initial instance interact justify layer link locate maximise minor negate outcome partner philosophy physical proportion publish react register rely remove scheme sequence sex shift specify sufficient task technical technique technology valid volume', 'access adequate annual apparent approximate attitude attribute civil code commit communicate concentrate confer contrast cycle debate despite dimension domestic emerge error ethnic goal grant hence hypothesis implement implicate impose integrate internal investigate job label mechanism obvious occupy option output overall parallel parameter phase predict principal prior professional project promote regime resolve retain series statistic status stress subsequent sum summary undertake', 'academy adjust alter amend aware capacity challenge clause compound conflict consult contact decline discrete draft enable energy enforce entity equivalent evolve expand expose external facilitate fundamental generate generation image liberal licence logic margin medical mental modify monitor network notion objective orient perspective precise prime psychology pursue ratio reject revenue stable style substitute sustain symbol target transit trend version welfare whereas', 'abstract accurate acknowledge aggregate allocate assign attach author bond brief capable cite cooperate discriminate display diverse domain edit enhance estate exceed expert explicit federal fee flexible furthermore gender ignorant incentive incidence incorporate index inhibit initiate input instruct intelligence interval lecture migrate minimum ministry motive neutral nevertheless overseas precede presume rational recover reveal scope subsidy tape trace transform transport underlie utilise', 'adapt adult advocate aid channel chemical classic comprehensive comprise confirm contrary convert couple decade definite deny differentiate dispose dynamic eliminate empirical equip extract file finite foundation globe grade guarantee hierarchy identical ideology infer innovate insert intervene isolate media mode paradigm phenomenon priority prohibit publication quote release reverse simulate sole somewhat submit successor survive thesis topic transmit ultimate unique visible voluntary', 'abandon accompany accumulate ambiguous append appreciate arbitrary automate bias chart clarify commodity complement conform contemporary contradict crucial currency denote detect deviate displace drama eventual exhibit exploit fluctuate guideline highlight implicit induce inevitable infrastructure inspect intense manipulate minimise nuclear offset paragraph plus practitioner predominant prospect radical random reinforce restore revise schedule tension terminate theme thereby uniform vehicle via virtual visual widespread', 'accommodate analogy anticipate assure attain behalf bulk cease coherent coincide commence compatible concurrent confine controversy converse device devote diminish distort duration erode ethic format found inherent insight integral intermediate manual mature mediate medium military minimal mutual norm overlap passive portion preliminary protocol qualitative refine relax restrain revolution rigid route scenario sphere subordinate supplement suspend team temporary trigger unify violate vision', 'adjacent albeit assemble collapse colleague compile conceive convince depress encounter enormous forthcoming incline integrity intrinsic invoke levy likewise nonetheless notwithstanding odd ongoing panel persist pose reluctance so-called straightforward undergo whereby'].map(s => s.split(' '));
const AWL_INDEX = (() => {
  const exact = new Map(),
    stems = [];
  const amToBr = w => w.replace(/ize$/, 'ise').replace(/yze$/, 'yse').replace(/^labor/, 'labour').replace(/^license/, 'licence');
  AWL_SUBLISTS.forEach((words, i) => words.forEach(h => {
    exact.set(h, i + 1);
    if (h.length > 5) stems.push([h.slice(0, Math.max(5, h.length - 2)), i + 1]);
  }));
  return {
    exact,
    stems,
    amToBr
  };
})();
const AWL_FALSE = new Set(['found', 'founded', 'textile', 'texture', 'sexy', 'teammate']);
const awlSublist = word => {
  if (!word) return 0;
  let w = String(word).toLowerCase().trim();
  if (AWL_FALSE.has(w)) return 0;
  w = AWL_INDEX.amToBr(w);
  if (AWL_INDEX.exact.has(w)) return AWL_INDEX.exact.get(w);
  for (const base of [w.replace(/(s|es|ed|ing|ly)$/, ''), w.replace(/ies$/, 'y'), w.replace(/ied$/, 'y')]) if (AWL_INDEX.exact.has(base)) return AWL_INDEX.exact.get(base);
  for (const [stem, n] of AWL_INDEX.stems) if (w.startsWith(stem)) return n;
  return 0;
};
const AwlBadge = ({
  word
}) => {
  const n = awlSublist(word);
  return n ? React.createElement("span", {
    title: 'Akademik Kelime Listesi, alt liste ' + n + ' (1 = en sık)',
    className: "text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-950 text-purple-300"
  }, "AWL ", n) : null;
};
const isActiveDay = a => a && (a.reviews || 0) + (a.examQ || 0) > 0;
function computeStreak(activity) {
  const active = new Set(activity.filter(isActiveDay).map(a => a.id));
  let d = getTodayStr();
  if (!active.has(d)) d = addDays(d, -1);
  let n = 0;
  while (active.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
function bestStreak(activity) {
  const days = activity.filter(isActiveDay).map(a => a.id).sort();
  let best = 0,
    cur = 0,
    prev = null;
  days.forEach(d => {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  });
  return best;
}
const daysUntil = dateStr => dateStr ? Math.ceil((Date.parse(dateStr + 'T00:00:00') - Date.parse(getTodayStr() + 'T00:00:00')) / 86400000) : null;
function StatBox({
  label,
  value,
  sub,
  cls
}) {
  return React.createElement("div", {
    className: "bg-slate-950 p-4 rounded-2xl border border-slate-800"
  }, React.createElement("p", {
    className: "text-xs " + (cls || 'text-slate-400')
  }, label), React.createElement("p", {
    className: "text-2xl font-black mt-1 " + (cls || 'text-white')
  }, value), sub && React.createElement("p", {
    className: "text-[11px] text-slate-500 mt-0.5"
  }, sub));
}
function StatsSection({
  cards,
  activity,
  settings,
  setSettings
}) {
  const today = getTodayStr();
  const todayRec = activity.find(a => a.id === today) || {};
  const goal = settings.dailyGoal || 20;
  const streak = computeStreak(activity),
    best = bestStreak(activity);
  const left = daysUntil(settings.examDate);
  const days30 = Array.from({
    length: 30
  }, (_, i) => addDays(today, i - 29));
  const byDay = new Map(activity.map(a => [a.id, a]));
  const maxRev = Math.max(goal, ...days30.map(d => (byDay.get(d) || {}).reviews || 0), 1);
  const added30 = days30.map(d => cards.filter(c => (c.createdAt || '').slice(0, 10) === d).length);
  const states = {
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0
  };
  cards.forEach(c => {
    const s = c.srs && c.srs.state || 'new';
    states[s] = (states[s] || 0) + 1;
  });
  const stateMeta = [['new', 'Yeni', 'bg-slate-500'], ['learning', 'Öğreniliyor', 'bg-amber-500'], ['review', 'Tekrar', 'bg-blue-500'], ['mastered', 'Kalıcı', 'bg-emerald-500']];
  const forecast = Array.from({
    length: 7
  }, (_, i) => {
    const d = addDays(today, i);
    return {
      d,
      n: cards.filter(c => c.srs && (i === 0 ? c.srs.nextReviewAt <= d : c.srs.nextReviewAt === d)).length
    };
  });
  const maxF = Math.max(1, ...forecast.map(f => f.n));
  const exam = {};
  activity.forEach(a => Object.entries(a.examByType || {}).forEach(([t, [c, n]]) => {
    exam[t] = exam[t] || [0, 0];
    exam[t][0] += c;
    exam[t][1] += n;
  }));
  const totalRev = activity.reduce((s, a) => s + (a.reviews || 0), 0);
  const totalCorrect = activity.reduce((s, a) => s + (a.correct || 0), 0);
  const hardest = [...cards].filter(c => c.srs && ((c.srs.lapses || 0) > 0 || c.srs.difficulty > 6)).sort((a, b) => (b.srs.lapses || 0) - (a.srs.lapses || 0) || (b.srs.difficulty || 0) - (a.srs.difficulty || 0)).slice(0, 10);
  const dayLabel = d => new Date(d + 'T00:00:00').toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short'
  });
  return React.createElement("div", {
    className: "space-y-5"
  }, React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-4"
  }, React.createElement("div", {
    className: "bg-gradient-to-br from-indigo-700 to-blue-800 p-5 rounded-2xl text-white space-y-2"
  }, React.createElement("p", {
    className: "text-xs text-blue-100"
  }, "\uD83D\uDCC5 Y\xD6KD\u0130L s\u0131nav\u0131na"), React.createElement("p", {
    className: "text-3xl font-black"
  }, left == null ? '—' : left > 0 ? left + ' gün' : left === 0 ? 'Bugün!' : 'Geçti'), React.createElement("label", {
    className: "block text-[11px] text-blue-100"
  }, "S\u0131nav tarihi", React.createElement("input", {
    type: "date",
    value: settings.examDate || '',
    onChange: e => setSettings({
      ...settings,
      examDate: e.target.value
    }),
    className: "mt-1 w-full px-2 py-1 rounded-md bg-white/15 border border-white/20 text-white text-xs"
  })), left > 0 && cards.length > 0 && React.createElement("p", {
    className: "text-[11px] text-blue-100"
  }, "G\xFCnde ~", Math.ceil(Math.max(0, 600 - cards.length) / left), " yeni kelime ile s\u0131nava kadar 600 kelimeye ula\u015F\u0131rs\u0131n\u0131z.")), React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2"
  }, React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "\uD83C\uDFAF Bug\xFCnk\xFC hedef"), React.createElement("p", {
    className: "text-3xl font-black text-white"
  }, todayRec.reviews || 0, React.createElement("span", {
    className: "text-base text-slate-500"
  }, " / ", goal, " tekrar")), React.createElement("div", {
    className: "h-2 rounded bg-slate-800 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full " + ((todayRec.reviews || 0) >= goal ? 'bg-emerald-500' : 'bg-blue-500'),
    style: {
      width: Math.min(100, (todayRec.reviews || 0) / goal * 100) + '%'
    }
  })), React.createElement("label", {
    className: "flex items-center gap-2 text-[11px] text-slate-400"
  }, "G\xFCnl\xFCk hedef", React.createElement("input", {
    type: "number",
    min: "5",
    max: "300",
    step: "5",
    value: goal,
    onChange: e => setSettings({
      ...settings,
      dailyGoal: clampN(+e.target.value || 20, 5, 300)
    }),
    className: "w-16 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-white text-xs"
  }))), React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1"
  }, React.createElement("p", {
    className: "text-xs text-slate-400"
  }, "\uD83D\uDD25 \xC7al\u0131\u015Fma serisi"), React.createElement("p", {
    className: "text-3xl font-black text-orange-400"
  }, streak, " g\xFCn"), React.createElement("p", {
    className: "text-[11px] text-slate-500"
  }, "En uzun seri: ", best, " g\xFCn"), React.createElement("p", {
    className: "text-[11px] text-slate-500"
  }, isActiveDay(todayRec) ? 'Bugün çalıştınız ✓' : 'Seriyi korumak için bugün tekrar yapın.'))), React.createElement("div", {
    className: "grid grid-cols-2 md:grid-cols-4 gap-4"
  }, React.createElement(StatBox, {
    label: "Toplam kelime",
    value: cards.length,
    sub: added30.reduce((a, b) => a + b, 0) + ' tanesi son 30 günde'
  }), React.createElement(StatBox, {
    label: "Toplam tekrar",
    value: totalRev,
    sub: totalRev ? '%' + Math.round(totalCorrect / totalRev * 100) + ' doğru hatırlama' : '—',
    cls: "text-blue-400"
  }), React.createElement(StatBox, {
    label: "Kal\u0131c\u0131 haf\u0131zada",
    value: states.mastered,
    sub: "30+ g\xFCn aral\u0131kl\u0131",
    cls: "text-emerald-400"
  }), React.createElement(StatBox, {
    label: "\xC7\xF6z\xFClen soru",
    value: activity.reduce((s, a) => s + (a.examQ || 0), 0),
    sub: (() => {
      const q = activity.reduce((s, a) => s + (a.examQ || 0), 0),
        c = activity.reduce((s, a) => s + (a.examCorrect || 0), 0);
      return q ? '%' + Math.round(c / q * 100) + ' doğru' : 'Sınavlar sekmesinden';
    })(),
    cls: "text-purple-400"
  })), React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800"
  }, React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, React.createElement("h3", {
    className: "font-bold text-sm text-white"
  }, "Son 30 g\xFCn"), React.createElement("span", {
    className: "text-[10px] text-slate-500"
  }, React.createElement("span", {
    className: "inline-block w-2 h-2 bg-blue-500 rounded-sm mr-1"
  }), "tekrar ", React.createElement("span", {
    className: "inline-block w-2 h-2 bg-emerald-500 rounded-sm ml-2 mr-1"
  }), "yeni kelime \xB7 \xE7izgi: hedef")), React.createElement("div", {
    className: "relative h-32 flex items-end gap-[3px]"
  }, React.createElement("div", {
    className: "absolute left-0 right-0 border-t border-dashed border-slate-600",
    style: {
      bottom: goal / maxRev * 100 + '%'
    }
  }), days30.map((d, i) => {
    const r = (byDay.get(d) || {}).reviews || 0;
    return React.createElement("div", {
      key: d,
      className: "flex-1 flex flex-col justify-end h-full",
      title: dayLabel(d) + ': ' + r + ' tekrar, ' + added30[i] + ' yeni kelime'
    }, React.createElement("div", {
      className: "bg-emerald-500/80 rounded-t-sm",
      style: {
        height: Math.min(100, added30[i] / maxRev * 100) + '%'
      }
    }), React.createElement("div", {
      className: "rounded-t-sm " + (d === today ? 'bg-blue-400' : 'bg-blue-600'),
      style: {
        height: r / maxRev * 100 + '%'
      }
    }));
  })), React.createElement("div", {
    className: "flex justify-between text-[10px] text-slate-500 mt-1"
  }, React.createElement("span", null, dayLabel(days30[0])), React.createElement("span", null, "Bug\xFCn"))), React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3"
  }, React.createElement("h3", {
    className: "font-bold text-sm text-white"
  }, "Kartlar\u0131n durumu"), React.createElement("div", {
    className: "h-3 rounded-full overflow-hidden flex bg-slate-800"
  }, stateMeta.map(([k,, c]) => states[k] ? React.createElement("div", {
    key: k,
    className: c,
    style: {
      width: states[k] / Math.max(1, cards.length) * 100 + '%'
    }
  }) : null)), React.createElement("div", {
    className: "grid grid-cols-2 gap-1 text-xs"
  }, stateMeta.map(([k, label, c]) => React.createElement("p", {
    key: k,
    className: "text-slate-300"
  }, React.createElement("span", {
    className: "inline-block w-2 h-2 rounded-sm mr-1.5 " + c
  }), label, ": ", React.createElement("b", null, states[k] || 0))))), React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3"
  }, React.createElement("h3", {
    className: "font-bold text-sm text-white"
  }, "\xD6n\xFCm\xFCzdeki 7 g\xFCn\xFCn tekrar y\xFCk\xFC"), React.createElement("div", {
    className: "space-y-1"
  }, forecast.map((f, i) => React.createElement("div", {
    key: f.d,
    className: "flex items-center gap-2 text-[11px]"
  }, React.createElement("span", {
    className: "w-14 text-slate-400"
  }, i === 0 ? 'Bugün' : dayLabel(f.d)), React.createElement("div", {
    className: "flex-1 h-2 rounded bg-slate-800 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-blue-500",
    style: {
      width: f.n / maxF * 100 + '%'
    }
  })), React.createElement("span", {
    className: "w-6 text-right text-slate-300"
  }, f.n)))))), React.createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2"
  }, React.createElement("h3", {
    className: "font-bold text-sm text-white"
  }, "S\u0131nav ba\u015Far\u0131s\u0131 (soru t\xFCr\xFCne g\xF6re)"), Object.keys(exam).length === 0 ? React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "Hen\xFCz soru \xE7\xF6z\xFClmedi.") : Object.entries(exam).map(([t, [c, n]]) => React.createElement("div", {
    key: t,
    className: "text-[11px]"
  }, React.createElement("div", {
    className: "flex justify-between text-slate-300"
  }, React.createElement("span", null, t), React.createElement("span", null, c, "/", n, " \xB7 %", Math.round(c / n * 100))), React.createElement("div", {
    className: "h-1.5 rounded bg-slate-800 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full " + (c / n >= 0.7 ? 'bg-emerald-500' : c / n >= 0.5 ? 'bg-amber-500' : 'bg-red-500'),
    style: {
      width: c / n * 100 + '%'
    }
  }))))), React.createElement("div", {
    className: "bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2"
  }, React.createElement("h3", {
    className: "font-bold text-sm text-white"
  }, "En \xE7ok zorland\u0131\u011F\u0131n\u0131z kelimeler"), !hardest.length ? React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "Hen\xFCz yok.") : hardest.map(c => React.createElement("p", {
    key: c.id,
    className: "text-[11px] text-slate-300 flex justify-between gap-2"
  }, React.createElement("span", null, React.createElement("b", {
    className: "text-white"
  }, c.english), " \u2014 ", c.turkish), React.createElement("span", {
    className: "text-red-300 whitespace-nowrap"
  }, c.srs.lapses || 0, "\xD7 unutuldu"))))));
}
function DifficultSection({
  cards,
  onUnmark,
  onStudy
}) {
  const list = cards.filter(c => c.isDifficult || c.srs && c.srs.lapses >= 3);
  if (!list.length) {
    return React.createElement("div", {
      className: "text-center py-16 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400"
    }, "Zorland\u0131\u011F\u0131n\u0131z kelime yok. S\u0131navda yanl\u0131\u015F yapt\u0131\u011F\u0131n\u0131z veya tekrarda s\u0131k unuttu\u011Funuz kelimeler burada toplan\u0131r.");
  }
  return React.createElement("div", {
    className: "space-y-4"
  }, React.createElement("div", {
    className: "flex flex-wrap items-center gap-2"
  }, React.createElement("h3", {
    className: "font-bold text-lg text-white mr-auto"
  }, "Zorland\u0131\u011F\u0131m Kelimeler (", list.length, ")"), React.createElement("button", {
    onClick: () => onStudy(list.map(c => c.id)),
    className: "px-4 py-2 rounded-lg bg-amber-600 text-xs font-bold text-white hover:bg-amber-500"
  }, "Bunlar\u0131 \u015Fimdi tekrar et")), React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
  }, list.map(c => React.createElement("div", {
    key: c.id,
    className: "p-4 rounded-xl bg-slate-950 border border-amber-900/50 space-y-1"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("b", {
    className: "text-white"
  }, c.english), React.createElement("button", {
    onClick: () => playWord(c),
    "aria-label": c.english + ' dinle',
    className: "text-xs text-blue-400"
  }, "\uD83D\uDD0A"), React.createElement("span", {
    className: "ml-auto text-[10px] text-red-300"
  }, c.srs && c.srs.lapses || 0, "\xD7 unutuldu")), React.createElement("p", {
    className: "text-xs text-blue-300 font-semibold"
  }, c.turkish), c.originalSentence && React.createElement("p", {
    className: "text-[11px] text-slate-400 font-serif italic line-clamp-2"
  }, "\"", c.originalSentence, "\""), c.isDifficult && React.createElement("button", {
    onClick: () => onUnmark(c.id),
    className: "text-[10px] text-slate-500 hover:text-slate-300 underline"
  }, "Art\u0131k zorlanm\u0131yorum")))));
}
const shuffleArr = a => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const pickN = (a, n) => shuffleArr(a).slice(0, n);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plainText = t => String(t || '').replace(/^##\s+.*$/gm, '').replace(/\s+\n/g, '\n');
const splitSentences = t => (t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["”’)]?/g) || []).map(s => s.trim()).filter(s => s.split(' ').length >= 6 && s.split(' ').length <= 45);
const firstMeaning = c => String(c.turkish || '').split(/[,;]/)[0].trim();
const inflectLike = (word, suffix) => {
  const w = word.toLowerCase();
  if (!suffix) return w;
  if (/^(d|ed)$/.test(suffix)) return /e$/.test(w) ? w + 'd' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ied' : w + 'ed';
  if (/^(s|es|ies)$/.test(suffix)) return /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|z|ch|sh)$/.test(w) ? w + 'es' : w + 's';
  if (suffix === 'ing') return /[^e]e$/.test(w) ? w.slice(0, -1) + 'ing' : w + 'ing';
  return w + suffix;
};
const findForm = (sentence, lemma) => {
  const l = lemma.toLowerCase();
  const stems = [l, /e$/.test(l) ? l.slice(0, -1) : null, /y$/.test(l) ? l.slice(0, -1) : null].filter(Boolean);
  for (const st of stems) {
    const m = sentence.match(new RegExp('\\b(' + escRe(st) + '[a-z]{0,4})\\b', 'i'));
    if (m) {
      const form = m[1];
      if (!form.toLowerCase().startsWith(l) && !/^(d|ed|s|es|ies|ing|ied)$/.test(form.toLowerCase().slice(st.length))) continue;
      let suffix = form.toLowerCase().slice(l.length);
      if (!form.toLowerCase().startsWith(l)) suffix = form.toLowerCase().slice(st.length);
      if (suffix === 'ied') suffix = 'ed';
      return {
        form,
        suffix,
        index: m.index
      };
    }
  }
  return null;
};
const LINKERS = {
  'zıtlık': ['however', 'although', 'even though', 'whereas', 'nevertheless', 'nonetheless', 'despite', 'in spite of', 'on the other hand', 'in contrast', 'though'],
  'sebep-sonuç': ['therefore', 'thus', 'hence', 'consequently', 'as a result', 'because', 'because of', 'due to', 'since'],
  'ekleme': ['moreover', 'furthermore', 'in addition', 'besides', 'additionally'],
  'örnekleme': ['for example', 'for instance', 'such as'],
  'koşul': ['unless', 'provided that', 'as long as', 'in case'],
  'benzerlik': ['similarly', 'likewise'],
  'amaç': ['in order to', 'so that', 'so as to']
};
const LINKER_LIST = Object.entries(LINKERS).flatMap(([cat, ws]) => ws.map(w => ({
  w,
  cat
})));
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const makeQ = (type, prompt, options, correct, explain, extra) => {
  const opts = shuffleArr(options);
  return {
    type,
    prompt,
    options: opts,
    answer: opts.indexOf(correct),
    explain,
    ...(extra || {})
  };
};
function genVocabQuestions(cards, n) {
  const usable = cards.filter(c => c.originalSentence && !isMissingMeaning(c) && findForm(c.originalSentence, c.lemma || c.english));
  if (usable.length < 1 || cards.length < 5) return [];
  return pickN(usable, n).map(c => {
    const lemma = (c.lemma || c.english).toLowerCase();
    const f = findForm(c.originalSentence, lemma);
    const blanked = c.originalSentence.slice(0, f.index) + '----' + c.originalSentence.slice(f.index + f.form.length);
    const others = cards.filter(x => (x.lemma || x.english).toLowerCase() !== lemma && /^[a-z]+$/i.test(x.lemma || x.english));
    const samePos = others.filter(x => x.partOfSpeech === c.partOfSpeech);
    const pool = [...pickN(samePos, 4), ...pickN(others.filter(x => !samePos.includes(x)), 4)].slice(0, 4);
    if (pool.length < 4) return null;
    const correct = f.form.toLowerCase();
    const opts = [correct, ...pool.map(x => inflectLike(x.lemma || x.english, f.suffix))];
    if (new Set(opts).size < 5) return null;
    return makeQ('Kelime', blanked, opts, correct, '"' + lemma + '" = ' + c.turkish + '. Cümle: "' + c.originalSentence + '"', {
      cardIds: [c.id]
    });
  }).filter(Boolean);
}
function genLinkerQuestions(readings, n) {
  const found = [];
  readings.forEach(r => splitSentences(plainText(r.content)).forEach(s => {
    const hits = LINKER_LIST.filter(L => new RegExp('\\b' + escRe(L.w) + '\\b', 'i').test(s));
    const longest = hits.sort((a, b) => b.w.length - a.w.length)[0];
    if (!longest) return;
    const others = hits.filter(h => !longest.w.includes(h.w));
    if (others.length) return;
    found.push({
      s,
      L: longest,
      title: r.title
    });
  }));
  return pickN(found, n).map(({
    s,
    L
  }) => {
    const m = s.match(new RegExp('\\b' + escRe(L.w) + '\\b', 'i'));
    const atStart = m.index === 0;
    const cap = w => atStart ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    const blanked = s.slice(0, m.index) + '----' + s.slice(m.index + m[0].length);
    const otherCats = Object.keys(LINKERS).filter(c => c !== L.cat);
    const distract = pickN(otherCats, 4).map(cat => pickN(LINKERS[cat], 1)[0]);
    const correct = cap(L.w);
    return makeQ('Bağlaç', blanked, [correct, ...distract.map(cap)], correct, '"' + L.w + '" bir ' + L.cat + ' ifadesidir; cümlenin iki kısmı arasındaki ' + L.cat + ' ilişkisini kurar.');
  });
}
function genIrrelevantQuestions(readings, n) {
  const paras = [];
  readings.forEach(r => plainText(r.content).split(/\n\s*\n/).forEach(p => {
    const ss = splitSentences(p);
    if (ss.length >= 5) paras.push({
      ss,
      rid: r.id
    });
  }));
  const allSent = readings.map(r => ({
    rid: r.id,
    ss: splitSentences(plainText(r.content))
  }));
  const out = [];
  for (const p of pickN(paras, n * 2)) {
    const foreign = allSent.filter(x => x.rid !== p.rid && x.ss.length).flatMap(x => x.ss);
    if (!foreign.length) continue;
    const start = Math.floor(Math.random() * (p.ss.length - 4));
    const five = p.ss.slice(start, start + 5);
    const pos = 1 + Math.floor(Math.random() * 4);
    five[pos] = pickN(foreign, 1)[0];
    const text = five.map((s, i) => '(' + ['I', 'II', 'III', 'IV', 'V'][i] + ') ' + s).join(' ');
    const opts = ['I', 'II', 'III', 'IV', 'V'];
    out.push({
      type: 'Anlamı bozan cümle',
      prompt: 'Aşağıdaki parçada anlam bütünlüğünü bozan cümle hangisidir?\n\n' + text,
      options: opts,
      answer: pos,
      explain: '(' + opts[pos] + ') numaralı cümle başka bir metinden alındı; paragrafın konusuyla ilgisi yok.'
    });
    if (out.length >= n) break;
  }
  return out;
}
function genMeaningQuestions(cards, n) {
  const usable = cards.filter(c => !isMissingMeaning(c) && firstMeaning(c));
  if (usable.length < 5) return [];
  return pickN(usable, n).map(c => {
    const correct = firstMeaning(c);
    const others = [...new Set(usable.filter(x => x.id !== c.id).map(firstMeaning).filter(m => m && m !== correct))];
    if (others.length < 4) return null;
    return makeQ('Türkçe karşılık', '"' + (c.lemma || c.english) + '" kelimesinin Türkçe karşılığı hangisidir?', [correct, ...pickN(others, 4)], correct, (c.lemma || c.english) + ' = ' + c.turkish + (c.originalSentence ? '. Cümle: "' + c.originalSentence + '"' : ''), {
      cardIds: [c.id]
    });
  }).filter(Boolean);
}
function genSynonymQuestions(cards, n) {
  const usable = cards.filter(c => c.synonyms && c.synonyms.length > 0);
  if (usable.length < 2) return [];
  return pickN(usable, n).map(c => {
    const correct = c.synonyms[0];
    const otherCards = cards.filter(x => x.id !== c.id);
    const otherWords = [...otherCards.flatMap(x => x.synonyms || []), ...otherCards.map(x => x.lemma || x.english)].filter(w => w && w.toLowerCase() !== correct.toLowerCase() && !c.synonyms.map(s => s.toLowerCase()).includes(w.toLowerCase()));
    const uniqueOthers = [...new Set(otherWords)];
    if (uniqueOthers.length < 4) return null;
    const distractors = pickN(uniqueOthers, 4);
    return makeQ('Eş Anlamlı (Synonym)', '"' + (c.lemma || c.english) + '" kelimesinin en yakın eş anlamlısı (synonym) hangisidir?', [correct, ...distractors], correct, '"' + (c.lemma || c.english) + '" kelimesinin eş anlamlıları: ' + c.synonyms.join(', ') + '. Türkçe anlamı: ' + c.turkish, {
      cardIds: [c.id]
    });
  }).filter(Boolean);
}
const PREP_OPTIONS = ['to', 'of', 'from', 'in', 'on', 'with', 'for', 'at'];
const PREP_PAIRS = [['attribute', 'to', '-e bağlamak, -e atfetmek'], ['prone', 'to', '-e yatkın'], ['susceptible', 'to', '-e karşı savunmasız'], ['contribute', 'to', '-e katkıda bulunmak'], ['adhere', 'to', '-e bağlı kalmak, uymak'], ['resort', 'to', '-e başvurmak'], ['succumb', 'to', '-e yenik düşmek'], ['object', 'to', '-e itiraz etmek'], ['consent', 'to', '-e razı olmak'], ['equivalent', 'to', '-e eşdeğer'], ['similar', 'to', '-e benzer'], ['exposed', 'to', '-e maruz kalmış'], ['subject', 'to', '-e tabi'], ['confined', 'to', '-e sınırlı'], ['adapt', 'to', '-e uyum sağlamak'], ['respond', 'to', '-e yanıt vermek'], ['refer', 'to', '-e değinmek, atıfta bulunmak'], ['access', 'to', '-e erişim'], ['threat', 'to', '-e tehdit'], ['solution', 'to', '-e çözüm'], ['approach', 'to', '-e yaklaşım'], ['contribution', 'to', '-e katkı'], ['alternative', 'to', '-e alternatif'], ['vulnerable', 'to', '-e karşı savunmasız'], ['immune', 'to', '-e karşı bağışık'], ['detrimental', 'to', '-e zararlı'], ['conducive', 'to', '-e elverişli'], ['akin', 'to', '-e benzer'], ['stem', 'from', '-den kaynaklanmak'], ['derive', 'from', '-den türemek, elde etmek'], ['refrain', 'from', '-den kaçınmak'], ['abstain', 'from', '-den uzak durmak'], ['differ', 'from', '-den farklı olmak'], ['benefit', 'from', '-den yararlanmak'], ['suffer', 'from', '-den muzdarip olmak'], ['emerge', 'from', '-den ortaya çıkmak'], ['recover', 'from', '-den iyileşmek'], ['prevent', 'from', '-den alıkoymak'], ['exempt', 'from', '-den muaf'], ['distinguish', 'from', '-den ayırt etmek'], ['originate', 'from', '-den kaynaklanmak'], ['deviate', 'from', '-den sapmak'], ['withdraw', 'from', '-den çekilmek'], ['deprive', 'of', '-den yoksun bırakmak'], ['consist', 'of', '-den oluşmak'], ['dispose', 'of', '-den kurtulmak, elden çıkarmak'], ['accuse', 'of', '-le suçlamak'], ['approve', 'of', '-i onaylamak'], ['devoid', 'of', '-den yoksun'], ['indicative', 'of', '-in göstergesi'], ['characteristic', 'of', '-e özgü'], ['tolerant', 'of', '-e hoşgörülü'], ['conscious', 'of', '-in bilincinde'], ['aware', 'of', '-in farkında'], ['capable', 'of', '-e muktedir'], ['independent', 'of', '-den bağımsız'], ['regardless', 'of', '-e bakılmaksızın'], ['lack', 'of', '-in eksikliği'], ['representative', 'of', '-i temsil eden'], ['comprised', 'of', '-den oluşan'], ['reminiscent', 'of', '-i hatırlatan'], ['wary', 'of', '-e karşı temkinli'], ['invest', 'in', '-e yatırım yapmak'], ['participate', 'in', '-e katılmak'], ['specialize', 'in', '-de uzmanlaşmak'], ['persist', 'in', '-de ısrar etmek'], ['succeed', 'in', '-de başarılı olmak'], ['interested', 'in', '-e ilgili'], ['rich', 'in', '-ce zengin'], ['engage', 'in', '-e girişmek, -le uğraşmak'], ['belief', 'in', '-e inanç'], ['increase', 'in', '-de artış'], ['decline', 'in', '-de düşüş'], ['instrumental', 'in', '-de etkili, önemli rol oynayan'], ['implicated', 'in', '-e karışmış'], ['inherent', 'in', '-in doğasında olan'], ['rely', 'on', '-e güvenmek, dayanmak'], ['depend', 'on', '-e bağlı olmak'], ['insist', 'on', '-de ısrar etmek'], ['focus', 'on', '-e odaklanmak'], ['comment', 'on', '-e yorum yapmak'], ['emphasis', 'on', '-e vurgu'], ['impact', 'on', '-e etki'], ['reliance', 'on', '-e bağımlılık'], ['based', 'on', '-e dayalı'], ['dependent', 'on', '-e bağımlı'], ['embark', 'on', '-e başlamak, girişmek'], ['capitalize', 'on', '-den yararlanmak, fırsata çevirmek'], ['comply', 'with', '-e uymak'], ['cope', 'with', '-le başa çıkmak'], ['coincide', 'with', '-le çakışmak, aynı zamana denk gelmek'], ['interfere', 'with', '-e engel olmak, karışmak'], ['consistent', 'with', '-le tutarlı'], ['compatible', 'with', '-le uyumlu'], ['associated', 'with', '-le ilişkili'], ['equipped', 'with', '-le donatılmış'], ['preoccupied', 'with', '-le meşgul, kafayı takmış'], ['interact', 'with', '-le etkileşimde bulunmak'], ['collaborate', 'with', '-le iş birliği yapmak'], ['correlate', 'with', '-le ilişkili olmak'], ['deal', 'with', '-le ilgilenmek, ele almak'], ['faced', 'with', '-le karşı karşıya'], ['fraught', 'with', '-le dolu'], ['grapple', 'with', '-le boğuşmak'], ['account', 'for', '-i açıklamak; oluşturmak'], ['compensate', 'for', '-i telafi etmek'], ['substitute', 'for', '-in yerine geçmek'], ['responsible', 'for', '-den sorumlu'], ['demand', 'for', '-e talep'], ['need', 'for', '-e ihtiyaç'], ['reason', 'for', '-in sebebi'], ['preference', 'for', '-i tercih'], ['eligible', 'for', '-e uygun, hak sahibi'], ['notorious', 'for', '-le kötü şöhretli'], ['renowned', 'for', '-le ünlü'], ['strive', 'for', '-için çabalamak'], ['marvel', 'at', '-e hayret etmek'], ['adept', 'at', '-de usta'], ['glance', 'at', '-e göz atmak']].map(([w, p, tr]) => ({
  w,
  p,
  tr
}));
function PrepositionGame({
  readings,
  onAnswer,
  best,
  onBest
}) {
  const [state, setState] = useState('idle');
  const [tab, setTab] = useState('game');
  const [selectedPrep, setSelectedPrep] = useState('to');
  const [left, setLeft] = useState(60);
  const [item, setItem] = useState(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [combo, setCombo] = useState(0);
  const [wrong, setWrong] = useState([]);
  const [flash, setFlash] = useState(null);
  const deck = useRef([]);
  const contexts = useRef(null);
  const findContext = it => {
    if (!contexts.current) contexts.current = readings.flatMap(r => splitSentences(plainText(r.content)));
    const re = new RegExp('\\b(' + escRe(it.w) + '[a-z]{0,3})\\s+' + it.p + '\\b', 'i');
    const s = contexts.current.find(x => re.test(x));
    if (!s) return null;
    const m = s.match(re);
    return {
      before: s.slice(0, m.index + m[1].length),
      after: s.slice(m.index + m[0].length)
    };
  };
  const next = () => {
    if (!deck.current.length) deck.current = shuffleArr(PREP_PAIRS);
    const it = deck.current.pop();
    setItem({
      ...it,
      ctx: findContext(it)
    });
  };
  const start = () => {
    setScore(0);
    setAnswered(0);
    setCombo(0);
    setWrong([]);
    setLeft(60);
    deck.current = shuffleArr(PREP_PAIRS);
    setState('playing');
    next();
  };
  useEffect(() => {
    if (state !== 'playing') return;
    if (left <= 0) {
      setState('done');
      if (score > (best || 0)) onBest(score);
      return;
    }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [state, left]);
  const pick = p => {
    if (state !== 'playing' || !item) return;
    const ok = p === item.p;
    setAnswered(a => a + 1);
    if (ok) {
      setScore(s => s + 1);
      setCombo(c => c + 1);
    } else {
      setCombo(0);
      setWrong(w => [...w, {
        ...item,
        picked: p
      }]);
    }
    onAnswer(ok);
    setFlash(ok ? 'ok' : 'bad');
    setTimeout(() => setFlash(null), 250);
    next();
  };
  useEffect(() => {
    const onKey = e => {
      if (state === 'playing' && /^[1-8]$/.test(e.key)) pick(PREP_OPTIONS[+e.key - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (state === 'idle' || state === 'done') {
    const prepItems = PREP_PAIRS.filter(x => x.p === selectedPrep);
    return React.createElement("div", {
      className: "max-w-2xl mx-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4"
    }, React.createElement("div", {
      className: "flex items-center justify-between border-b border-slate-800 pb-3"
    }, React.createElement("h3", {
      className: "font-bold text-lg text-white"
    }, "\uD83C\uDFAF Y\xD6KD\u0130L Preposition Matrix & \xC7ark\u0131"), React.createElement("div", {
      className: "flex gap-1.5"
    }, React.createElement("button", {
      onClick: () => setTab('game'),
      className: "px-3 py-1 rounded-lg text-xs font-bold transition " + (tab === 'game' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')
    }, "\u26A1 H\u0131zl\u0131 \xC7ark (60 sn)"), React.createElement("button", {
      onClick: () => setTab('matrix'),
      className: "px-3 py-1 rounded-lg text-xs font-bold transition " + (tab === 'matrix' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')
    }, "\uD83D\uDCCA Preposition Matrix"))), tab === 'matrix' ? React.createElement("div", {
      className: "space-y-4"
    }, React.createElement("p", {
      className: "text-xs text-slate-400"
    }, "Y\xD6KD\u0130L s\u0131nav\u0131nda en \xE7ok sorulan sabit edatl\u0131 yap\u0131lar\u0131 kategori baz\u0131nda inceleyin ve peki\u015Ftirin:"), React.createElement("div", {
      className: "flex flex-wrap gap-1.5"
    }, PREP_OPTIONS.map(p => React.createElement("button", {
      key: p,
      onClick: () => setSelectedPrep(p),
      className: "px-3 py-1.5 rounded-lg text-xs font-bold transition " + (selectedPrep === p ? 'bg-indigo-600 text-white shadow' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800')
    }, p, " (", PREP_PAIRS.filter(x => x.p === p).length, ")"))), React.createElement("div", {
      className: "grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1"
    }, prepItems.map((it, i) => React.createElement("div", {
      key: i,
      className: "p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2"
    }, React.createElement("div", null, React.createElement("span", {
      className: "text-sm font-black text-white"
    }, it.w, " ", React.createElement("span", {
      className: "text-indigo-400 font-bold"
    }, it.p)), React.createElement("p", {
      className: "text-[11px] text-slate-400 mt-0.5"
    }, it.tr)), React.createElement("button", {
      onClick: () => playWord({
        english: it.w + ' ' + it.p
      }),
      className: "text-xs text-blue-400 hover:text-blue-300 px-1.5 py-1 rounded bg-slate-800"
    }, "\uD83D\uDD0A")))), React.createElement("button", {
      onClick: () => {
        setTab('game');
        start();
      },
      className: "w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500"
    }, "\u015Eimdi \xC7ark\u0131 Ba\u015Flat (Pratik Yap) \u2192")) : React.createElement("div", {
      className: "space-y-4"
    }, React.createElement("p", {
      className: "text-xs text-slate-400"
    }, "Y\xD6KD\u0130L kelime sorular\u0131n\u0131n \xF6nemli k\u0131sm\u0131 edatl\u0131 kal\u0131plardan gelir (attribute ", React.createElement("b", null, "to"), ", stem ", React.createElement("b", null, "from"), ", deprive ", React.createElement("b", null, "of"), "\u2026). Kal\u0131b\u0131 g\xF6r, do\u011Fru edat\u0131 olabildi\u011Fince h\u0131zl\u0131 se\xE7. Kal\u0131p metinlerinizde ge\xE7iyorsa orijinal c\xFCmleyle sorulur."), state === 'done' && React.createElement("div", {
      className: "p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
    }, React.createElement("p", {
      className: "text-2xl font-black text-white"
    }, score, " do\u011Fru ", React.createElement("span", {
      className: "text-sm text-slate-400"
    }, "/ ", answered, " cevap \xB7 en iyi: ", Math.max(best || 0, score))), wrong.length > 0 && React.createElement("div", {
      className: "space-y-1 max-h-48 overflow-y-auto"
    }, React.createElement("p", {
      className: "text-[11px] text-slate-500"
    }, "Yanl\u0131\u015Flar\u0131n\u0131z:"), wrong.map((x, i) => React.createElement("p", {
      key: i,
      className: "text-xs text-slate-300"
    }, React.createElement("b", {
      className: "text-white"
    }, x.w, " ", React.createElement("span", {
      className: "text-emerald-400"
    }, x.p)), " = ", x.tr, " ", React.createElement("span", {
      className: "text-red-400 line-through ml-1"
    }, x.picked))))), React.createElement("button", {
      onClick: start,
      className: "w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500"
    }, state === 'done' ? 'Tekrar oyna' : 'Başla')));
  }
  return React.createElement("div", {
    className: "max-w-2xl mx-auto space-y-3"
  }, React.createElement("div", {
    className: "flex items-center justify-between text-xs"
  }, React.createElement("span", {
    className: "font-black text-lg " + (left <= 10 ? 'text-red-400' : 'text-white')
  }, "\u23F1 ", left), React.createElement("span", {
    className: "text-slate-300"
  }, "Do\u011Fru: ", React.createElement("b", {
    className: "text-emerald-400"
  }, score), " ", combo >= 3 && React.createElement("span", {
    className: "text-orange-400 font-bold ml-1"
  }, "\uD83D\uDD25 x", combo))), React.createElement("div", {
    className: "h-1.5 rounded bg-slate-800 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-blue-500 transition-all",
    style: {
      width: left / 60 * 100 + '%'
    }
  })), React.createElement("div", {
    className: "p-6 rounded-2xl border text-center transition-colors " + (flash === 'ok' ? 'border-emerald-500 bg-emerald-950/30' : flash === 'bad' ? 'border-red-500 bg-red-950/30' : 'border-slate-800 bg-slate-950')
  }, item && (item.ctx ? React.createElement("p", {
    className: "text-base text-slate-100 font-serif leading-relaxed"
  }, item.ctx.before, " ", React.createElement("span", {
    className: "inline-block min-w-[3rem] border-b-2 border-blue-400 text-blue-300"
  }, "\xA0?\xA0"), " ", item.ctx.after) : React.createElement("p", {
    className: "text-3xl font-black text-white"
  }, item.w, " ", React.createElement("span", {
    className: "inline-block min-w-[3.5rem] border-b-4 border-blue-400 text-blue-300"
  }, "?"))), item && item.ctx && React.createElement("p", {
    className: "text-[10px] text-slate-500 mt-2"
  }, "Kal\u0131p: ", React.createElement("b", {
    className: "text-slate-300"
  }, item.w, " ___"), " \xB7 sizin metninizden")), React.createElement("div", {
    className: "grid grid-cols-4 gap-2"
  }, PREP_OPTIONS.map((p, i) => React.createElement("button", {
    key: p,
    onClick: () => pick(p),
    className: "py-3 rounded-xl bg-slate-800 hover:bg-blue-600 text-white font-bold text-sm"
  }, p, React.createElement("span", {
    className: "block text-[9px] font-normal text-slate-400"
  }, i + 1)))), React.createElement("button", {
    onClick: () => setLeft(0),
    className: "text-xs text-slate-500 hover:text-slate-300"
  }, "Bitir"));
}
const CLUE_WORDS = (() => {
  const m = new Map();
  LINKER_LIST.forEach(L => m.set(L.w, L.cat));
  [['while', 'zıtlık'], ['but', 'zıtlık'], ['yet', 'zıtlık'], ['unlike', 'zıtlık'], ['rather than', 'zıtlık'], ['instead of', 'zıtlık'], ['so', 'sebep-sonuç'], ['thereby', 'sebep-sonuç'], ['accordingly', 'sebep-sonuç'], ['as well as', 'ekleme'], ['also', 'ekleme']].forEach(([w, c]) => {
    if (!m.has(w)) m.set(w, c);
  });
  return [...m.entries()].sort((a, b) => b[0].length - a[0].length);
})();
const CLUE_HINT = {
  'zıtlık': 'zıtlık bildirir → boşluğa gelen kelime, cümlenin öbür yarısıyla ZIT anlamlı olmalı',
  'sebep-sonuç': 'sebep-sonuç bildirir → boşluk, öbür yarının SONUCU ya da SEBEBİ olacak anlamda olmalı',
  'ekleme': 'ekleme bildirir → boşluk, önceki fikirle AYNI yönde olmalı',
  'benzerlik': 'benzerlik bildirir → boşluk, önceki fikre BENZER olmalı',
  'örnekleme': 'örnek verir → boşluk, verilen örnekleri KAPSAYAN genel bir kavram olmalı',
  'koşul': 'koşul bildirir → boşluk, koşul gerçekleşince/gerçekleşmeyince olacak durumu anlatır',
  'amaç': 'amaç bildirir → boşluk, ulaşılmak istenen hedefi anlatır'
};
function renderWithClues(text) {
  const found = [];
  const re = new RegExp('\\b(' + CLUE_WORDS.map(([w]) => escRe(w)).join('|') + ')\\b', 'gi');
  const parts = [];
  let last = 0,
    m;
  while (m = re.exec(text)) {
    parts.push(text.slice(last, m.index));
    const w = m[0].toLowerCase(),
      cat = (CLUE_WORDS.find(([x]) => x === w) || [])[1];
    if (cat && !found.some(f => f.w === w)) found.push({
      w,
      cat
    });
    parts.push(React.createElement("b", {
      key: m.index,
      className: "text-orange-300 bg-orange-500/10 rounded px-0.5"
    }, m[0]));
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return {
    nodes: parts,
    clues: found
  };
}
function ExamSection({
  cards,
  readings,
  customExams = [],
  onOpenUploadExam,
  onDeleteExam,
  onExtractVocabFromExam,
  onMarkDifficult,
  onAnswer,
  prepBest,
  onPrepBest,
  preset,
  onPresetUsed,
  onCheckupDone
}) {
  const [examTab, setExamTab] = useState('generator');
  const [mode, setMode] = useState('mixed');
  const [count, setCount] = useState(10);
  const [qs, setQs] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState({});
  const [marked, setMarked] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [timed, setTimed] = useState(null);
  const [now, setNow] = useState(Date.now());
  const reported = useRef(false);
  const build = opts => {
    const m = opts && opts.mode || mode,
      n = opts && opts.count || count;
    if (m === 'prep') {
      setPrepOpen(true);
      return;
    }
    const per = m === 'mixed' ? Math.ceil(n / 4) + 1 : n;
    let list = [];
    if (m === 'mixed' || m === 'vocab') list = list.concat(genVocabQuestions(cards, per));
    if (m === 'mixed' || m === 'linker') list = list.concat(genLinkerQuestions(readings, per));
    if (m === 'mixed' || m === 'irrelevant') list = list.concat(genIrrelevantQuestions(readings, m === 'mixed' ? Math.max(1, Math.floor(per / 2)) : per));
    if (m === 'mixed' || m === 'meaning') list = list.concat(genMeaningQuestions(cards, per));
    if (m === 'mixed' || m === 'synonym') list = list.concat(genSynonymQuestions(cards, per));
    list = m === 'mixed' ? shuffleArr(list).slice(0, n) : list.slice(0, n);
    setQs(list);
    setIdx(0);
    setPicked({});
    setMarked(false);
    reported.current = false;
    setTimed(opts && opts.seconds && list.length ? {
      endAt: Date.now() + opts.seconds * 1000,
      total: opts.seconds
    } : null);
  };
  const startCustomExam = (ex, filter = 'all') => {
    let qsList = ex.questions || [];
    if (filter === 'vocab') qsList = ex.questions.filter(q => q.num <= 6 || q.category.includes('Kelime'));else if (filter === 'grammar') qsList = ex.questions.filter(q => q.num >= 7 && q.num <= 16 || q.category.includes('Gramer'));else if (filter === 'cloze') qsList = ex.questions.filter(q => q.num >= 17 && q.num <= 26 || q.category.includes('Cloze'));else if (filter === 'sentence') qsList = ex.questions.filter(q => q.num >= 27 && q.num <= 36 || q.category.includes('Cümle Tamamlama'));else if (filter === 'translation') qsList = ex.questions.filter(q => q.num >= 37 && q.num <= 48 || q.category.includes('Çeviri'));else if (filter === 'paragraph') qsList = ex.questions.filter(q => q.num >= 49 || q.category.includes('Paragraf'));
    if (!qsList.length) {
      alert('Bu kategoride soru bulunamadı.');
      return;
    }
    const formatted = qsList.map(q => ({
      type: q.category,
      prompt: `[${ex.title} • Soru ${q.num}]\n\n${q.prompt}`,
      options: q.options,
      answer: q.answer >= 0 ? q.answer : 0,
      hasAnswer: q.answer >= 0,
      explain: q.answer >= 0 ? `Doğru Cevap: ${LETTERS[q.answer]}` : 'Bu sorunun cevap anahtarı belirtilmemiş.',
      cardIds: []
    }));
    setQs(formatted);
    setIdx(0);
    setPicked({});
    setMarked(false);
    reported.current = false;
    const totalSec = filter === 'all' ? 180 * 60 : qsList.length * 90;
    setTimed({
      endAt: Date.now() + totalSec * 1000,
      total: totalSec
    });
  };
  useEffect(() => {
    if (preset && preset.weekly) {
      setPrepOpen(false);
      build({
        mode: 'mixed',
        count: 20,
        seconds: 15 * 60
      });
      onPresetUsed && onPresetUsed();
    }
  }, [preset]);
  useEffect(() => {
    if (!timed || !qs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timed, qs]);
  const remaining = timed ? Math.max(0, Math.round((timed.endAt - now) / 1000)) : null;
  useEffect(() => {
    if (timed && qs && remaining === 0 && idx < qs.length) {
      const filled = {
        ...picked
      };
      qs.forEach((_, i) => {
        if (filled[i] === undefined) filled[i] = -1;
      });
      setPicked(filled);
      setIdx(qs.length);
    }
  }, [remaining]);
  if (prepOpen) {
    return React.createElement("div", {
      className: "space-y-3"
    }, React.createElement("button", {
      onClick: () => setPrepOpen(false),
      className: "text-xs text-slate-400 hover:text-blue-400 font-bold"
    }, "\u2190 S\u0131nav t\xFCrleri"), React.createElement(PrepositionGame, {
      readings: readings,
      best: prepBest,
      onBest: onPrepBest,
      onAnswer: ok => onAnswer && onAnswer('Edat', ok)
    }));
  }
  const needs = [];
  if (cards.length < 5) needs.push('en az 5 kelime kartı (şu an ' + cards.length + ')');
  if (!readings.length) needs.push('en az 1 okuma metni');
  if (!qs) {
    return React.createElement("div", {
      className: "max-w-2xl mx-auto space-y-4"
    }, React.createElement("div", {
      className: "flex flex-wrap items-center justify-between gap-2"
    }, React.createElement("div", {
      className: "flex gap-2"
    }, React.createElement("button", {
      type: "button",
      onClick: () => setExamTab('generator'),
      className: "px-3.5 py-1.5 rounded-xl text-xs font-bold transition " + (examTab === 'generator' ? 'bg-blue-600 text-white shadow' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800')
    }, "\uD83E\uDD16 \xD6zg\xFCn Soru \xDCretici"), React.createElement("button", {
      type: "button",
      onClick: () => setExamTab('uploaded'),
      className: "px-3.5 py-1.5 rounded-xl text-xs font-bold transition " + (examTab === 'uploaded' ? 'bg-blue-600 text-white shadow' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800')
    }, "\uD83D\uDCC4 \xC7\u0131km\u0131\u015F S\u0131navlar\u0131m & Denemeler (", customExams.length, ")")), React.createElement("button", {
      type: "button",
      onClick: onOpenUploadExam,
      className: "px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
    }, React.createElement("span", null, "+ \xC7\u0131km\u0131\u015F S\u0131nav / Deneme PDF'i Y\xFCkle"))), examTab === 'uploaded' ? customExams.length === 0 ? React.createElement("div", {
      className: "bg-slate-950 p-8 rounded-2xl border border-dashed border-slate-800 text-center space-y-3"
    }, React.createElement("div", {
      className: "text-3xl"
    }, "\uD83D\uDCC4"), React.createElement("h4", {
      className: "font-bold text-base text-white"
    }, "Hen\xFCz Bir S\u0131nav PDF'i Y\xFCklemediniz"), React.createElement("p", {
      className: "text-xs text-slate-400 max-w-md mx-auto"
    }, "Ge\xE7mi\u015F y\u0131llar\u0131n Y\xD6KD\u0130L kitap\xE7\u0131klar\u0131n\u0131 (PDF veya Word) y\xFCkleyin. Sistem sorular\u0131, \u015F\u0131klar\u0131 ve Y\xD6KD\u0130L soru tiplerini otomatik olarak ayr\u0131\u015Ft\u0131rarak s\u0131nav sim\xFClasyonu haz\u0131rlar."), React.createElement("button", {
      type: "button",
      onClick: onOpenUploadExam,
      className: "px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
    }, "+ \u0130lk S\u0131nav PDF'inizi Y\xFCkleyin")) : React.createElement("div", {
      className: "space-y-3"
    }, customExams.map(ex => {
      const qCount = ex.questions.length;
      const vocabCount = ex.questions.filter(q => q.num <= 6 || q.category.includes('Kelime')).length;
      return React.createElement("div", {
        key: ex.id,
        className: "p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition"
      }, React.createElement("div", {
        className: "flex flex-wrap items-center justify-between gap-2"
      }, React.createElement("div", null, React.createElement("div", {
        className: "flex items-center gap-2"
      }, React.createElement("span", {
        className: "text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300"
      }, ex.field, " \u2022 ", ex.year, " ", ex.term), React.createElement("span", {
        className: "text-[10px] text-slate-400"
      }, qCount, " soru")), React.createElement("h4", {
        className: "font-black text-base text-white mt-1"
      }, ex.title)), React.createElement("div", {
        className: "flex items-center gap-1.5"
      }, vocabCount > 0 && onExtractVocabFromExam && React.createElement("button", {
        type: "button",
        onClick: () => onExtractVocabFromExam(ex),
        className: "px-2.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 text-xs font-bold transition flex items-center gap-1",
        title: "S\u0131navdaki hedef kelimeleri kelime bankan\u0131za aktar\u0131r"
      }, "\u2728 Kelimeleri Bankaya Ekle"), onDeleteExam && React.createElement("button", {
        type: "button",
        onClick: () => onDeleteExam(ex.id),
        className: "px-2.5 py-1.5 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 hover:bg-red-900 text-xs transition",
        title: "S\u0131nav\u0131 Sil"
      }, "\uD83D\uDDD1"))), React.createElement("div", {
        className: "flex flex-wrap gap-1.5 pt-1"
      }, React.createElement("button", {
        type: "button",
        onClick: () => startCustomExam(ex, 'all'),
        className: "px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
      }, "\u25B6 T\xFCm S\u0131nav\u0131 \xC7\xF6z (", qCount, " Soru \xB7 180 dk)"), React.createElement("button", {
        type: "button",
        onClick: () => startCustomExam(ex, 'vocab'),
        disabled: vocabCount === 0,
        className: "px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-200 disabled:opacity-40"
      }, "Soru 1-6 (Kelime)"), React.createElement("button", {
        type: "button",
        onClick: () => startCustomExam(ex, 'grammar'),
        className: "px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-200"
      }, "Soru 7-16 (Gramer & Edat)"), React.createElement("button", {
        type: "button",
        onClick: () => startCustomExam(ex, 'cloze'),
        className: "px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-200"
      }, "Soru 17-26 (Cloze Test)"), React.createElement("button", {
        type: "button",
        onClick: () => startCustomExam(ex, 'sentence'),
        className: "px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-bold text-slate-200"
      }, "Soru 27-36 (C\xFCmle Tamamlama)")));
    })) : React.createElement("div", {
      className: "bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4"
    }, React.createElement("h3", {
      className: "font-bold text-lg text-white"
    }, "\uD83C\uDF93 Y\xD6KD\u0130L Tarz\u0131 \xD6zg\xFCn Soru \xDCretici"), React.createElement("p", {
      className: "text-xs text-slate-400"
    }, "Sorular sizin okuma metinlerinizden ve kelime kartlar\u0131n\u0131zdan otomatik \xFCretilir. Her soruda 5 \u015F\u0131k vard\u0131r; cevab\u0131n\u0131zdan sonra a\xE7\u0131klama g\xF6sterilir."), React.createElement("div", {
      className: "grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"
    }, [['mixed', 'Karışık (önerilen)'], ['vocab', 'Kelime – boşluk doldurma'], ['synonym', '🎯 Eş Anlamlılar (Synonyms)'], ['linker', 'Bağlaç / geçiş ifadeleri'], ['irrelevant', 'Anlamı bozan cümle'], ['meaning', 'Türkçe karşılık'], ['prep', '🎯 Preposition Matrix & Çark']].map(([k, label]) => React.createElement("label", {
      key: k,
      className: "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer " + (mode === k ? 'border-blue-600 bg-blue-600/10 text-white' : 'border-slate-800 text-slate-300')
    }, React.createElement("input", {
      type: "radio",
      name: "examMode",
      checked: mode === k,
      onChange: () => setMode(k),
      className: "accent-blue-500"
    }), " ", label))), React.createElement("div", {
      className: "flex items-center gap-2 text-xs"
    }, React.createElement("span", {
      className: "text-slate-400"
    }, "Soru say\u0131s\u0131"), [10, 20, 40].map(n => React.createElement("button", {
      key: n,
      onClick: () => setCount(n),
      className: "px-3 py-1.5 rounded-lg font-bold " + (count === n ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')
    }, n))), needs.length > 0 && mode !== 'prep' && React.createElement("p", {
      className: "text-[11px] text-amber-400"
    }, "Daha \xE7ok soru i\xE7in: ", needs.join(', '), ". Ba\u011Fla\xE7 ve anlam\u0131 bozan c\xFCmle sorular\u0131 okuma metinlerinden \xFCretilir (ikincisi i\xE7in en az 2 metin gerekir)."), React.createElement("button", {
      onClick: () => build(),
      className: "w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500"
    }, mode === 'prep' ? 'Oyunu Aç' : 'Sınavı Başlat'), React.createElement("button", {
      onClick: () => build({
        mode: 'mixed',
        count: 20,
        seconds: 15 * 60
      }),
      className: "w-full py-2.5 rounded-xl bg-indigo-700 text-white font-bold text-xs hover:bg-indigo-600"
    }, "\u23F1 Haftal\u0131k Check-up: 20 soru \xB7 15 dakika", new Date().getDay() === 0 ? ' — bugün check-up günü!' : '')));
  }
  if (!qs.length) {
    return React.createElement("div", {
      className: "max-w-2xl mx-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3 text-center"
    }, React.createElement("p", {
      className: "text-sm text-slate-300"
    }, "Bu t\xFCrde soru \xFCretilecek kadar veri yok."), React.createElement("p", {
      className: "text-xs text-slate-500"
    }, "Okuma metni y\xFCkleyip \"\u2728 Kelimeleri \xC7\u0131kar\" ile kelime ekleyin; sonra tekrar deneyin."), React.createElement("button", {
      onClick: () => setQs(null),
      className: "px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200"
    }, "Geri"));
  }
  const answered = Object.keys(picked).length;
  const correctN = qs.filter((q, i) => picked[i] === q.answer).length;
  const done = answered === qs.length && idx >= qs.length;
  if (done) {
    const wrongCardIds = [...new Set(qs.flatMap((q, i) => picked[i] !== q.answer ? q.cardIds || [] : []))];
    const byType = {};
    qs.forEach((q, i) => {
      byType[q.type] = byType[q.type] || [0, 0];
      byType[q.type][1]++;
      if (picked[i] === q.answer) byType[q.type][0]++;
    });
    if (timed && !reported.current) {
      reported.current = true;
      setTimeout(() => onCheckupDone && onCheckupDone(correctN, qs.length), 0);
    }
    const usedSec = timed ? Math.min(timed.total, timed.total - Math.max(0, Math.round((timed.endAt - Date.now()) / 1000))) : 0;
    return React.createElement("div", {
      className: "max-w-2xl mx-auto bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4"
    }, timed && React.createElement("p", {
      className: "text-xs font-bold text-indigo-300"
    }, "\u23F1 Haftal\u0131k Check-up \xB7 s\xFCre: ", Math.floor(usedSec / 60), " dk ", usedSec % 60, " sn", qs.some((_, i) => picked[i] === -1) ? ' · süre doldu, boş bırakılanlar yanlış sayıldı' : ''), React.createElement("h3", {
      className: "font-bold text-lg text-white"
    }, "Sonu\xE7: ", correctN, " / ", qs.length, " ", React.createElement("span", {
      className: "text-slate-400 text-sm"
    }, "(%", Math.round(correctN / qs.length * 100), ")")), timed && React.createElement("div", {
      className: "space-y-2 max-h-[45vh] overflow-y-auto pr-1"
    }, qs.map((q, i) => picked[i] === q.answer ? null : React.createElement("div", {
      key: i,
      className: "p-3 rounded-xl bg-red-950/30 border border-red-900/50 text-xs space-y-1"
    }, React.createElement("p", {
      className: "text-slate-400"
    }, i + 1, ". ", q.type), React.createElement("p", {
      className: "text-slate-200 font-serif whitespace-pre-wrap line-clamp-4"
    }, q.prompt), React.createElement("p", {
      className: "text-emerald-300"
    }, "Do\u011Fru: ", LETTERS[q.answer], ") ", q.options[q.answer], picked[i] >= 0 ? React.createElement("span", {
      className: "text-red-300 ml-2"
    }, "Sizin: ", LETTERS[picked[i]], ") ", q.options[picked[i]]) : React.createElement("span", {
      className: "text-slate-500 ml-2"
    }, "(bo\u015F)")), React.createElement("p", {
      className: "text-slate-400"
    }, q.explain)))), React.createElement("div", {
      className: "space-y-1 text-xs"
    }, Object.entries(byType).map(([t, [c, n]]) => React.createElement("p", {
      key: t,
      className: "text-slate-300"
    }, t, ": ", React.createElement("b", {
      className: c === n ? 'text-emerald-400' : 'text-amber-300'
    }, c, "/", n)))), wrongCardIds.length > 0 && React.createElement("button", {
      disabled: marked,
      onClick: () => {
        onMarkDifficult(wrongCardIds);
        setMarked(true);
      },
      className: "px-4 py-2 rounded-lg bg-amber-600 text-xs font-bold text-white disabled:opacity-60"
    }, marked ? '✓ Zorlandığım Kelimeler\'e eklendi' : 'Yanlış yaptığım ' + wrongCardIds.length + ' kelimeyi "Zorlandığım Kelimeler"e ekle'), React.createElement("div", {
      className: "flex gap-2"
    }, React.createElement("button", {
      onClick: () => build(timed ? {
        mode: 'mixed',
        count: 20,
        seconds: 15 * 60
      } : undefined),
      className: "px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white"
    }, "Yeni s\u0131nav"), React.createElement("button", {
      onClick: () => {
        setQs(null);
        setTimed(null);
      },
      className: "px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-200"
    }, "Ayarlar")));
  }
  const q = qs[idx];
  if (!q) return null;
  const my = picked[idx];
  const isAnswered = my !== undefined && !timed;
  const showClues = q.type === 'Kelime';
  const rendered = showClues ? renderWithClues(q.prompt) : {
    nodes: q.prompt,
    clues: []
  };
  return React.createElement("div", {
    className: "max-w-2xl mx-auto space-y-3"
  }, React.createElement("div", {
    className: "flex items-center justify-between text-xs text-slate-400"
  }, React.createElement("span", null, "Soru ", idx + 1, " / ", qs.length, " \xB7 ", React.createElement("span", {
    className: "text-blue-300 font-bold"
  }, q.type)), timed ? React.createElement("span", {
    className: "font-black text-sm " + (remaining <= 60 ? 'text-red-400' : 'text-indigo-300')
  }, "\u23F1 ", Math.floor(remaining / 60), ":", String(remaining % 60).padStart(2, '0')) : React.createElement("span", null, "Do\u011Fru: ", correctN, " / ", answered)), React.createElement("div", {
    className: "h-1.5 rounded bg-slate-800 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-blue-500",
    style: {
      width: idx / qs.length * 100 + '%'
    }
  })), React.createElement("div", {
    className: "bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4"
  }, React.createElement("p", {
    className: "text-sm text-slate-100 font-serif leading-relaxed whitespace-pre-wrap"
  }, rendered.nodes), rendered.clues.length > 0 && React.createElement("div", {
    className: "text-[11px] text-orange-200 bg-orange-950/30 border border-orange-900/40 rounded-lg px-3 py-2 space-y-0.5"
  }, rendered.clues.map(c => React.createElement("p", {
    key: c.w
  }, "\uD83D\uDCA1 ", React.createElement("b", null, c.w), " ", CLUE_HINT[c.cat] || c.cat))), React.createElement("div", {
    className: "space-y-2"
  }, q.options.map((o, i) => {
    const state = !isAnswered ? 'idle' : i === q.answer ? 'right' : i === my ? 'wrong' : 'dim';
    const cls = {
      idle: 'border-slate-700 hover:border-blue-500 hover:bg-slate-900',
      right: 'border-emerald-500 bg-emerald-600/15 text-emerald-200',
      wrong: 'border-red-500 bg-red-600/15 text-red-200',
      dim: 'border-slate-800 text-slate-500'
    }[state];
    return React.createElement("button", {
      key: i,
      disabled: isAnswered || timed && my !== undefined,
      onClick: () => {
        setPicked({
          ...picked,
          [idx]: i
        });
        if (onAnswer) onAnswer(q.type, i === q.answer);
        if (timed) setTimeout(() => setIdx(x => x + 1), 250);
      },
      className: "w-full text-left px-4 py-2.5 rounded-xl border text-sm transition " + cls
    }, React.createElement("b", {
      className: "mr-2"
    }, LETTERS[i], ")"), o);
  })), isAnswered && React.createElement("div", {
    className: "p-3 rounded-xl text-xs " + (my === q.answer ? 'bg-emerald-950/50 text-emerald-200' : 'bg-red-950/40 text-red-200')
  }, React.createElement("b", null, my === q.answer ? '✓ Doğru!' : '✗ Yanlış. Doğru cevap: ' + LETTERS[q.answer] + ') ' + q.options[q.answer]), React.createElement("p", {
    className: "mt-1 text-slate-300"
  }, q.explain)), React.createElement("div", {
    className: "flex justify-between"
  }, timed ? React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => {
      const f = {
        ...picked
      };
      qs.forEach((_, i) => {
        if (f[i] === undefined) f[i] = -1;
      });
      setPicked(f);
      setIdx(qs.length);
    },
    className: "text-xs text-slate-500 hover:text-slate-300"
  }, "Teslim et"), React.createElement("button", {
    onClick: () => {
      if (picked[idx] === undefined) setPicked({
        ...picked,
        [idx]: -1
      });
      setIdx(idx + 1);
    },
    className: "px-5 py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
  }, "Bo\u015F ge\xE7 \u2192")) : React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: () => setQs(null),
    className: "text-xs text-slate-500 hover:text-slate-300"
  }, "S\u0131nav\u0131 bitir"), React.createElement("button", {
    disabled: !isAnswered,
    onClick: () => setIdx(idx + 1),
    className: "px-5 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white disabled:opacity-40"
  }, idx + 1 < qs.length ? 'Sonraki →' : 'Sonucu gör')))));
}
const speakAsync = (text, lang, rate) => new Promise(resolve => {
  if (!('speechSynthesis' in window) || !text) return resolve();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate || 1;
  const v = window.speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  if (v) u.voice = v;
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      resolve();
    }
  };
  u.onend = finish;
  u.onerror = finish;
  setTimeout(finish, 6000 + text.length * 150);
  window.speechSynthesis.speak(u);
});
function AudioStudyModal({
  cards,
  dueCards,
  onClose
}) {
  const [source, setSource] = useState(dueCards.length ? 'due' : 'all');
  const [rate, setRate] = useState(0.9);
  const [withSentence, setWithSentence] = useState(true);
  const [loop, setLoop] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('');
  const run = useRef(0);
  const base = source === 'due' ? dueCards : source === 'difficult' ? cards.filter(c => c.isDifficult || c.srs && c.srs.lapses >= 3) : cards;
  const [order, setOrder] = useState(() => base.map(c => c.id));
  useEffect(() => {
    setOrder((shuffleOn ? shuffleArr(base) : base).map(c => c.id));
    setIdx(0);
    stop();
  }, [source, shuffleOn]);
  const list = order.map(id => cards.find(c => c.id === id)).filter(Boolean);
  const card = list[idx];
  const hasTr = typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices().some(v => /^tr/i.test(v.lang));
  const stop = () => {
    run.current++;
    setPlaying(false);
    setPhase('');
    try {
      speechSynthesis.cancel();
    } catch (e) {}
  };
  useEffect(() => () => stop(), []);
  const play = async from => {
    const my = ++run.current;
    setPlaying(true);
    const pause = ms => new Promise(r => setTimeout(r, ms / rate));
    for (let i = from;; i++) {
      if (i >= list.length) {
        if (loop && list.length) i = 0;else break;
      }
      if (run.current !== my) return;
      setIdx(i);
      const c = list[i];
      setPhase('en');
      await speakAsync(c.english, 'en-US', rate);
      if (run.current !== my) return;
      await pause(1200);
      if (run.current !== my) return;
      setPhase('tr');
      await speakAsync(firstMeaning(c) || c.turkish, 'tr-TR', rate);
      if (run.current !== my) return;
      if (withSentence && c.originalSentence) {
        await pause(700);
        if (run.current !== my) return;
        setPhase('sentence');
        await speakAsync(c.originalSentence, 'en-US', rate * 0.95);
        if (run.current !== my) return;
      }
      await pause(1500);
    }
    if (run.current === my) {
      setPlaying(false);
      setPhase('');
    }
  };
  const jump = d => {
    const n = clampN(idx + d, 0, Math.max(0, list.length - 1));
    stop();
    setIdx(n);
  };
  return React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
  }, React.createElement("div", {
    role: "dialog",
    "aria-label": "Sesli \xE7al\u0131\u015Fma",
    className: "bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4"
  }, React.createElement("div", {
    className: "flex items-center"
  }, React.createElement("h3", {
    className: "font-bold text-base text-white mr-auto"
  }, "\uD83C\uDFA7 Dinleyerek \xC7al\u0131\u015F"), React.createElement("button", {
    onClick: () => {
      stop();
      onClose();
    },
    "aria-label": "Kapat",
    className: "px-2 py-1 rounded-md text-slate-400 hover:bg-slate-800"
  }, "\u2715")), React.createElement("div", {
    className: "grid grid-cols-3 gap-1 text-[11px]"
  }, [['due', 'Bugünküler (' + dueCards.length + ')'], ['difficult', 'Zorlandıklarım'], ['all', 'Tümü (' + cards.length + ')']].map(([k, l]) => React.createElement("button", {
    key: k,
    onClick: () => setSource(k),
    className: "px-2 py-1.5 rounded-lg font-bold " + (source === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')
  }, l))), React.createElement("div", {
    className: "text-center py-6 rounded-2xl bg-slate-950 border border-slate-800 min-h-[9rem] flex flex-col justify-center gap-1 px-4"
  }, !card ? React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "Bu grupta kart yok.") : React.createElement(React.Fragment, null, React.createElement("p", {
    className: "text-2xl font-black " + (phase === 'en' ? 'text-white' : 'text-slate-300')
  }, card.english), card.okunus && React.createElement("p", {
    className: "text-[11px] text-amber-300"
  }, "[", card.okunus, "]"), React.createElement("p", {
    className: "text-base font-bold " + (phase === 'tr' ? 'text-blue-300' : 'text-blue-300/60')
  }, card.turkish), withSentence && card.originalSentence && React.createElement("p", {
    className: "text-[11px] font-serif italic " + (phase === 'sentence' ? 'text-slate-200' : 'text-slate-500')
  }, "\"", card.originalSentence, "\""), React.createElement("p", {
    className: "text-[10px] text-slate-600 mt-1"
  }, idx + 1, " / ", list.length))), React.createElement("div", {
    className: "flex items-center justify-center gap-3"
  }, React.createElement("button", {
    onClick: () => jump(-1),
    disabled: !card,
    "aria-label": "\xD6nceki",
    className: "w-10 h-10 rounded-full bg-slate-800 text-white disabled:opacity-40"
  }, "\u23EE"), React.createElement("button", {
    onClick: () => playing ? stop() : play(idx),
    disabled: !card,
    "aria-label": playing ? 'Duraklat' : 'Oynat',
    className: "w-14 h-14 rounded-full bg-blue-600 text-white text-xl font-bold disabled:opacity-40"
  }, playing ? '⏸' : '▶'), React.createElement("button", {
    onClick: () => jump(1),
    disabled: !card,
    "aria-label": "Sonraki",
    className: "w-10 h-10 rounded-full bg-slate-800 text-white disabled:opacity-40"
  }, "\u23ED")), React.createElement("div", {
    className: "grid grid-cols-2 gap-2 text-[11px] text-slate-300"
  }, React.createElement("label", {
    className: "flex items-center gap-2"
  }, "H\u0131z", React.createElement("input", {
    type: "range",
    min: "0.6",
    max: "1.3",
    step: "0.1",
    value: rate,
    onChange: e => setRate(+e.target.value),
    className: "flex-1 accent-blue-500"
  }), React.createElement("span", {
    className: "w-7 text-right"
  }, rate.toFixed(1))), React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer"
  }, React.createElement("input", {
    type: "checkbox",
    checked: withSentence,
    onChange: e => setWithSentence(e.target.checked),
    className: "accent-blue-500"
  }), "C\xFCmleyi de oku"), React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer"
  }, React.createElement("input", {
    type: "checkbox",
    checked: shuffleOn,
    onChange: e => setShuffleOn(e.target.checked),
    className: "accent-blue-500"
  }), "Kar\u0131\u015Ft\u0131r"), React.createElement("label", {
    className: "flex items-center gap-2 cursor-pointer"
  }, React.createElement("input", {
    type: "checkbox",
    checked: loop,
    onChange: e => setLoop(e.target.checked),
    className: "accent-blue-500"
  }), "Bitince ba\u015Fa d\xF6n")), !hasTr && React.createElement("p", {
    className: "text-[10px] text-amber-400"
  }, "Cihaz\u0131n\u0131zda T\xFCrk\xE7e ses bulunamad\u0131; T\xFCrk\xE7e anlamlar varsay\u0131lan sesle okunabilir. (Windows: Ayarlar \u2192 Zaman ve dil \u2192 Konu\u015Fma \u2192 T\xFCrk\xE7e ses ekleyin.)")));
}
const loadScript = (src, globalName) => new Promise((resolve, reject) => {
  if (globalName && window[globalName]) return resolve(window[globalName]);
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onload = () => resolve(globalName ? window[globalName] : true);
  s.onerror = () => reject(new Error('Kütüphane yüklenemedi: ' + src));
  document.head.appendChild(s);
});
const loadNlp = () => loadScript('https://cdn.jsdelivr.net/npm/compromise@14.14.0/builds/compromise.js', 'nlp');
const translateSentence = async text => {
  const j = await fetchJson('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) + '&langpair=en|tr');
  if (!j) throw new Error('Çeviri alınamadı');
  if (j.quotaFinished) throw new Error('Çeviri servisinin günlük ücretsiz kotası doldu');
  return j.responseData && j.responseData.translatedText || '';
};
const SUBORDINATORS = [['which', 'Sıfat cümlesi', 'önceki isme bilgi ekler: "-en / -an / -dığı"'], ['that', 'Sıfat / isim cümlesi', '"-dığı / -en" ya da "ki"'], ['who', 'Sıfat cümlesi (kişi)', '"-en kişi"'], ['whom', 'Sıfat cümlesi (kişi)', '"-diği kişi"'], ['whose', 'Sıfat cümlesi (sahiplik)', '"-in …-i olan"'], ['where', 'Yer belirten yan cümle', '"-diği yer(de)"'], ['when', 'Zaman yan cümlesi', '"-dığında"'], ['while', 'Zaman / zıtlık yan cümlesi', '"-ken" ya da "oysa"'], ['whereas', 'Zıtlık yan cümlesi', '"oysa, -mesine karşın"'], ['although', 'Zıtlık yan cümlesi', '"-mesine rağmen"'], ['though', 'Zıtlık yan cümlesi', '"-mesine rağmen"'], ['even though', 'Zıtlık yan cümlesi', '"-mesine rağmen"'], ['because', 'Sebep yan cümlesi', '"çünkü / -diği için"'], ['since', 'Sebep / zaman yan cümlesi', '"-diği için" ya da "-den beri"'], ['as', 'Sebep / zaman / benzerlik', '"-diği için / -dığı gibi"'], ['if', 'Koşul yan cümlesi', '"-irse"'], ['unless', 'Koşul yan cümlesi', '"-medikçe"'], ['provided that', 'Koşul yan cümlesi', '"-mek şartıyla"'], ['so that', 'Amaç yan cümlesi', '"-sin diye"'], ['until', 'Zaman yan cümlesi', '"-e kadar"'], ['before', 'Zaman yan cümlesi', '"-meden önce"'], ['after', 'Zaman yan cümlesi', '"-dikten sonra"'], ['once', 'Zaman yan cümlesi', '"-ir -mez"'], ['whether', 'İsim cümlesi', '"-ip -mediği"']];
const LINKER_TR = {
  'zıtlık': 'zıtlık: "ancak, -e rağmen"',
  'sebep-sonuç': 'sebep-sonuç: "bu yüzden, -dığı için"',
  'ekleme': 'ekleme: "ayrıca, üstelik"',
  'örnekleme': 'örnek: "örneğin"',
  'koşul': 'koşul: "-medikçe, -mek şartıyla"',
  'benzerlik': 'benzerlik: "benzer şekilde"',
  'amaç': 'amaç: "-mek için"'
};
const PASSIVE_RE = /\b(?:is|are|was|were|be|been|being|has been|have been|had been|will be|can be|could be|may be|might be|must be|should be)\s+(?:\w+ly\s+)?(\w+(?:ed|en|wn|lt|pt|ght|ung|ade|one|ept))\b/gi;
function SentenceModal({
  sentence,
  cards,
  onClose
}) {
  const [tr, setTr] = useState({
    state: 'loading',
    text: ''
  });
  const [nlpState, setNlpState] = useState({
    state: 'loading',
    clauses: [],
    verbs: []
  });
  useEffect(() => {
    let alive = true;
    translateSentence(sentence).then(t => alive && setTr({
      state: 'ok',
      text: t
    })).catch(e => alive && setTr({
      state: 'error',
      text: e.message
    }));
    loadNlp().then(nlp => {
      if (!alive) return;
      const doc = nlp(sentence);
      const clauses = doc.clauses().out('array').map(s => s.trim()).filter(Boolean);
      const verbs = doc.verbs().out('array').map(v => v.toLowerCase());
      setNlpState({
        state: 'ok',
        clauses: clauses.length ? clauses : [sentence],
        verbs
      });
    }).catch(e => alive && setNlpState({
      state: 'error',
      clauses: [sentence],
      verbs: [],
      error: e.message
    }));
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [sentence]);
  const bank = new Set(cards.map(c => String(c.lemma || c.english).toLowerCase()));
  const verbWords = new Set(nlpState.verbs.flatMap(v => v.split(/\s+/)));
  const linkerAt = low => [...SUBORDINATORS.map(s => s[0]), ...LINKER_LIST.map(l => l.w)].sort((a, b) => b.length - a.length).find(l => low.startsWith(l + ' ') || low.startsWith(l + ','));
  const colorize = text => {
    const linkWords = new Set([...SUBORDINATORS.map(s => s[0]), ...LINKER_LIST.map(l => l.w)].filter(w => !w.includes(' ')));
    return text.split(/([A-Za-z'’-]+)/).map((tok, i) => {
      if (i % 2 === 0) return tok;
      const w = tok.toLowerCase();
      if (linkWords.has(w)) return React.createElement("b", {
        key: i,
        className: "text-orange-300"
      }, tok);
      if (verbWords.has(w)) return React.createElement("b", {
        key: i,
        className: "text-sky-300"
      }, tok);
      if (bank.has(w) || lemmaCandidates(w).some(x => bank.has(x))) return React.createElement("span", {
        key: i,
        className: "text-emerald-300 underline decoration-dotted"
      }, tok);
      if (w.length > 3 && !STOPWORDS.has(w) && awlSublist(w)) return React.createElement("span", {
        key: i,
        className: "underline decoration-purple-400 decoration-2 underline-offset-4"
      }, tok);
      return tok;
    });
  };
  const passives = [...sentence.matchAll(PASSIVE_RE)].map(m => m[0]);
  const linkersFound = LINKER_LIST.filter(L => new RegExp('\\b' + escRe(L.w) + '\\b', 'i').test(sentence));
  return React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4",
    onClick: onClose
  }, React.createElement("div", {
    role: "dialog",
    "aria-label": "C\xFCmle analizi",
    onClick: e => e.stopPropagation(),
    className: "bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4"
  }, React.createElement("div", {
    className: "flex items-start gap-2"
  }, React.createElement("h3", {
    className: "font-bold text-base text-white mr-auto"
  }, "\uD83D\uDCDD C\xFCmle Analizi"), React.createElement("button", {
    onClick: () => speakText(sentence),
    className: "px-2 py-1 rounded-md text-blue-400 hover:bg-slate-800 text-xs"
  }, "\uD83D\uDD0A Dinle"), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Kapat",
    className: "px-2 py-1 rounded-md text-slate-400 hover:bg-slate-800"
  }, "\u2715")), React.createElement("p", {
    className: "text-base text-slate-100 font-serif leading-relaxed"
  }, colorize(sentence)), React.createElement("p", {
    className: "text-[10px] text-slate-500"
  }, React.createElement("b", {
    className: "text-sky-300"
  }, "fiil"), " \xB7 ", React.createElement("b", {
    className: "text-orange-300"
  }, "ba\u011Fla\xE7"), " \xB7 ", React.createElement("span", {
    className: "underline decoration-purple-400"
  }, "akademik kelime"), " \xB7 ", React.createElement("span", {
    className: "text-emerald-300"
  }, "bankan\u0131zda")), React.createElement("div", {
    className: "p-3 rounded-xl bg-slate-950 border border-slate-800"
  }, React.createElement("p", {
    className: "text-[11px] text-slate-500 mb-1"
  }, "T\xFCrk\xE7e \xE7eviri (otomatik, MyMemory)"), React.createElement("p", {
    className: "text-sm " + (tr.state === 'error' ? 'text-amber-400' : 'text-blue-200')
  }, tr.state === 'loading' ? 'Çevriliyor…' : tr.text)), React.createElement("div", {
    className: "space-y-2"
  }, React.createElement("p", {
    className: "text-xs font-bold text-slate-300"
  }, "C\xFCmlenin par\xE7alar\u0131"), nlpState.state === 'loading' && React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "Analiz ediliyor\u2026"), nlpState.state === 'error' && React.createElement("p", {
    className: "text-xs text-amber-400"
  }, "Analiz k\xFCt\xFCphanesi y\xFCklenemedi; yaln\u0131zca \xE7eviri g\xF6steriliyor."), nlpState.state === 'ok' && nlpState.clauses.map((c, i) => {
    const low = c.toLowerCase().replace(/^[,;:\s]+/, '');
    const sub = SUBORDINATORS.find(s => low.startsWith(s[0] + ' ') || low.startsWith(s[0] + ','));
    const lnk = !sub && LINKER_LIST.find(L => low.startsWith(L.w + ' ') || low.startsWith(L.w + ','));
    const role = sub ? sub[1] : lnk ? 'Bağlaçla başlayan cümle (' + lnk.cat + ')' : i === 0 || !nlpState.clauses.some((x, k) => k < i && !SUBORDINATORS.some(s => x.toLowerCase().startsWith(s[0] + ' '))) ? 'Ana cümle' : 'Cümle devamı';
    return React.createElement("div", {
      key: i,
      className: "p-3 rounded-xl border " + (sub ? 'border-orange-900/60 bg-orange-950/20' : 'border-sky-900/60 bg-sky-950/20')
    }, React.createElement("p", {
      className: "text-[10px] font-bold uppercase tracking-wide text-slate-400"
    }, role, sub && React.createElement("span", {
      className: "normal-case font-normal text-slate-500"
    }, " \u2014 T\xFCrk\xE7ede: ", sub[2])), React.createElement("p", {
      className: "text-sm text-slate-100 font-serif mt-0.5"
    }, colorize(c)));
  })), (passives.length > 0 || linkersFound.length > 0) && React.createElement("div", {
    className: "p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px] text-slate-300"
  }, passives.map((p, i) => React.createElement("p", {
    key: 'p' + i
  }, "\uD83D\uDD01 ", React.createElement("b", {
    className: "text-sky-300"
  }, p), " \u2192 edilgen yap\u0131 (i\u015F yap\u0131l\u0131yor/yap\u0131ld\u0131; yapan \xF6nemli de\u011Fil). T\xFCrk\xE7eye \"-\u0131ld\u0131 / -ilir\" ile \xE7evrilir.")), linkersFound.map(L => React.createElement("p", {
    key: L.w
  }, "\uD83D\uDD17 ", React.createElement("b", {
    className: "text-orange-300"
  }, L.w), " \u2192 ", LINKER_TR[L.cat] || L.cat)))));
}
function WordPopover({
  pop,
  cards,
  onAdd,
  onClose,
  onAnalyze
}) {
  const [info, setInfo] = useState(null);
  const [state, setState] = useState('loading');
  const boxRef = useRef(null);
  useEffect(() => {
    let alive = true;
    setState('loading');
    setInfo(null);
    (async () => {
      try {
        const raw = pop.word.toLowerCase();
        const r = await resolveLemma(raw).catch(() => null);
        let lemma = r ? r.word : raw;
        let pos = r ? posFor(lemma, [raw], r.info.tags) : null;
        if (!r) {
          for (const c of lemmaCandidates(raw).slice(1)) {
            const j = await fetchJson('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(c)).catch(() => null);
            if (Array.isArray(j) && j.length) {
              lemma = c;
              break;
            }
          }
          if (lemma !== raw && /(ed|ing)$/.test(raw)) pos = 'verb';
        }
        const d = await fetchWordDetails(lemma, pos || 'noun');
        if (alive) {
          setInfo({
            ...d,
            lemma,
            pos: d.partOfSpeech || pos
          });
          setState('ok');
        }
      } catch (e) {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [pop.word]);
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = e => {
      if (boxRef.current && !boxRef.current.contains(e.target) && !e.target.closest('[data-reader]')) onClose();
    };
    const onScroll = e => {
      if (!boxRef.current || !boxRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);
  const lemma = info ? info.lemma : pop.word.toLowerCase();
  const existing = cards.find(c => String(c.lemma || c.english).toLowerCase() === lemma);
  const W = 320;
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, pop.x - W / 2));
  const below = pop.y + 300 < window.innerHeight;
  const style = below ? {
    left,
    top: pop.y + 8,
    width: W
  } : {
    left,
    bottom: window.innerHeight - pop.top + 8,
    width: W
  };
  return React.createElement("div", {
    ref: boxRef,
    role: "dialog",
    "aria-label": '"' + pop.word + '" kelimesinin anlamı',
    style: style,
    className: "fixed z-50 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 space-y-2 text-left font-sans"
  }, React.createElement("div", {
    className: "flex items-start gap-2"
  }, React.createElement("div", {
    className: "flex-1 min-w-0"
  }, React.createElement("div", {
    className: "flex flex-wrap items-baseline gap-2"
  }, React.createElement("span", {
    className: "text-lg font-black text-white"
  }, lemma), info && info.lemma !== pop.word.toLowerCase() && React.createElement("span", {
    className: "text-[10px] text-slate-500"
  }, "(", pop.word, ")"), info && info.pos && React.createElement("span", {
    className: "text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300"
  }, info.pos), React.createElement(AwlBadge, {
    word: lemma
  })), info && (info.ipa || info.okunus) && React.createElement("p", {
    className: "text-[11px] text-slate-400"
  }, info.ipa && React.createElement("span", {
    className: "font-mono"
  }, "/", info.ipa, "/"), info.okunus && React.createElement("span", {
    className: "text-amber-300 ml-1.5"
  }, "[", info.okunus, "]"))), React.createElement("button", {
    onClick: () => playWord({
      english: lemma,
      audioUrl: info && info.audioUrl
    }),
    "aria-label": lemma + ' telaffuzunu dinle',
    className: "px-1.5 py-1 rounded-md text-blue-400 hover:bg-slate-800"
  }, "\uD83D\uDD0A"), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Kapat",
    className: "px-1.5 py-1 rounded-md text-slate-500 hover:bg-slate-800"
  }, "\u2715")), state === 'loading' && React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "Anlam aran\u0131yor\u2026"), state === 'error' && React.createElement("p", {
    className: "text-xs text-red-400"
  }, "Ba\u011Flant\u0131 hatas\u0131; anlam getirilemedi."), state === 'ok' && React.createElement(React.Fragment, null, React.createElement("p", {
    className: "text-sm font-bold " + (info.turkish ? 'text-blue-300' : 'text-amber-400')
  }, existing && !isMissingMeaning(existing) ? existing.turkish : info.turkish || 'Otomatik anlam bulunamadı'), (info.trSenses || []).length > 1 && info.trSenses.slice(0, 2).map((s, i) => React.createElement("p", {
    key: i,
    className: "text-[10px] text-slate-400"
  }, s.sense && React.createElement("span", {
    className: "italic"
  }, s.sense, ": "), React.createElement("span", {
    className: "text-blue-200"
  }, s.words.join(', ')))), info.definition && React.createElement("p", {
    className: "text-[11px] text-slate-400 line-clamp-2"
  }, React.createElement("span", {
    className: "text-slate-500"
  }, "EN:"), " ", info.definition), (info.synonyms || []).length > 0 && React.createElement("p", {
    className: "text-[11px]"
  }, React.createElement("span", {
    className: "text-slate-500"
  }, "E\u015F:"), " ", React.createElement("span", {
    className: "text-emerald-300"
  }, info.synonyms.slice(0, 4).join(', '))), (info.antonyms || []).length > 0 && React.createElement("p", {
    className: "text-[11px]"
  }, React.createElement("span", {
    className: "text-slate-500"
  }, "Z\u0131t:"), " ", React.createElement("span", {
    className: "text-red-300"
  }, info.antonyms.slice(0, 3).join(', ')))), React.createElement("div", {
    className: "flex items-center gap-2 pt-1"
  }, existing ? React.createElement("span", {
    className: "text-[11px] font-bold text-emerald-400"
  }, "\u2713 Kelime bankan\u0131zda var") : React.createElement("button", {
    disabled: state === 'loading',
    onClick: () => onAdd(info || {
      lemma,
      pos: 'noun'
    }, pop),
    className: "px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
  }, "+ Karta ekle"), React.createElement(TurengLink, {
    word: lemma,
    className: "ml-auto"
  })), pop.sentence && onAnalyze && React.createElement("button", {
    onClick: () => onAnalyze(pop.sentence),
    className: "w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-200 hover:bg-slate-700"
  }, "\uD83D\uDCDD C\xFCmleyi \xE7evir ve analiz et"));
}
function FlashcardsSection({
  cards,
  readings,
  recentIds,
  onUpdate,
  onUpdateMany,
  onDelete,
  onAudio
}) {
  const [query, setQuery] = useState('');
  const [autoFill, setAutoFill] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);
  const lookupMeaning = async c => {
    const r = await fetchTurkishAuto(c.lemma || c.english, c.partOfSpeech);
    return r.meanings.length ? {
      ...c,
      turkish: r.meanings.join(', '),
      trSenses: r.senses || [],
      trSource: r.source,
      updatedAt: new Date().toISOString()
    } : null;
  };
  const fillMissing = async () => {
    const targets = cards.filter(isMissingMeaning);
    if (!targets.length) return;
    setAutoFill({
      done: 0,
      total: targets.length,
      found: 0
    });
    let found = 0;
    const results = await runPool(targets, 3, async c => {
      const u = await lookupMeaning(c);
      if (u) found++;
      return u;
    }, (d, t) => setAutoFill({
      done: d,
      total: t,
      found
    }));
    onUpdateMany(results.filter(Boolean));
    setAutoFill({
      done: targets.length,
      total: targets.length,
      found: results.filter(Boolean).length,
      finished: true
    });
    setTimeout(() => setAutoFill(null), 5000);
  };
  const refreshOne = async c => {
    setRefreshingId(c.id);
    try {
      const u = await lookupMeaning(c);
      if (u) onUpdate(u);
    } finally {
      setRefreshingId(null);
    }
  };
  const [filter, setFilter] = useState(recentIds && recentIds.length ? 'recent' : 'all');
  const [qTypeFilter, setQTypeFilter] = useState('all');
  const [flipped, setFlipped] = useState(() => new Set());
  const [order, setOrder] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  useEffect(() => {
    if (recentIds && recentIds.length) setFilter('recent');
  }, [recentIds]);
  const recentSet = new Set(recentIds || []);
  const readingTitles = [...new Set(cards.map(c => c.readingTitle).filter(Boolean))];
  const q = query.trim().toLowerCase();
  let list = cards.filter(c => {
    if (filter === 'recent' && !recentSet.has(c.id)) return false;
    if (filter === 'missing' && !isMissingMeaning(c)) return false;
    if (filter.startsWith('r:') && c.readingTitle !== filter.slice(2)) return false;
    if (qTypeFilter !== 'all' && c.questionType !== qTypeFilter) return false;
    if (q && !(c.english.toLowerCase().includes(q) || (c.turkish || '').toLowerCase().includes(q))) return false;
    return true;
  });
  if (order) {
    const pos = new Map(order.map((id, i) => [id, i]));
    list = [...list].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e9) - (pos.has(b.id) ? pos.get(b.id) : 1e9));
  }
  const toggle = id => setFlipped(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allFlipped = list.length > 0 && list.every(c => flipped.has(c.id));
  const shuffle = () => {
    const ids = cards.map(c => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setOrder(ids);
    setFlipped(new Set());
  };
  const startEdit = c => {
    setEditingId(c.id);
    setEditValue(isMissingMeaning(c) ? '' : c.turkish);
  };
  const saveEdit = c => {
    const v = editValue.trim();
    if (v) onUpdate({
      ...c,
      turkish: v,
      updatedAt: new Date().toISOString()
    });
    setEditingId(null);
  };
  const missingCount = cards.filter(isMissingMeaning).length;
  return React.createElement("div", {
    className: "space-y-4"
  }, React.createElement("div", {
    className: "flex flex-wrap items-center gap-2"
  }, React.createElement("h3", {
    className: "font-bold text-lg text-white mr-auto"
  }, "Kelime Kartlar\u0131 (", list.length, list.length !== cards.length ? ' / ' + cards.length : '', ")"), React.createElement("input", {
    type: "search",
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: "Kelime ara\u2026",
    "aria-label": "Kelime ara",
    className: "px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white w-40"
  }), React.createElement("select", {
    value: filter,
    onChange: e => setFilter(e.target.value),
    "aria-label": "Kartlar\u0131 filtrele",
    className: "px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
  }, React.createElement("option", {
    value: "all"
  }, "T\xFCm kartlar"), recentIds && recentIds.length > 0 && React.createElement("option", {
    value: "recent"
  }, "Son eklenenler (", recentIds.length, ")"), React.createElement("option", {
    value: "missing"
  }, "Anlam\u0131 eksik olanlar (", missingCount, ")"), readingTitles.map(t => React.createElement("option", {
    key: t,
    value: 'r:' + t
  }, "Metin: ", t))), React.createElement("select", {
    value: qTypeFilter,
    onChange: e => setQTypeFilter(e.target.value),
    "aria-label": "Soru tipine g\xF6re filtrele",
    className: "px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-indigo-300"
  }, React.createElement("option", {
    value: "all"
  }, "T\xFCm Soru Tipleri"), React.createElement("option", {
    value: "Kelime Sorular\u0131 (1-6)"
  }, "Kelime (1-6)"), React.createElement("option", {
    value: "Gramer & Edat (7-16)"
  }, "Gramer & Edat (7-16)"), React.createElement("option", {
    value: "Cloze Test (17-26)"
  }, "Cloze Test (17-26)"), React.createElement("option", {
    value: "C\xFCmle Tamamlama (27-36)"
  }, "C\xFCmle Tamamlama (27-36)"), React.createElement("option", {
    value: "\xC7eviri Sorular\u0131 (37-48)"
  }, "\xC7eviri (37-48)"), React.createElement("option", {
    value: "Paragraf Sorular\u0131 (49-80)"
  }, "Paragraf (49-80)"), React.createElement("option", {
    value: "Genel Akademik"
  }, "Genel Akademik")), onAudio && React.createElement("button", {
    onClick: onAudio,
    disabled: !cards.length,
    className: "px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white disabled:opacity-40"
  }, "\uD83C\uDFA7 Dinleyerek \xE7al\u0131\u015F"), React.createElement("button", {
    onClick: shuffle,
    className: "px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
  }, "\uD83D\uDD00 Kar\u0131\u015Ft\u0131r"), React.createElement("button", {
    onClick: () => setFlipped(allFlipped ? new Set() : new Set(list.map(c => c.id))),
    className: "px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-slate-200"
  }, allFlipped ? 'Ön yüzleri göster' : 'Tümünü çevir')), (missingCount > 0 || autoFill) && React.createElement("div", {
    className: "flex flex-wrap items-center gap-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/50"
  }, autoFill ? React.createElement("p", {
    className: "text-xs text-amber-200"
  }, autoFill.finished ? '✓ ' + autoFill.found + ' kartın anlamı otomatik bulundu' + (autoFill.total - autoFill.found ? ', ' + (autoFill.total - autoFill.found) + ' kelime için kaynak bulunamadı.' : '.') : 'Anlamlar aranıyor… ' + autoFill.done + '/' + autoFill.total) : React.createElement(React.Fragment, null, React.createElement("p", {
    className: "text-xs text-amber-200"
  }, missingCount, " kart\u0131n T\xFCrk\xE7e anlam\u0131 eksik."), React.createElement("button", {
    onClick: fillMissing,
    className: "px-3 py-1.5 rounded-lg bg-amber-600 text-xs font-bold text-white hover:bg-amber-500"
  }, "\u2728 Eksik anlamlar\u0131 otomatik bul"))), React.createElement("p", {
    className: "text-[11px] text-slate-500"
  }, "Karta t\u0131klay\u0131nca \xE7evrilir. T\xFCrk\xE7e anlamlar otomatik gelir (Wiktionary, CC BY-SA). ", React.createElement("span", {
    className: "font-bold text-slate-300"
  }, "\u21BB"), " ile kart\u0131n anlam\u0131n\u0131 yeniden getirebilir, ", React.createElement("span", {
    className: "text-red-300 font-bold"
  }, "Tureng \u2197"), " ile kar\u015F\u0131la\u015Ft\u0131rabilirsiniz."), !cards.length ? React.createElement("div", {
    className: "text-center py-16 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400"
  }, "Hen\xFCz kart yok. Bir okuma metnini a\xE7\u0131p ", React.createElement("b", null, "\u2728 Kelimeleri \xC7\u0131kar"), " ile kelime ekleyin.") : !list.length ? React.createElement("div", {
    className: "text-center py-10 text-xs text-slate-400"
  }, "Bu filtreye uyan kart yok.") : React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
  }, list.map(c => {
    const back = flipped.has(c.id);
    const missing = isMissingMeaning(c);
    return React.createElement("div", {
      key: c.id,
      className: "rounded-2xl border flex flex-col overflow-hidden " + (recentSet.has(c.id) ? "border-blue-600/50" : "border-slate-800") + (missing ? " ring-1 ring-amber-600/40" : "")
    }, React.createElement("button", {
      type: "button",
      onClick: () => toggle(c.id),
      "aria-pressed": back,
      "aria-label": c.english + (back ? ' kartının ön yüzünü göster' : ' kartını çevir'),
      className: "min-h-[11rem] p-4 text-left flex flex-col transition-colors " + (back ? "bg-slate-900" : "bg-slate-950 hover:bg-slate-900/60")
    }, !back ? React.createElement("div", {
      className: "flex-1 flex flex-col items-center justify-center text-center gap-1"
    }, React.createElement("div", {
      className: "flex flex-wrap items-center justify-center gap-1"
    }, React.createElement("span", {
      className: "text-[10px] font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300"
    }, c.partOfSpeech), c.questionType && React.createElement("span", {
      className: "text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-800/60 text-indigo-300"
    }, c.questionType.split(' ')[0])), React.createElement("span", {
      className: "text-2xl font-black text-white mt-1"
    }, c.english), c.ipa && React.createElement("span", {
      className: "text-[11px] font-mono text-slate-400"
    }, "/", c.ipa, "/"), c.okunus && React.createElement("span", {
      className: "text-xs text-amber-300"
    }, "[", c.okunus, "]"), React.createElement("span", {
      className: "text-[10px] text-slate-600 mt-2"
    }, "\xE7evirmek i\xE7in t\u0131klay\u0131n")) : React.createElement("div", {
      className: "flex-1 space-y-1.5"
    }, React.createElement("p", {
      className: "text-lg font-black " + (missing ? "text-amber-400" : "text-blue-300")
    }, missing ? 'Anlam eksik — "Eksik anlamları otomatik bul" düğmesini kullanın' : c.turkish), (c.trSenses || []).length > 1 && React.createElement("div", {
      className: "space-y-0.5"
    }, c.trSenses.slice(0, 3).map((s, i) => React.createElement("p", {
      key: i,
      className: "text-[10px] text-slate-400"
    }, s.pos && React.createElement("span", {
      className: "text-slate-500"
    }, "(", s.pos, ") "), s.sense && React.createElement("span", {
      className: "italic"
    }, s.sense, ": "), React.createElement("span", {
      className: "text-blue-200"
    }, s.words.join(', '))))), c.definition && React.createElement("p", {
      className: "text-[11px] text-slate-400"
    }, React.createElement("span", {
      className: "text-slate-500"
    }, "EN:"), " ", c.definition), c.originalSentence && React.createElement("p", {
      className: "text-[11px] text-slate-300 font-serif italic line-clamp-3"
    }, "\u201C", c.originalSentence, "\u201D"), (c.examples || [])[0] && React.createElement("p", {
      className: "text-[11px] text-slate-400 font-serif line-clamp-2"
    }, "\u2022 ", c.examples[0]), (c.synonyms || []).length > 0 && React.createElement("p", {
      className: "text-[11px]"
    }, React.createElement("span", {
      className: "text-slate-500"
    }, "E\u015F:"), " ", React.createElement("span", {
      className: "text-emerald-300"
    }, c.synonyms.slice(0, 4).join(', '))), (c.antonyms || []).length > 0 && React.createElement("p", {
      className: "text-[11px]"
    }, React.createElement("span", {
      className: "text-slate-500"
    }, "Z\u0131t:"), " ", React.createElement("span", {
      className: "text-red-300"
    }, c.antonyms.slice(0, 3).join(', '))))), editingId === c.id ? React.createElement("form", {
      onSubmit: e => {
        e.preventDefault();
        saveEdit(c);
      },
      className: "flex items-center gap-1.5 p-2 bg-slate-900 border-t border-slate-800"
    }, React.createElement("input", {
      autoFocus: true,
      type: "text",
      value: editValue,
      onChange: e => setEditValue(e.target.value),
      placeholder: "T\xFCrk\xE7e anlam\u0131 yap\u0131\u015Ft\u0131r\u0131n/yaz\u0131n",
      "aria-label": c.english + ' Türkçe anlamı',
      className: "flex-1 min-w-0 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs text-white"
    }), React.createElement("button", {
      type: "submit",
      className: "px-2.5 py-1 rounded-md bg-blue-600 text-[11px] font-bold text-white"
    }, "Kaydet"), React.createElement("button", {
      type: "button",
      onClick: () => setEditingId(null),
      className: "px-2 py-1 rounded-md bg-slate-800 text-[11px] text-slate-300"
    }, "\u0130ptal")) : React.createElement("div", {
      className: "flex flex-wrap items-center gap-1.5 p-2 bg-slate-900/70 border-t border-slate-800"
    }, React.createElement("button", {
      onClick: () => playWord(c),
      "aria-label": c.english + ' telaffuzunu dinle',
      className: "px-2 py-1 rounded-md text-xs text-blue-400 hover:bg-slate-800"
    }, "\uD83D\uDD0A"), React.createElement(TurengLink, {
      word: c.lemma || c.english
    }), React.createElement("button", {
      onClick: () => refreshOne(c),
      disabled: refreshingId === c.id,
      title: "T\xFCrk\xE7e anlam\u0131 otomatik yeniden getir",
      "aria-label": c.english + ' anlamını otomatik yeniden getir',
      className: "px-2 py-1 rounded-md text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50 " + (refreshingId === c.id ? 'animate-spin' : '')
    }, "\u21BB"), c.trSource && React.createElement("span", {
      className: "text-[9px] text-slate-600"
    }, c.trSource), React.createElement("button", {
      onClick: () => startEdit(c),
      className: "ml-auto px-2 py-1 rounded-md text-[11px] font-bold " + (missing ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800")
    }, "\u270E Anlam", missing ? ' ekle' : ''), React.createElement("button", {
      onClick: () => {
        if (window.confirm('"' + c.english + '" kartı silinsin mi? Kelime, Kelime Bankası ve Günlük Tekrar\'dan da kaldırılır. Bu işlem geri alınamaz.')) onDelete(c.id);
      },
      title: "Kart\u0131 sil",
      "aria-label": c.english + ' kartını sil',
      className: "px-2 py-1 rounded-md text-[11px] font-bold text-red-400 hover:bg-red-600 hover:text-white transition"
    }, "\uD83D\uDDD1 Sil")));
  })));
}
function AutoVocabModal({
  reading,
  cards,
  onClose,
  onAdd
}) {
  const [level, setLevel] = useState('120');
  const [limit, setLimit] = useState(30);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState({
    done: 0,
    total: 0
  });
  const [items, setItems] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [quotaHit, setQuotaHit] = useState(false);
  const runId = useRef(0);
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z\s-]/g, '').trim();
  const existing = new Map(cards.map(c => [norm(c.lemma || c.english), c]));
  const start = async () => {
    const my = ++runId.current;
    setPhase('scanning');
    setItems([]);
    setErrorMsg('');
    setQuotaHit(false);
    setProgress({
      done: 0,
      total: 0
    });
    try {
      const cands = await extractCandidates(reading.content, {
        maxFreq: parseFloat(level),
        onProgress: (d, t) => {
          if (runId.current === my) setProgress({
            done: d,
            total: t
          });
        }
      });
      if (runId.current !== my) return;
      if (!cands.length) {
        setPhase('done');
        return;
      }
      cands.sort((a, b) => existing.has(a.lemma) - existing.has(b.lemma) || (awlSublist(a.lemma) ? 0 : 1) - (awlSublist(b.lemma) ? 0 : 1) || a.freq - b.freq);
      const chosen = cands.slice(0, limit);
      setItems(chosen.map(c => ({
        ...c,
        checked: !existing.has(c.lemma),
        loading: true
      })));
      setPhase('details');
      setProgress({
        done: 0,
        total: chosen.length
      });
      await runPool(chosen, 3, async c => {
        const d = await fetchWordDetails(c.lemma, c.pos);
        if (runId.current !== my) return;
        if (d.trQuota) setQuotaHit(true);
        setItems(prev => prev.map(x => x.lemma === c.lemma ? {
          ...x,
          ...d,
          loading: false
        } : x));
      }, (d, t) => {
        if (runId.current === my) setProgress({
          done: d,
          total: t
        });
      });
      if (runId.current !== my) return;
      setItems(prev => prev.map(x => x.loading ? {
        ...x,
        loading: false,
        failed: true
      } : x));
      setPhase('done');
    } catch (e) {
      if (runId.current !== my) return;
      setErrorMsg('Kelimeler alınamadı: ' + (e && e.message ? e.message : 'bağlantı hatası') + '. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      setPhase('error');
    }
  };
  useEffect(() => {
    start();
    return () => {
      runId.current++;
    };
  }, []);
  const update = (lemma, patch) => setItems(prev => prev.map(x => x.lemma === lemma ? {
    ...x,
    ...patch
  } : x));
  const selected = items.filter(x => x.checked && !x.loading);
  const allChecked = items.length > 0 && items.every(x => x.checked);
  const handleAdd = () => {
    const now = new Date().toISOString();
    const newCards = [],
      updated = [];
    selected.forEach((x, i) => {
      const source = {
        readingId: reading.id,
        readingTitle: reading.title,
        weekId: reading.weekId,
        sentence: x.sentence,
        dateAdded: now
      };
      const fields = {
        turkish: (x.turkish || '').trim(),
        trSenses: x.trSenses || [],
        trSource: x.trSource || '',
        ipa: x.ipa || '',
        okunus: x.okunus || '',
        audioUrl: x.audioUrl || '',
        definition: x.definition || '',
        examples: x.examples || [],
        synonyms: x.synonyms || [],
        antonyms: x.antonyms || []
      };
      const dup = existing.get(x.lemma);
      if (dup) {
        const filled = {};
        Object.keys(fields).forEach(k => {
          const cur = dup[k];
          if (cur == null || cur === '' || Array.isArray(cur) && !cur.length) filled[k] = fields[k];
        });
        const sources = (dup.sources || []).filter(s => !(s.readingId === reading.id && s.sentence === x.sentence)).concat([source]);
        updated.push({
          ...dup,
          ...filled,
          sources,
          updatedAt: now
        });
      } else {
        const id = 'card_' + Date.now() + '_' + i;
        newCards.push({
          id,
          english: x.lemma,
          lemma: x.lemma,
          ...fields,
          turkish: fields.turkish || '(anlam bulunamadı – düzenleyin)',
          partOfSpeech: x.partOfSpeech || x.pos || 'noun',
          originalSentence: x.sentence,
          readingId: reading.id,
          readingTitle: reading.title,
          weekId: reading.weekId,
          sources: [source],
          sourceType: 'user_reading',
          isDifficult: false,
          srs: createSRS(id),
          createdAt: now,
          updatedAt: now
        });
      }
    });
    onAdd(newCards, updated);
  };
  const chip = (t, cls) => React.createElement("span", {
    key: t,
    className: "inline-block px-2 py-0.5 rounded-full text-[10px] mr-1 mb-1 " + cls
  }, t);
  const highlight = (sentence, forms) => {
    if (!sentence) return null;
    const re = new RegExp('\\b(' + forms.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
    return sentence.split(re).map((part, i) => i % 2 ? React.createElement("mark", {
      key: i,
      className: "bg-blue-500/30 text-white rounded px-0.5"
    }, part) : part);
  };
  const busy = phase === 'scanning' || phase === 'details';
  return React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  }, React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col"
  }, React.createElement("div", {
    className: "p-5 border-b border-slate-800 space-y-3"
  }, React.createElement("div", {
    className: "flex items-start justify-between gap-3"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "font-bold text-base text-white"
  }, "\u2728 Metinden Kelime \xC7\u0131kar"), React.createElement("p", {
    className: "text-[11px] text-slate-400 mt-0.5 truncate"
  }, reading.title)), React.createElement("button", {
    onClick: onClose,
    "aria-label": "Kapat",
    className: "px-2 py-1 rounded-lg text-slate-400 hover:bg-slate-800"
  }, "\u2715")), React.createElement("div", {
    className: "flex flex-wrap items-center gap-2 text-[11px]"
  }, React.createElement("label", {
    className: "text-slate-400"
  }, "Seviye"), React.createElement("select", {
    value: level,
    onChange: e => setLevel(e.target.value),
    disabled: busy,
    className: "px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
  }, React.createElement("option", {
    value: "400"
  }, "T\xFCm\xFC (yayg\u0131n kelimeler dahil)"), React.createElement("option", {
    value: "120"
  }, "Orta ve \xFCst\xFC (\xF6nerilen)"), React.createElement("option", {
    value: "30"
  }, "\u0130leri")), React.createElement("label", {
    className: "text-slate-400 ml-2"
  }, "En fazla"), React.createElement("select", {
    value: limit,
    onChange: e => setLimit(+e.target.value),
    disabled: busy,
    className: "px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white"
  }, [15, 30, 50, 80].map(n => React.createElement("option", {
    key: n,
    value: n
  }, n, " kelime"))), React.createElement("button", {
    onClick: start,
    disabled: busy,
    className: "ml-auto px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold disabled:opacity-50"
  }, "\u21BB Yeniden \xE7\u0131kar")), busy && React.createElement("div", {
    className: "space-y-1"
  }, React.createElement("div", {
    className: "h-1.5 rounded bg-slate-800 overflow-hidden"
  }, React.createElement("div", {
    className: "h-full bg-blue-500 transition-all",
    style: {
      width: (progress.total ? Math.round(progress.done / progress.total * 100) : 5) + '%'
    }
  })), React.createElement("p", {
    className: "text-[11px] text-blue-300"
  }, phase === 'scanning' ? 'Metindeki kelimeler taranıyor' : 'Anlamlar, okunuşlar ve örnekler getiriliyor', " \xB7 ", progress.done, "/", progress.total || '…')), quotaHit && React.createElement("p", {
    className: "text-[11px] text-amber-400"
  }, "\xC7eviri servisinin g\xFCnl\xFCk \xFCcretsiz kotas\u0131 doldu; baz\u0131 T\xFCrk\xE7e anlamlar bo\u015F kald\u0131. Elle yazabilir veya yar\u0131n tekrar deneyebilirsiniz."), errorMsg && React.createElement("p", {
    className: "text-[11px] text-red-400"
  }, errorMsg)), React.createElement("div", {
    className: "flex-1 overflow-y-auto p-4 space-y-2"
  }, phase === 'done' && !items.length && React.createElement("p", {
    className: "text-center text-xs text-slate-400 py-10"
  }, "Bu seviyede \xF6\u011Frenilecek kelime bulunamad\u0131. Seviyeyi \"T\xFCm\xFC\" yap\u0131p tekrar deneyin."), items.length > 0 && React.createElement("label", {
    className: "flex items-center gap-2 text-[11px] text-slate-400 px-1 pb-1 cursor-pointer select-none"
  }, React.createElement("input", {
    type: "checkbox",
    checked: allChecked,
    onChange: e => setItems(prev => prev.map(x => ({
      ...x,
      checked: e.target.checked
    }))),
    className: "accent-blue-500"
  }), "T\xFCm\xFCn\xFC se\xE7 (", items.length, " kelime bulundu)"), items.map(x => {
    const lvl = freqLevel(x.freq);
    const inBank = existing.has(x.lemma);
    return React.createElement("div", {
      key: x.lemma,
      className: "rounded-xl border p-3 transition " + (x.checked ? "border-blue-600/60 bg-slate-950" : "border-slate-800 bg-slate-950/50 opacity-70")
    }, React.createElement("div", {
      className: "flex items-start gap-3"
    }, React.createElement("input", {
      type: "checkbox",
      checked: x.checked,
      onChange: e => update(x.lemma, {
        checked: e.target.checked
      }),
      "aria-label": x.lemma + ' kelimesini seç',
      className: "mt-1 accent-blue-500"
    }), React.createElement("div", {
      className: "flex-1 min-w-0 space-y-1.5"
    }, React.createElement("div", {
      className: "flex flex-wrap items-center gap-2"
    }, React.createElement("span", {
      className: "font-black text-white text-base"
    }, x.lemma), React.createElement("button", {
      type: "button",
      onClick: () => playWord({
        english: x.lemma,
        audioUrl: x.audioUrl
      }),
      "aria-label": x.lemma + ' telaffuzunu dinle',
      className: "text-xs text-blue-400 hover:text-blue-300"
    }, "\uD83D\uDD0A"), x.ipa && React.createElement("span", {
      className: "text-[11px] font-mono text-slate-400"
    }, "/", x.ipa, "/"), x.okunus && React.createElement("span", {
      className: "text-[11px] text-amber-300",
      title: "T\xFCrk\xE7e harflerle okunu\u015F (b\xFCy\xFCk harfli hece vurgulu)"
    }, "[", x.okunus, "]"), x.partOfSpeech && React.createElement("span", {
      className: "text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300"
    }, x.partOfSpeech), React.createElement("span", {
      className: "text-[10px] font-bold px-1.5 py-0.5 rounded " + lvl.cls
    }, lvl.label), React.createElement(AwlBadge, {
      word: x.lemma
    }), React.createElement("span", {
      className: "text-[10px] text-slate-500"
    }, "metinde ", x.count, "\xD7"), inBank && React.createElement("span", {
      className: "text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300"
    }, "Bankada var")), x.loading ? React.createElement("p", {
      className: "text-[11px] text-slate-500"
    }, "Bilgiler getiriliyor\u2026") : React.createElement(React.Fragment, null, React.createElement("div", {
      className: "flex items-center gap-2"
    }, React.createElement("input", {
      type: "text",
      value: x.turkish || '',
      onChange: e => update(x.lemma, {
        turkish: e.target.value
      }),
      placeholder: "T\xFCrk\xE7e anlam\u0131 (bulunamad\u0131, yazabilirsiniz)",
      className: "flex-1 min-w-0 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-semibold text-blue-300"
    }), React.createElement(TurengLink, {
      word: x.lemma
    })), x.trSource && React.createElement("p", {
      className: "text-[10px] text-slate-500 -mt-0.5"
    }, "T\xFCrk\xE7e anlam kayna\u011F\u0131: ", x.trSource), x.definition && React.createElement("p", {
      className: "text-[11px] text-slate-400"
    }, React.createElement("span", {
      className: "text-slate-500"
    }, "EN:"), " ", x.definition), x.sentence && React.createElement("p", {
      className: "text-[11px] text-slate-300 font-serif italic"
    }, "\u201C", highlight(x.sentence, x.forms), "\u201D"), (x.examples || []).map((ex, i) => React.createElement("p", {
      key: i,
      className: "text-[11px] text-slate-400 font-serif"
    }, "\u2022 ", ex)), (x.synonyms || []).length > 0 && React.createElement("div", {
      className: "text-[11px]"
    }, React.createElement("span", {
      className: "text-slate-500 mr-1"
    }, "E\u015F anlaml\u0131:"), x.synonyms.map(s => chip(s, 'bg-emerald-950 text-emerald-300'))), (x.antonyms || []).length > 0 && React.createElement("div", {
      className: "text-[11px]"
    }, React.createElement("span", {
      className: "text-slate-500 mr-1"
    }, "Z\u0131t anlaml\u0131:"), x.antonyms.map(s => chip(s, 'bg-red-950 text-red-300'))), x.failed && React.createElement("p", {
      className: "text-[11px] text-amber-400"
    }, "Bilgiler al\u0131namad\u0131; yine de ekleyip sonra d\xFCzenleyebilirsiniz.")))));
  })), React.createElement("div", {
    className: "p-4 border-t border-slate-800 flex items-center justify-between gap-2"
  }, React.createElement("p", {
    className: "text-[10px] text-slate-500"
  }, "T\xFCrk\xE7e anlamlar: Wiktionary (CC BY-SA), yoksa MyMemory \xB7 Okunu\u015F/\xF6rnek: dictionaryapi.dev, Datamuse"), React.createElement("div", {
    className: "flex gap-2"
  }, React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
  }, "Kapat"), React.createElement("button", {
    onClick: handleAdd,
    disabled: !selected.length,
    className: "px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white disabled:opacity-50"
  }, selected.length ? selected.length + ' Kelimeyi Bankaya Ekle' : 'Kelime seçin')))));
}
function VocabAddModal({
  initialWord,
  initialSentence,
  onClose,
  onSave
}) {
  const [english, setEnglish] = useState(initialWord);
  const [turkish, setTurkish] = useState('');
  const [pos, setPos] = useState('noun');
  const [sentence, setSentence] = useState(initialSentence);
  const [qType, setQType] = useState('Kelime Soruları (1-6)');
  const [synonymsInput, setSynonymsInput] = useState('');
  const [antonymsInput, setAntonymsInput] = useState('');
  const [info, setInfo] = useState(null);
  const [lookup, setLookup] = useState('idle');
  const turkishTouched = useRef(false);
  const posTouched = useRef(false);
  const reqId = useRef(0);
  const runLookup = async (text, wantPos) => {
    const my = ++reqId.current;
    const raw = text.trim().toLowerCase();
    if (raw.length < 2) {
      setLookup('idle');
      setInfo(null);
      return;
    }
    setLookup('loading');
    try {
      let lemma = raw,
        guessPos = wantPos;
      if (/^[a-z][a-z'’-]*$/.test(raw)) {
        const r = await resolveLemma(raw).catch(() => null);
        if (r) {
          lemma = r.word;
          if (!wantPos) guessPos = posFor(lemma, [raw], r.info.tags);
        }
      }
      const usePos = wantPos || guessPos || 'noun';
      const d = await fetchWordDetails(lemma, usePos);
      if (my !== reqId.current) return;
      setInfo({
        ...d,
        lemma
      });
      if (!posTouched.current && ['noun', 'verb', 'adjective', 'adverb'].includes(d.partOfSpeech || usePos)) setPos(d.partOfSpeech || usePos);
      if (!turkishTouched.current) setTurkish(d.turkish || '');
      if (!synonymsInput && d.synonyms && d.synonyms.length) setSynonymsInput(d.synonyms.slice(0, 5).join(', '));
      if (!antonymsInput && d.antonyms && d.antonyms.length) setAntonymsInput(d.antonyms.slice(0, 4).join(', '));
      setLookup(d.turkish ? 'found' : 'notfound');
    } catch (e) {
      if (my !== reqId.current) return;
      setLookup('error');
    }
  };
  useEffect(() => {
    const t = setTimeout(() => runLookup(english, posTouched.current ? pos : null), 600);
    return () => clearTimeout(t);
  }, [english]);
  const onPosChange = v => {
    posTouched.current = true;
    setPos(v);
    if (v === 'prepositional_phrase') setQType('Gramer & Edat (7-16)');
    if (['noun', 'verb', 'adjective', 'adverb'].includes(v) && english.trim()) runLookup(english, v);
  };
  const handleSave = e => {
    e.preventDefault();
    if (!english.trim()) return;
    const newId = 'card_' + Date.now();
    const now = new Date().toISOString();
    const typed = english.trim();
    const isSingle = /^[A-Za-z][A-Za-z'’-]*$/.test(typed);
    const synList = synonymsInput ? synonymsInput.split(',').map(s => s.trim()).filter(Boolean) : info && info.synonyms || [];
    const antList = antonymsInput ? antonymsInput.split(',').map(s => s.trim()).filter(Boolean) : info && info.antonyms || [];
    onSave({
      id: newId,
      english: isSingle && info && info.lemma ? info.lemma : typed,
      lemma: info && info.lemma || typed.toLowerCase(),
      turkish: turkish.trim() || '(anlam bulunamadı – düzenleyin)',
      trSenses: info && info.trSenses || [],
      trSource: turkishTouched.current ? 'Elle' : info && info.trSource || '',
      ipa: info && info.ipa || '',
      okunus: info && info.okunus || '',
      audioUrl: info && info.audioUrl || '',
      definition: info && info.definition || '',
      examples: info && info.examples || [],
      synonyms: synList,
      antonyms: antList,
      questionType: qType,
      partOfSpeech: pos,
      originalSentence: sentence.trim(),
      sourceType: 'user_reading',
      isDifficult: false,
      srs: createSRS(newId),
      createdAt: now,
      updatedAt: now
    });
  };
  return React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  }, React.createElement("form", {
    onSubmit: handleSave,
    className: "bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-3 max-h-[92vh] overflow-y-auto"
  }, React.createElement("h3", {
    className: "font-bold text-base text-white"
  }, "Kelime Kart\u0131 Ekle"), React.createElement("input", {
    type: "text",
    autoFocus: !initialWord,
    placeholder: "\u0130ngilizce kelime/ifade (anlam\u0131 otomatik gelir)",
    "aria-label": "\u0130ngilizce kelime veya ifade",
    value: english,
    onChange: e => setEnglish(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }), React.createElement("div", {
    className: "space-y-1"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("input", {
    type: "text",
    placeholder: lookup === 'loading' ? 'Anlam aranıyor…' : 'Türkçe anlamı (otomatik)',
    "aria-label": "T\xFCrk\xE7e anlam\u0131",
    value: turkish,
    onChange: e => {
      turkishTouched.current = true;
      setTurkish(e.target.value);
    },
    className: "flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-blue-300"
  }), english.trim() && React.createElement(TurengLink, {
    word: info && info.lemma || english
  })), React.createElement("p", {
    role: "status",
    className: "text-[10px] " + ({
      loading: 'text-blue-300',
      found: 'text-emerald-400',
      notfound: 'text-amber-400',
      error: 'text-red-400'
    }[lookup] || 'text-slate-500')
  }, lookup === 'loading' && 'Anlam, okunuş ve örnekler aranıyor…', lookup === 'found' && '✓ Anlam otomatik bulundu' + (info && info.trSource ? ' (' + info.trSource + ')' : '') + (info && info.lemma && info.lemma !== english.trim().toLowerCase() ? ' · kök: ' + info.lemma : ''), lookup === 'notfound' && 'Otomatik anlam bulunamadı; yine de kaydedebilirsiniz (Kelime Kartları\'nda tekrar denenebilir).', lookup === 'error' && 'Bağlantı hatası; internetinizi kontrol edin.', lookup === 'idle' && 'Kelimeyi yazın, anlamı kendiliğinden gelecek.'), turkishTouched.current && lookup === 'found' && info && info.turkish && info.turkish !== turkish && React.createElement("button", {
    type: "button",
    onClick: () => {
      turkishTouched.current = false;
      setTurkish(info.turkish);
    },
    className: "text-[10px] text-blue-400 underline"
  }, "Otomatik anlam\u0131 geri getir: ", info.turkish)), info && (info.ipa || info.okunus || (info.synonyms || []).length || (info.trSenses || []).length > 1) && React.createElement("div", {
    className: "p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[11px]"
  }, React.createElement("div", {
    className: "flex flex-wrap items-center gap-2"
  }, React.createElement("button", {
    type: "button",
    onClick: () => playWord({
      english: info.lemma || english,
      audioUrl: info.audioUrl
    }),
    "aria-label": "Telaffuzu dinle",
    className: "text-blue-400"
  }, "\uD83D\uDD0A"), info.ipa && React.createElement("span", {
    className: "font-mono text-slate-400"
  }, "/", info.ipa, "/"), info.okunus && React.createElement("span", {
    className: "text-amber-300"
  }, "[", info.okunus, "]")), (info.trSenses || []).length > 1 && info.trSenses.slice(0, 3).map((s, i) => React.createElement("p", {
    key: i,
    className: "text-slate-400"
  }, s.pos && React.createElement("span", {
    className: "text-slate-500"
  }, "(", s.pos, ") "), s.sense && React.createElement("span", {
    className: "italic"
  }, s.sense, ": "), React.createElement("button", {
    type: "button",
    onClick: () => {
      turkishTouched.current = true;
      setTurkish(s.words.join(', '));
    },
    className: "text-blue-200 hover:underline",
    title: "Bu anlam\u0131 kullan"
  }, s.words.join(', ')))), info.definition && React.createElement("p", {
    className: "text-slate-400"
  }, React.createElement("span", {
    className: "text-slate-500"
  }, "EN:"), " ", info.definition), (info.examples || [])[0] && React.createElement("p", {
    className: "text-slate-400 font-serif"
  }, "\u2022 ", info.examples[0]), (info.synonyms || []).length > 0 && React.createElement("p", null, React.createElement("span", {
    className: "text-slate-500"
  }, "E\u015F:"), " ", React.createElement("span", {
    className: "text-emerald-300"
  }, info.synonyms.slice(0, 5).join(', '))), (info.antonyms || []).length > 0 && React.createElement("p", null, React.createElement("span", {
    className: "text-slate-500"
  }, "Z\u0131t:"), " ", React.createElement("span", {
    className: "text-red-300"
  }, info.antonyms.slice(0, 4).join(', ')))), React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] font-bold text-slate-400"
  }, "Kelime T\xFCr\xFC"), React.createElement("select", {
    value: pos,
    onChange: e => onPosChange(e.target.value),
    "aria-label": "Kelime t\xFCr\xFC",
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }, React.createElement("option", {
    value: "noun"
  }, "\u0130sim (Noun)"), React.createElement("option", {
    value: "verb"
  }, "Fiil (Verb)"), React.createElement("option", {
    value: "adjective"
  }, "S\u0131fat (Adjective)"), React.createElement("option", {
    value: "adverb"
  }, "Zarf (Adverb)"), React.createElement("option", {
    value: "collocation"
  }, "Kal\u0131p \u0130fade (Collocation)"), React.createElement("option", {
    value: "prepositional_phrase"
  }, "Edatl\u0131 Yap\u0131"))), React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] font-bold text-slate-400"
  }, "Y\xD6KD\u0130L Soru Tipi"), React.createElement("select", {
    value: qType,
    onChange: e => setQType(e.target.value),
    "aria-label": "Y\xD6KD\u0130L Soru Tipi",
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }, React.createElement("option", {
    value: "Kelime Sorular\u0131 (1-6)"
  }, "Kelime Sorular\u0131 (1-6)"), React.createElement("option", {
    value: "Gramer & Edat (7-16)"
  }, "Gramer & Edat (7-16)"), React.createElement("option", {
    value: "Cloze Test (17-26)"
  }, "Cloze Test (17-26)"), React.createElement("option", {
    value: "C\xFCmle Tamamlama (27-36)"
  }, "C\xFCmle Tamamlama (27-36)"), React.createElement("option", {
    value: "\xC7eviri Sorular\u0131 (37-48)"
  }, "\xC7eviri Sorular\u0131 (37-48)"), React.createElement("option", {
    value: "Paragraf Sorular\u0131 (49-80)"
  }, "Paragraf Sorular\u0131 (49-80)"), React.createElement("option", {
    value: "Genel Akademik"
  }, "Genel Akademik")))), React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] text-slate-400"
  }, "E\u015F Anlaml\u0131lar (virg\xFClle ay\u0131r\u0131n)"), React.createElement("input", {
    type: "text",
    placeholder: "e.g. lack, scarcity",
    value: synonymsInput,
    onChange: e => setSynonymsInput(e.target.value),
    className: "w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-emerald-300 placeholder:text-slate-600"
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] text-slate-400"
  }, "Z\u0131t Anlaml\u0131lar (virg\xFClle ay\u0131r\u0131n)"), React.createElement("input", {
    type: "text",
    placeholder: "e.g. abundance, surplus",
    value: antonymsInput,
    onChange: e => setAntonymsInput(e.target.value),
    className: "w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-red-300 placeholder:text-slate-600"
  }))), React.createElement("textarea", {
    rows: 3,
    placeholder: "Metindeki orijinal c\xFCmle",
    value: sentence,
    onChange: e => setSentence(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-serif"
  }), React.createElement("div", {
    className: "flex justify-end gap-2 pt-2"
  }, React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
  }, "\u0130ptal"), React.createElement("button", {
    type: "submit",
    disabled: !english.trim(),
    className: "px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white disabled:opacity-50"
  }, "Kaydet"))));
}
function UploadModal({
  weeks,
  onClose,
  onSave
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [weekId, setWeekId] = useState(weeks[0]?.id || '');
  const [category, setCategory] = useState('Fen Bilimleri');
  const [fileType, setFileType] = useState('manual');
  const [fileStatus, setFileStatus] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [forceOcr, setForceOcr] = useState(false);
  const ocrRef = useRef(null);
  const getOcrWorker = async () => {
    if (!window.Tesseract) throw new Error('Resim okuyucu (OCR) yüklenemedi (internet bağlantısını kontrol edin).');
    if (!ocrRef.current) {
      setFileStatus('Resim okuyucu hazırlanıyor (ilk seferde biraz sürebilir)...');
      ocrRef.current = await Tesseract.createWorker('eng');
    }
    return ocrRef.current;
  };
  const closeOcrWorker = async () => {
    if (ocrRef.current) {
      try {
        await ocrRef.current.terminate();
      } catch (e) {}
      ocrRef.current = null;
    }
  };
  useEffect(() => () => {
    closeOcrWorker();
  }, []);
  const ocrImage = async (image, label) => {
    const worker = await getOcrWorker();
    setFileStatus(label + ' okunuyor (OCR)...');
    let canvas = image;
    if (!(image instanceof HTMLCanvasElement)) {
      try {
        const bmp = await createImageBitmap(image instanceof Blob ? image : await (await fetch(image)).blob());
        canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext('2d').drawImage(bmp, 0, 0);
        canvas = upscaleForOcr(canvas);
      } catch (e) {
        canvas = null;
      }
    }
    const {
      data
    } = await worker.recognize(canvas || image, {}, {
      text: true,
      blocks: true
    });
    if (!data || !Array.isArray(data.blocks) || !data.blocks.length) return cleanOcrText(data && data.text ? data.text : '');
    return structureOcr(data.blocks, canvas, worker);
  };
  const filterWords = words => words.filter(w => isPlausibleWord(w.text, w.confidence)).map(w => ({
    w,
    t: cleanWordText(w.text)
  })).filter(p => p.t);
  const reocrLine = async (canvas, bbox, worker) => {
    const pad = Math.round((bbox.y1 - bbox.y0) * 0.3);
    const x = Math.max(0, bbox.x0 - pad),
      y = Math.max(0, bbox.y0 - pad);
    const w = Math.min(canvas.width - x, bbox.x1 - bbox.x0 + 2 * pad);
    const h = Math.min(canvas.height - y, bbox.y1 - bbox.y0 + 2 * pad);
    const empty = {
      text: '',
      avgConf: 0,
      n: 0
    };
    if (w < 10 || h < 10) return empty;
    const crop = document.createElement('canvas');
    crop.width = w * 2;
    crop.height = h * 2;
    const cctx = crop.getContext('2d');
    cctx.fillStyle = '#fff';
    cctx.fillRect(0, 0, crop.width, crop.height);
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(canvas, x, y, w, h, 0, 0, crop.width, crop.height);
    const variants = [null, {
      blur: 3,
      invert: true
    }, {
      blur: 4,
      invert: true
    }, {
      blur: 2,
      invert: false
    }];
    let best = empty;
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: '7'
      });
      for (const v of variants) {
        const img = v ? binarize(crop, v.blur, v.invert) : crop;
        const {
          data
        } = await worker.recognize(img, {}, {
          text: true,
          blocks: true
        });
        const words = [];
        (data && data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => words.push(...(l.words || [])))));
        const kept = filterWords(words).filter(p => p.w.confidence >= 50);
        const score = kept.reduce((s, p) => s + p.w.confidence, 0);
        if (score > (best.score || 0)) {
          best = {
            text: kept.map(p => p.t).join(' ').trim(),
            avgConf: score / kept.length,
            n: kept.length,
            score
          };
        }
      }
    } finally {
      await worker.setParameters({
        tessedit_pageseg_mode: '6'
      });
    }
    return best;
  };
  const binarize = (src, blur, invert) => {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.filter = blur ? 'blur(' + blur + 'px)' : 'none';
    g.drawImage(src, 0, 0);
    g.filter = 'none';
    const id = g.getImageData(0, 0, c.width, c.height),
      d = id.data,
      n = d.length / 4;
    const gray = new Uint8Array(n),
      hist = new Array(256).fill(0);
    for (let i = 0; i < n; i++) {
      const v = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114 | 0;
      gray[i] = v;
      hist[v]++;
    }
    let sumAll = 0;
    for (let t = 0; t < 256; t++) sumAll += t * hist[t];
    let sB = 0,
      wB = 0,
      bestVar = 0,
      thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = n - wB;
      if (!wF) break;
      sB += t * hist[t];
      const diff = sB / wB - (sumAll - sB) / wF,
        v = wB * wF * diff * diff;
      if (v > bestVar) {
        bestVar = v;
        thr = t;
      }
    }
    for (let i = 0; i < n; i++) {
      let v = gray[i] < thr ? 0 : 255;
      if (invert) v = 255 - v;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return c;
  };
  const keepOriginalDigits = (fresh, orig) => {
    const od = (orig.match(/\d/g) || []).join('');
    const fd = (fresh.match(/\d/g) || []).join('');
    if (!od || od.length !== fd.length || od === fd) return fresh;
    let k = 0;
    return fresh.replace(/\d/g, () => od[k++]);
  };
  const VALID_2 = new Set('am an as at be by do go he hi if in is it me my no of oh ok on or so to up us we ad ex id vs'.split(' '));
  const isPlausibleWord = (text, conf) => {
    if (/^[^A-Za-z0-9]+$/.test(text)) return /^[&—–]$/.test(text) && conf >= 80;
    if (conf >= 85) return true;
    const core = text.replace(/^[“”‘’"'(\[~*•+|\-]+/, '').replace(/[“”‘’"')\].,;:!?|]+$/, '');
    if (!core) return false;
    if (/^\d[\d.,%\-–/]*(s|st|nd|rd|th)?$/i.test(core)) return true;
    if (/^[A-Za-z]+\.[A-Za-z]+$/.test(core)) return core.split('.').every(p => isPlausibleWord(p, conf));
    const parts = core.split(/['’\-]/);
    if (!parts.every(p => /^[A-Za-z]+$/.test(p))) return false;
    const letters = parts.join('');
    if (letters.length === 1) return /^[aAI]$/.test(letters);
    if (/(.)\1\1/i.test(letters)) return false;
    const isCaps = letters === letters.toUpperCase();
    if (!parts.every(p => !p || p === p.toUpperCase() || /^[A-Za-z][a-z]*$/.test(p))) return false;
    if (isCaps && conf < 60) return false;
    if (letters.length === 2) return VALID_2.has(letters.toLowerCase());
    return /[aeiouy]/i.test(letters);
  };
  const cleanWordText = t => t.replace(/^[~*•+|¦]+/, '').replace(/^-+(?=[A-Za-z])/, '').replace(/[|¦]+$/, '').replace(/^([A-Za-z]+)\.([a-z]+)$/, '$1 $2');
  const median = arr => {
    const s = [...arr].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const structureOcr = async (blocks, canvas, worker) => {
    const lines = [];
    blocks.forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach((l, li) => {
      const pairs = filterWords(l.words || []);
      if (!pairs.length) return;
      const parts = pairs.map(p => p.t);
      const kept = pairs.map(p => p.w);
      const rest = parts.join(' ').slice(1);
      if (/^[“"]/.test(parts[0]) && !/[”"]/.test(rest)) parts[0] = parts[0].replace(/^[“"]+/, '');
      if (/^[‘']/.test(parts[0]) && !/[’'](?![A-Za-z])/.test(rest)) parts[0] = parts[0].replace(/^[‘']+/, '');
      const realWords = parts.join(' ').split(' ').filter(t => /[A-Za-z]{3,}/.test(t)).length;
      lines.push({
        lowConf: l.confidence < 40,
        realWords,
        bbox: l.bbox,
        cx1: (kept.filter(w => w.confidence >= 25).pop() || kept[kept.length - 1]).bbox.x1,
        text: parts.join(' ').trim(),
        h: l.bbox.y1 - l.bbox.y0,
        x0: kept[0].bbox.x0,
        x1: kept[kept.length - 1].bbox.x1,
        n: parts.length,
        paraStart: li === 0
      });
    })));
    if (!lines.length) return '';
    const medH0 = median(lines.filter(l => l.n >= 5).map(l => l.h)) || median(lines.map(l => l.h));
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (l.lowConf && l.realWords < 3 && !(l.h >= medH0 * 1.15 && l.realWords >= 1)) lines.splice(i, 1);
    }
    if (!lines.length) return '';
    const body = lines.filter(l => l.n >= 5);
    const ref = body.length ? body : lines;
    const medH = median(ref.map(l => l.h));
    const left = median(ref.map(l => l.x0));
    const right = median(ref.map(l => l.x1));
    const width = Math.max(1, right - left);
    const isHeading = l => l.n <= 12 && /[A-Za-z]{3,}/.test(l.text) && !/[.,;:!?]$/.test(l.text) && l.h >= medH * 1.15 && l.x1 < left + width * 0.85;
    const out = [];
    let para = '';
    let prev = null;
    const flush = () => {
      const p = para.trim().replace(/([.!?”"])\s+[A-Za-z0-9]$/, '$1');
      if (p) out.push(p);
      para = '';
    };
    const countWords = t => t.split(/\s+/).filter(x => /[A-Za-z]{2,}/.test(x)).length;
    for (let l of lines) {
      if (isHeading(l)) {
        flush();
        if (canvas && worker) {
          try {
            const again = await reocrLine(canvas, {
              x0: l.x0,
              x1: l.cx1,
              y0: l.bbox.y0,
              y1: l.bbox.y1
            }, worker);
            const before = countWords(l.text);
            if (again.text && again.avgConf >= 60 && countWords(again.text) >= Math.max(1, before - 1) && countWords(again.text) <= before + 4) {
              l = {
                ...l,
                text: keepOriginalDigits(again.text, l.text.replace(/(\s+[^\sA-Za-z]{1,2}|\s+\d)+$/, ''))
              };
            }
          } catch (e) {}
        }
        l = {
          ...l,
          text: l.text.replace(/(\s+[^\sA-Za-z]{1,2}|\s+\d)+$/, '').replace(/[\s:;,\-]+$/, '')
        };
        if (prev && prev.heading && out.length) out[out.length - 1] += ' ' + l.text;else out.push('## ' + l.text);
        prev = {
          ...l,
          heading: true
        };
        continue;
      }
      const newPara = !para || l.paraStart && prev && !prev.heading && /[.!?"”]$/.test(prev.text) || l.x0 - left > width * 0.025 || prev && /[.!?"”:]$/.test(prev.text) && prev.x1 < left + width * 0.85;
      if (newPara) flush();
      if (para && /[A-Za-z]-$/.test(para)) para = para.slice(0, -1) + l.text;else para += (para ? ' ' : '') + l.text;
      prev = {
        ...l,
        heading: false
      };
    }
    flush();
    return out.join('\n\n');
  };
  const cleanOcrText = raw => raw.replace(/\r/g, '').replace(/[ \t]*[|¦]+[ \t]*$/gm, '').replace(/^[ \t]*[|¦]+[ \t]*/gm, '').replace(/(\w)-\n(\w)/g, '$1$2').replace(/([^\n])\n(?!\n)/g, '$1 ').replace(/[ \t]{2,}/g, ' ').trim();
  const upscaleForOcr = canvas => {
    const scale = Math.max(1, Math.min(2.5, 2000 / canvas.width));
    if (scale <= 1.05) return canvas;
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  };
  const base64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const emfToCanvas = async bytes => {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let off = 0,
      best = null;
    while (off + 8 <= dv.byteLength) {
      const type = dv.getUint32(off, true),
        size = dv.getUint32(off + 4, true);
      if (size < 8 || off + size > dv.byteLength) break;
      let r = null;
      if (type === 81 || type === 80) {
        r = {
          bmi: dv.getUint32(off + 48, true),
          cbBmi: dv.getUint32(off + 52, true),
          bits: dv.getUint32(off + 56, true),
          cbBits: dv.getUint32(off + 60, true)
        };
      } else if ((type === 76 || type === 77) && size >= 100) {
        r = {
          bmi: dv.getUint32(off + 84, true),
          cbBmi: dv.getUint32(off + 88, true),
          bits: dv.getUint32(off + 92, true),
          cbBits: dv.getUint32(off + 96, true)
        };
      }
      if (r && r.cbBmi && r.cbBits && (!best || r.cbBits > best.cbBits)) {
        r.base = off;
        best = r;
      }
      if (type === 14) break;
      off += size;
    }
    if (!best) return null;
    const h = best.base + best.bmi;
    const bitsStart = best.base + best.bits;
    const biSize = dv.getUint32(h, true);
    const w = dv.getInt32(h + 4, true);
    const rawH = dv.getInt32(h + 8, true);
    const bpp = dv.getUint16(h + 14, true);
    const comp = dv.getUint32(h + 16, true);
    const H = Math.abs(rawH),
      topDown = rawH < 0;
    const canvas = document.createElement('canvas');
    if (comp === 4 || comp === 5) {
      const blob = new Blob([bytes.slice(bitsStart, bitsStart + best.cbBits)], {
        type: comp === 4 ? 'image/jpeg' : 'image/png'
      });
      const bmp = await createImageBitmap(blob);
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      return canvas;
    }
    if (!(comp === 0 || comp === 3) || ![1, 4, 8, 16, 24, 32].includes(bpp) || w <= 0 || H <= 0) return null;
    const clrUsed = dv.getUint32(h + 32, true);
    const nPal = bpp <= 8 ? clrUsed || 1 << bpp : 0;
    const palOff = h + biSize + (comp === 3 && biSize === 40 ? 12 : 0);
    const pal = [];
    for (let i = 0; i < nPal; i++) {
      const p = palOff + i * 4;
      pal.push([bytes[p + 2], bytes[p + 1], bytes[p]]);
    }
    const stride = (w * bpp + 31 >> 5) * 4;
    canvas.width = w;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, H);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      const row = bitsStart + (topDown ? y : H - 1 - y) * stride;
      for (let x = 0; x < w; x++) {
        let r, g, b;
        if (bpp === 32) {
          const p = row + x * 4;
          b = bytes[p];
          g = bytes[p + 1];
          r = bytes[p + 2];
        } else if (bpp === 24) {
          const p = row + x * 3;
          b = bytes[p];
          g = bytes[p + 1];
          r = bytes[p + 2];
        } else if (bpp === 16) {
          const v = bytes[row + x * 2] | bytes[row + x * 2 + 1] << 8;
          r = (v >> 10 & 31) << 3;
          g = (v >> 5 & 31) << 3;
          b = (v & 31) << 3;
        } else {
          let idx;
          if (bpp === 8) idx = bytes[row + x];else if (bpp === 4) idx = bytes[row + (x >> 1)] >> (x & 1 ? 0 : 4) & 15;else idx = bytes[row + (x >> 3)] >> 7 - (x & 7) & 1;
          [r, g, b] = pal[idx] || [0, 0, 0];
        }
        const q = (y * w + x) * 4;
        d[q] = r;
        d[q + 1] = g;
        d[q + 2] = b;
        d[q + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  };
  const looksGarbled = text => {
    const chars = text.replace(/\s/g, '');
    if (chars.length < 40) return false;
    const letters = (chars.match(/[A-Za-zÀ-ɏ]/g) || []).length;
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const withVowel = words.filter(w => /[aeiouyAEIOUY]/.test(w)).length;
    return letters / chars.length < 0.6 || words.length > 5 && withVowel / words.length < 0.5;
  };
  const pageHasImages = async page => {
    try {
      const ops = await page.getOperatorList({
        intent: 'print'
      });
      const O = pdfjsLib.OPS;
      return ops.fnArray.some(fn => fn === O.paintImageXObject || fn === O.paintInlineImageXObject || fn === O.paintImageMaskXObject || fn === O.paintJpegXObject);
    } catch (e) {
      return false;
    }
  };
  const extractPdfText = async buffer => {
    if (!window.pdfjsLib) throw new Error('PDF okuyucu yüklenemedi (internet bağlantısını kontrol edin).');
    const pdf = await pdfjsLib.getDocument({
      data: buffer
    }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      let text = tc.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join('').trim();
      const textLen = text.replace(/\s/g, '').length;
      const needOcr = forceOcr || textLen < 20 || looksGarbled(text) || textLen < 400 && (await pageHasImages(page));
      if (needOcr) {
        const viewport = page.getViewport({
          scale: 2
        });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          intent: 'print'
        }).promise;
        const ocrText = await ocrImage(canvas, 'Sayfa ' + i + '/' + pdf.numPages);
        if (forceOcr || ocrText.replace(/\s/g, '').length >= textLen || looksGarbled(text)) text = ocrText;
      }
      pages.push(text);
    }
    return pages.join('\n\n');
  };
  const extractDocxText = async buffer => {
    if (!window.mammoth) throw new Error('Word okuyucu yüklenemedi (internet bağlantısını kontrol edin).');
    const result = await mammoth.convertToHtml({
      arrayBuffer: buffer
    }, {
      convertImage: mammoth.images.imgElement(img => img.read('base64').then(b64 => ({
        src: 'data:' + img.contentType + ';base64,' + b64
      })))
    });
    const doc = new DOMParser().parseFromString(result.value, 'text/html');
    const imgs = [...doc.querySelectorAll('img')];
    for (let i = 0; i < imgs.length; i++) {
      let t = '';
      const label = 'Belgedeki resim ' + (i + 1) + '/' + imgs.length;
      try {
        const src = imgs[i].getAttribute('src') || '';
        const m = src.match(/^data:([^;]+);base64,(.*)$/);
        const type = m ? m[1].toLowerCase() : '';
        if (/emf/.test(type)) {
          const canvas = await emfToCanvas(base64ToBytes(m[2]));
          if (canvas) t = await ocrImage(upscaleForOcr(canvas), label);
        } else if (/wmf/.test(type)) {
          t = '';
        } else {
          const bmp = await createImageBitmap(await (await fetch(src)).blob());
          const c = document.createElement('canvas');
          c.width = bmp.width;
          c.height = bmp.height;
          c.getContext('2d').drawImage(bmp, 0, 0);
          t = await ocrImage(upscaleForOcr(c), label);
        }
      } catch (e) {
        if (!window.Tesseract) throw e;
      }
      imgs[i].replaceWith(doc.createTextNode(t ? '\n' + t + '\n' : ''));
    }
    const blocks = [...doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th')].filter(el => !el.querySelector('p, li, td, th'));
    const asText = el => {
      const t = el.textContent.trim();
      if (!t) return '';
      if (/^H[1-6]$/.test(el.tagName)) return '## ' + t.replace(/\n+/g, ' ');
      const strong = [...el.querySelectorAll('strong, b')].map(s => s.textContent).join('').trim();
      if (el.tagName === 'P' && t.length <= 120 && !/\n/.test(t) && strong === t) return '## ' + t;
      return t;
    };
    const text = blocks.length ? blocks.map(asText).filter(Boolean).join('\n\n') : doc.body.textContent;
    return text;
  };
  const readFileText = async file => {
    const ext = file.name.split('.').pop().toLowerCase();
    let text = '';
    if (ext === 'pdf') text = await extractPdfText(await file.arrayBuffer());else if (ext === 'docx') text = await extractDocxText(await file.arrayBuffer());else if (ext === 'txt') text = await file.text();else if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext) || (file.type || '').startsWith('image/')) text = await ocrImage(file, 'Resim');else if (ext === 'doc') throw new Error('Eski .doc biçimi desteklenmiyor. Word\'de "Farklı Kaydet > .docx" ile kaydedin.');else throw new Error('Desteklenmeyen dosya türü (PDF, Word .docx, resim veya .txt seçin).');
    text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    text = text.replace(/([a-z,;])\n\n(?!## )([a-z])/g, '$1 $2');
    if (!text) throw new Error('Okunabilir metin bulunamadı. Görüntü bulanık veya çok küçük olabilir.');
    return {
      text,
      ext
    };
  };
  const countWordsOf = t => t.replace(/^##\s+/gm, '').trim().split(/\s+/).filter(Boolean).length;
  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [mergeDocs, setMergeDocs] = useState(false);
  const [mergeTitle, setMergeTitle] = useState('');
  const updateDoc = (id, patch) => setDocs(prev => prev.map(d => d.id === id ? {
    ...d,
    ...patch
  } : d));
  const selectedDoc = docs.find(d => d.id === selectedDocId) || null;
  const queueMode = docs.length > 0;
  const handleFile = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const stamp = Date.now();
    const added = files.map((f, i) => ({
      id: 'doc_' + stamp + '_' + i,
      file: f,
      name: f.name,
      title: f.name.replace(/\.[^.]+$/, ''),
      text: '',
      ext: f.name.split('.').pop().toLowerCase(),
      status: 'waiting',
      error: ''
    }));
    const manual = !queueMode && content.trim() ? [{
      id: 'doc_' + stamp + '_m',
      name: 'Elle girilen metin',
      title: title.trim() || 'Elle girilen metin',
      text: content.trim(),
      ext: fileType,
      status: 'ready',
      error: ''
    }] : [];
    setDocs(prev => [...prev, ...manual, ...added.map(({
      file,
      ...d
    }) => d)]);
    if (!selectedDocId) setSelectedDocId((manual[0] || added[0]).id);
    setIsReadingFile(true);
    try {
      for (let i = 0; i < added.length; i++) {
        const d = added[i];
        updateDoc(d.id, {
          status: 'reading'
        });
        setFileStatus((added.length > 1 ? '(' + (i + 1) + '/' + added.length + ') ' : '') + '"' + d.name + '" okunuyor...');
        try {
          const {
            text,
            ext
          } = await readFileText(d.file);
          updateDoc(d.id, {
            status: 'ready',
            text,
            ext
          });
        } catch (err) {
          updateDoc(d.id, {
            status: 'error',
            error: err && err.message ? err.message : 'Dosya okunamadı.'
          });
        }
      }
      setFileStatus(added.length > 1 ? added.length + ' dosya işlendi.' : '"' + added[0].name + '" işlendi.');
    } finally {
      await closeOcrWorker();
      setIsReadingFile(false);
    }
  };
  const removeDoc = id => {
    setDocs(prev => {
      const next = prev.filter(d => d.id !== id);
      if (selectedDocId === id) setSelectedDocId(next[0] ? next[0].id : null);
      return next;
    });
  };
  const clearAll = () => {
    setDocs([]);
    setSelectedDocId(null);
    setContent('');
    setFileType('manual');
    setFileStatus('');
  };
  const readyDocs = docs.filter(d => d.status === 'ready' && d.text.trim());
  const makeReading = (t, text, type, i) => ({
    id: 'reading_' + Date.now() + '_' + i,
    title: t,
    content: text,
    weekId,
    category,
    wordCount: countWordsOf(text),
    savedWordIds: [],
    fileType: type,
    dateAdded: new Date().toISOString()
  });
  const handleSave = e => {
    e.preventDefault();
    if (isReadingFile) return;
    if (!queueMode) {
      if (!title.trim() || !content.trim()) return;
      onSave([makeReading(title.trim(), content.trim(), fileType, 0)]);
      return;
    }
    if (!readyDocs.length) return;
    if (mergeDocs && readyDocs.length > 1) {
      const merged = readyDocs.map(d => (/^##\s/.test(d.text) ? '' : '## ' + d.title + '\n\n') + d.text).join('\n\n');
      const t = mergeTitle.trim() || readyDocs.map(d => d.title).join(' + ');
      onSave([makeReading(t, merged, 'merged', 0)]);
    } else {
      onSave(readyDocs.map((d, i) => makeReading(d.title.trim() || d.name, d.text.trim(), d.ext, i)));
    }
  };
  const statusBadge = d => ({
    waiting: React.createElement("span", {
      className: "text-slate-500"
    }, "bekliyor"),
    reading: React.createElement("span", {
      className: "text-blue-300"
    }, "okunuyor\u2026"),
    ready: React.createElement("span", {
      className: "text-emerald-400"
    }, countWordsOf(d.text), " kelime"),
    error: React.createElement("span", {
      className: "text-red-400",
      title: d.error
    }, "hata")
  })[d.status];
  return React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  }, React.createElement("form", {
    onSubmit: handleSave,
    className: "bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-lg w-full space-y-3 max-h-[92vh] overflow-y-auto"
  }, React.createElement("h3", {
    className: "font-bold text-base text-white"
  }, "\u0130ngilizce Okuma Metni Y\xFCkle"), !queueMode && React.createElement("input", {
    type: "text",
    placeholder: "Ba\u015Fl\u0131k (\xD6rn: Reading 1: Technology)",
    value: title,
    onChange: e => setTitle(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }), React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, React.createElement("select", {
    value: weekId,
    onChange: e => setWeekId(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }, weeks.map(w => React.createElement("option", {
    key: w.id,
    value: w.id
  }, w.title))), React.createElement("select", {
    value: category,
    onChange: e => setCategory(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }, React.createElement("option", {
    value: "Fen Bilimleri"
  }, "Fen Bilimleri"), React.createElement("option", {
    value: "Sa\u011Fl\u0131k Bilimleri"
  }, "Sa\u011Fl\u0131k Bilimleri"), React.createElement("option", {
    value: "Sosyal Bilimler"
  }, "Sosyal Bilimler"), React.createElement("option", {
    value: "Genel Akademik"
  }, "Genel Akademik"))), React.createElement("label", {
    className: "flex flex-col items-center justify-center gap-1 w-full px-3 py-4 rounded-lg border-2 border-dashed cursor-pointer transition " + (isReadingFile ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:border-blue-500 hover:bg-slate-800/60")
  }, React.createElement("span", {
    className: "text-xs font-bold text-white"
  }, isReadingFile ? 'Dosyalar okunuyor...' : queueMode ? '+ Başka dosya ekle' : 'PDF, Word veya resim dosyaları seç'), React.createElement("span", {
    className: "text-[11px] text-slate-400"
  }, "Birden \xE7ok dosya se\xE7ebilirsiniz (Ctrl/Shift ile) \xB7 .pdf, .docx, .jpg, .png, .txt"), React.createElement("input", {
    type: "file",
    multiple: true,
    accept: ".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
    onChange: handleFile,
    disabled: isReadingFile,
    className: "hidden"
  })), queueMode && React.createElement("div", {
    className: "rounded-lg border border-slate-800 divide-y divide-slate-800 max-h-44 overflow-y-auto"
  }, docs.map((d, i) => React.createElement("div", {
    key: d.id,
    onClick: () => setSelectedDocId(d.id),
    className: "flex items-center gap-2 px-3 py-2 text-[11px] cursor-pointer " + (d.id === selectedDocId ? "bg-blue-600/15" : "hover:bg-slate-800/60")
  }, React.createElement("span", {
    className: "text-slate-500 w-4 text-right"
  }, i + 1), React.createElement("span", {
    className: "flex-1 truncate text-slate-200",
    title: d.name
  }, d.title || d.name), statusBadge(d), React.createElement("button", {
    type: "button",
    onClick: ev => {
      ev.stopPropagation();
      removeDoc(d.id);
    },
    disabled: d.status === 'reading',
    "aria-label": '"' + d.name + '" dosyasını listeden çıkar',
    title: "Listeden \xE7\u0131kar",
    className: "px-1.5 rounded text-slate-500 hover:bg-red-600 hover:text-white disabled:opacity-30"
  }, "\u2715")))), queueMode && docs.length > 1 && React.createElement("div", {
    className: "space-y-2"
  }, React.createElement("label", {
    className: "flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none"
  }, React.createElement("input", {
    type: "checkbox",
    checked: mergeDocs,
    onChange: e => setMergeDocs(e.target.checked),
    className: "accent-blue-500"
  }), "Hepsini tek metinde birle\u015Ftir (i\u015Faretlenmezse her dosya ayr\u0131 metin olarak kaydedilir)"), mergeDocs && React.createElement("input", {
    type: "text",
    placeholder: "Birle\u015Fik metnin ba\u015Fl\u0131\u011F\u0131 (bo\u015F b\u0131rak\u0131l\u0131rsa dosya adlar\u0131 kullan\u0131l\u0131r)",
    value: mergeTitle,
    onChange: e => setMergeTitle(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  })), React.createElement("label", {
    className: "flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none"
  }, React.createElement("input", {
    type: "checkbox",
    checked: forceOcr,
    onChange: e => setForceOcr(e.target.checked),
    disabled: isReadingFile,
    className: "accent-blue-500"
  }), "PDF'in t\xFCm sayfalar\u0131n\u0131 resim olarak oku (metin eksik veya bozuk \xE7\u0131k\u0131yorsa i\u015Faretleyin)"), fileStatus && React.createElement("p", {
    className: "text-[11px] " + (fileStatus.startsWith('Hata') ? "text-red-400" : isReadingFile ? "text-blue-300" : "text-emerald-400")
  }, fileStatus), queueMode ? selectedDoc && React.createElement("div", {
    className: "space-y-2"
  }, React.createElement("input", {
    type: "text",
    placeholder: "Bu metnin ba\u015Fl\u0131\u011F\u0131",
    value: selectedDoc.title,
    onChange: e => updateDoc(selectedDoc.id, {
      title: e.target.value
    }),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }), selectedDoc.status === 'error' ? React.createElement("p", {
    className: "text-[11px] text-red-400"
  }, "Hata: ", selectedDoc.error) : React.createElement("textarea", {
    rows: 7,
    placeholder: selectedDoc.status === 'ready' ? '' : 'Dosya okunuyor, metin birazdan burada görünecek...',
    value: selectedDoc.text,
    disabled: selectedDoc.status !== 'ready',
    onChange: e => updateDoc(selectedDoc.id, {
      text: e.target.value
    }),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-serif leading-relaxed disabled:opacity-60"
  })) : React.createElement("textarea", {
    rows: 7,
    placeholder: "İngilizce metni buraya yapıştırın veya yukarıdan dosya seçin...\n\nBaşlık satırlarını \"## \" ile başlatın; okuma ekranında kalın gösterilir.",
    value: content,
    onChange: e => setContent(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-serif leading-relaxed"
  }), React.createElement("div", {
    className: "flex justify-end gap-2 pt-2"
  }, (queueMode || content) && React.createElement("button", {
    type: "button",
    onClick: clearAll,
    disabled: isReadingFile,
    className: "mr-auto px-4 py-2 rounded-lg bg-slate-800 text-xs text-red-400 hover:bg-red-600 hover:text-white disabled:opacity-50"
  }, queueMode ? 'Listeyi Temizle' : 'Metni Temizle'), React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
  }, "\u0130ptal"), React.createElement("button", {
    type: "submit",
    disabled: isReadingFile || queueMode && !readyDocs.length,
    className: "px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white disabled:opacity-50"
  }, !queueMode ? 'Metni Kaydet' : mergeDocs && readyDocs.length > 1 ? 'Birleştirip Kaydet' : readyDocs.length > 1 ? readyDocs.length + ' Metni Kaydet' : 'Metni Kaydet'))));
}
function UploadExamModal({
  onClose,
  onSave
}) {
  const [title, setTitle] = useState('');
  const [field, setField] = useState('Fen Bilimleri');
  const [year, setYear] = useState(new Date().getFullYear());
  const [term, setTerm] = useState('İlkbahar');
  const [mode, setMode] = useState('file');
  const [fileStatus, setFileStatus] = useState('');
  const [rawText, setRawText] = useState('');
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const extractPdfTextSimple = async buffer => {
    if (!window.pdfjsLib) throw new Error('PDF okuyucu kütüphanesi hazır değil.');
    const pdf = await pdfjsLib.getDocument({
      data: buffer
    }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const text = tc.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join('');
      pages.push(text);
    }
    return pages.join('\n\n');
  };
  const handleFileChange = async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setIsParsing(true);
    setFileStatus(`"${file.name}" okunuyor ve sorular taranıyor...`);
    try {
      if (!title) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(cleanName);
      }
      const buffer = await file.arrayBuffer();
      let text = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfTextSimple(buffer);
      } else if (file.name.toLowerCase().endsWith('.docx') && window.mammoth) {
        const res = await mammoth.extractRawText({
          arrayBuffer: buffer
        });
        text = res.value;
      } else {
        text = new TextDecoder('utf-8').decode(buffer);
      }
      setRawText(text);
      const qs = parseYokdilExamText(text, answerKeyText);
      setParsedQuestions(qs);
      setFileStatus(`✓ Dosya başarıyla okundu: ${qs.length} soru ayrıştırıldı.`);
    } catch (err) {
      console.error(err);
      setFileStatus('❌ Hata: ' + (err.message || 'Dosya okunamadı.'));
    } finally {
      setIsParsing(false);
    }
  };
  const handleTextChange = txt => {
    setRawText(txt);
    if (txt.trim().length > 30) {
      const qs = parseYokdilExamText(txt, answerKeyText);
      setParsedQuestions(qs);
    } else {
      setParsedQuestions([]);
    }
  };
  const handleKeyChange = keys => {
    setAnswerKeyText(keys);
    if (rawText.trim().length > 30) {
      const qs = parseYokdilExamText(rawText, keys);
      setParsedQuestions(qs);
    }
  };
  const handleSave = e => {
    e.preventDefault();
    if (!parsedQuestions.length) return;
    const examId = 'exam_' + Date.now();
    const newExam = {
      id: examId,
      title: title.trim() || `${year} ${term} YÖKDİL ${field}`,
      field,
      year: parseInt(year, 10) || new Date().getFullYear(),
      term,
      questions: parsedQuestions,
      uploadedAt: new Date().toISOString()
    };
    onSave(newExam);
  };
  const categoriesCount = {};
  parsedQuestions.forEach(q => {
    categoriesCount[q.category] = (categoriesCount[q.category] || 0) + 1;
  });
  return React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  }, React.createElement("form", {
    onSubmit: handleSave,
    className: "bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 max-h-[92vh] overflow-y-auto"
  }, React.createElement("div", {
    className: "flex items-center justify-between border-b border-slate-800 pb-3"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "font-bold text-base text-white"
  }, "\uD83D\uDCC4 Y\xD6KD\u0130L \xC7\u0131km\u0131\u015F S\u0131nav / Deneme Y\xFCkle"), React.createElement("p", {
    className: "text-xs text-slate-400 mt-0.5"
  }, "Ge\xE7mi\u015F y\u0131l s\u0131nav PDF'ini y\xFCkleyin; sorular, \u015F\u0131klar ve soru tipleri otomatik ayr\u0131\u015Ft\u0131r\u0131l\u0131r.")), React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "text-slate-400 hover:text-white text-sm"
  }, "\u2715")), React.createElement("div", {
    className: "grid grid-cols-1 sm:grid-cols-3 gap-2"
  }, React.createElement("div", {
    className: "sm:col-span-3"
  }, React.createElement("label", {
    className: "text-[10px] font-bold text-slate-400"
  }, "S\u0131nav Ad\u0131"), React.createElement("input", {
    type: "text",
    placeholder: "\xD6rn: 2023 \u0130lkbahar Y\xD6KD\u0130L Sa\u011Fl\u0131k Bilimleri",
    value: title,
    onChange: e => setTitle(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] font-bold text-slate-400"
  }, "Alan"), React.createElement("select", {
    value: field,
    onChange: e => setField(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }, React.createElement("option", {
    value: "Fen Bilimleri"
  }, "Fen Bilimleri"), React.createElement("option", {
    value: "Sa\u011Fl\u0131k Bilimleri"
  }, "Sa\u011Fl\u0131k Bilimleri"), React.createElement("option", {
    value: "Sosyal Bilimler"
  }, "Sosyal Bilimler"), React.createElement("option", {
    value: "Genel"
  }, "Genel"))), React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] font-bold text-slate-400"
  }, "Y\u0131l"), React.createElement("input", {
    type: "number",
    value: year,
    onChange: e => setYear(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-[10px] font-bold text-slate-400"
  }, "D\xF6nem"), React.createElement("select", {
    value: term,
    onChange: e => setTerm(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }, React.createElement("option", {
    value: "\u0130lkbahar"
  }, "\u0130lkbahar"), React.createElement("option", {
    value: "Sonbahar"
  }, "Sonbahar")))), React.createElement("div", {
    className: "flex gap-2 border-b border-slate-800 pb-2"
  }, React.createElement("button", {
    type: "button",
    onClick: () => setMode('file'),
    className: "px-3 py-1.5 rounded-lg text-xs font-bold transition " + (mode === 'file' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')
  }, "\uD83D\uDCCE PDF / Word Dosyas\u0131 Y\xFCkle"), React.createElement("button", {
    type: "button",
    onClick: () => setMode('paste'),
    className: "px-3 py-1.5 rounded-lg text-xs font-bold transition " + (mode === 'paste' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300')
  }, "\uD83D\uDCDD Metin / Sorular\u0131 Yap\u0131\u015Ft\u0131r")), mode === 'file' ? React.createElement("div", {
    className: "p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-center space-y-2"
  }, React.createElement("input", {
    type: "file",
    id: "examFileInput",
    accept: ".pdf,.docx,.txt",
    onChange: handleFileChange,
    className: "hidden"
  }), React.createElement("label", {
    htmlFor: "examFileInput",
    className: "cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow"
  }, "\uD83D\uDCC1 PDF veya Word Se\xE7"), React.createElement("p", {
    className: "text-[11px] text-slate-400"
  }, "Y\xD6KD\u0130L s\u0131nav kitap\xE7\u0131\u011F\u0131 PDF'ini se\xE7in (metinler otomatik ayr\u0131\u015Ft\u0131r\u0131l\u0131r)."), fileStatus && React.createElement("p", {
    className: "text-xs font-bold " + (fileStatus.startsWith('✓') ? 'text-emerald-400' : fileStatus.startsWith('❌') ? 'text-red-400' : 'text-blue-300')
  }, fileStatus)) : React.createElement("div", {
    className: "space-y-1"
  }, React.createElement("label", {
    className: "text-[10px] font-bold text-slate-400"
  }, "Soru Metinleri"), React.createElement("textarea", {
    rows: 6,
    placeholder: "Sorular\u0131 buraya yap\u0131\u015Ft\u0131r\u0131n (\xD6rn: 1. The recent... A) ... B) ...)",
    value: rawText,
    onChange: e => handleTextChange(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-mono"
  })), React.createElement("div", {
    className: "space-y-1"
  }, React.createElement("label", {
    className: "text-[10px] font-bold text-slate-400"
  }, "Cevap Anahtar\u0131 (Opsiyonel)"), React.createElement("input", {
    type: "text",
    placeholder: "\xD6rn: 1-A 2-C 3-D 4-E 5-B... (Metin sonunda veya PDF'te varsa otomatik e\u015Fle\u015Fir)",
    value: answerKeyText,
    onChange: e => handleKeyChange(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white font-mono"
  })), parsedQuestions.length > 0 && React.createElement("div", {
    className: "p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("span", {
    className: "text-xs font-bold text-emerald-400"
  }, "\u2713 Toplam ", parsedQuestions.length, " soru ba\u015Far\u0131yla ayr\u0131\u015Ft\u0131r\u0131ld\u0131"), React.createElement("button", {
    type: "button",
    onClick: () => setShowPreview(!showPreview),
    className: "text-[11px] text-blue-400 hover:underline font-bold"
  }, showPreview ? 'Önizlemeyi Gizle' : 'Soruları Önizle (' + parsedQuestions.length + ')')), React.createElement("div", {
    className: "flex flex-wrap gap-1.5 pt-1"
  }, Object.entries(categoriesCount).map(([cat, cnt]) => React.createElement("span", {
    key: cat,
    className: "text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
  }, cat.split(' ')[0], ": ", React.createElement("b", null, cnt))), React.createElement("span", {
    className: "text-[10px] px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800"
  }, "Cevab\u0131 Bilinen: ", React.createElement("b", null, parsedQuestions.filter(q => q.answer >= 0).length, " / ", parsedQuestions.length))), showPreview && React.createElement("div", {
    className: "mt-3 max-h-56 overflow-y-auto space-y-2 border-t border-slate-800 pt-2 text-xs"
  }, parsedQuestions.slice(0, 30).map(q => React.createElement("div", {
    key: q.num,
    className: "p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1"
  }, React.createElement("div", {
    className: "flex items-center justify-between text-[11px]"
  }, React.createElement("span", {
    className: "font-bold text-white"
  }, "Soru ", q.num), React.createElement("span", {
    className: "text-indigo-400 font-semibold"
  }, q.category), q.correctLetter && React.createElement("span", {
    className: "text-emerald-400 font-bold"
  }, "Cevap: ", q.correctLetter)), React.createElement("p", {
    className: "text-slate-300 font-serif line-clamp-2"
  }, q.prompt), React.createElement("div", {
    className: "grid grid-cols-2 sm:grid-cols-5 gap-1 text-[10px] text-slate-400 font-mono"
  }, q.options.map((opt, oi) => React.createElement("span", {
    key: oi,
    className: q.answer === oi ? 'text-emerald-300 font-bold' : ''
  }, ['A', 'B', 'C', 'D', 'E'][oi], ") ", opt))))), parsedQuestions.length > 30 && React.createElement("p", {
    className: "text-[10px] text-slate-500 text-center"
  }, "...ve ", parsedQuestions.length - 30, " soru daha"))), React.createElement("div", {
    className: "flex justify-end gap-2 pt-2 border-t border-slate-800"
  }, React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
  }, "\u0130ptal"), React.createElement("button", {
    type: "submit",
    disabled: !parsedQuestions.length,
    className: "px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white hover:bg-blue-500 disabled:opacity-50"
  }, parsedQuestions.length ? `${parsedQuestions.length} Soruyu Sınav Bankasına Ekle` : 'Dosya Bekleniyor'))));
}
function WeekAddModal({
  onClose,
  onSave
}) {
  const [title, setTitle] = useState(`1. Hafta – ${new Date().toLocaleDateString('tr-TR')}`);
  return React.createElement("div", {
    className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
  }, React.createElement("div", {
    className: "bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-3"
  }, React.createElement("h3", {
    className: "font-bold text-base text-white"
  }, "Yeni Hafta Olu\u015Ftur"), React.createElement("input", {
    type: "text",
    value: title,
    onChange: e => setTitle(e.target.value),
    className: "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
  }), React.createElement("div", {
    className: "flex justify-end gap-2 pt-2"
  }, React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
  }, "\u0130ptal"), React.createElement("button", {
    type: "button",
    onClick: () => {
      if (!title.trim()) return;
      onSave({
        id: 'week_' + Date.now(),
        title: title.trim(),
        startDate: getTodayStr(),
        readingIds: [],
        archived: false
      });
    },
    className: "px-5 py-2 rounded-lg bg-blue-600 font-bold text-xs text-white"
  }, "Olu\u015Ftur"))));
}
function Root() {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    loadAllData().then(setLoaded);
  }, []);
  if (!loaded) {
    return React.createElement("div", {
      className: "h-screen flex items-center justify-center text-slate-400 text-sm gap-3"
    }, React.createElement("span", {
      className: "w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
    }), "Verileriniz y\xFCkleniyor\u2026");
  }
  return React.createElement(App, {
    initial: loaded.data,
    storageMode: loaded.mode
  });
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(Root, null));
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  const registerSW = () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker kaydedilemedi:', e));
  if (document.readyState === 'complete') registerSW();else window.addEventListener('load', registerSW);
}