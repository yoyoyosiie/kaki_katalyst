// Remembers which kanji you've finished, on this device only.
// localStorage can be unavailable (private browsing, blocked storage), so
// every access is wrapped: the app still works, it just won't remember.

const KEY = 'kaki.covered';

export function getCovered() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function markCovered(char) {
  const covered = getCovered();
  covered.add(char);
  try {
    localStorage.setItem(KEY, JSON.stringify([...covered]));
  } catch { /* storage unavailable: progress just isn't saved */ }
  return covered;
}

export function resetProgress() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// ---- imported deck ---------------------------------------------------------
// Lessons built from your Anki export live on this device only, so the deck
// itself never goes into the (public) repository.

const LESSONS_KEY = 'kaki.lessons';

export function getImportedLessons() {
  try {
    const saved = JSON.parse(localStorage.getItem(LESSONS_KEY) || 'null');
    return Array.isArray(saved) && saved.length ? saved : null;
  } catch {
    return null;
  }
}

// Returns false if the browser refused to store them (they still work until
// the page is closed).
export function saveImportedLessons(lessons) {
  try {
    localStorage.setItem(LESSONS_KEY, JSON.stringify(lessons));
    return true;
  } catch {
    return false;
  }
}
