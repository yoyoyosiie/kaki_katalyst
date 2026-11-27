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
