// ── Guest progress (localStorage) ──────────────────────────────────

function getGuestProgress() {
  try {
    const raw = localStorage.getItem('guest_progress');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setGuestProgress(progress) {
  localStorage.setItem('guest_progress', JSON.stringify(progress));
}

export function clearGuestProgress() {
  localStorage.removeItem('guest_progress');
}

export function isGuest() {
  return !sessionStorage.getItem('access_token') && !!getGuestProgress();
}

// ── Auth helpers ────────────────────────────────────────────────────

function getToken() {
  return sessionStorage.getItem('access_token');
}

export function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

// ── Main auth check ─────────────────────────────────────────────────

export async function ensureLoggedIn() {
  const token = getToken();

  if (!token) {
    const guestProgress = getGuestProgress();
    if (guestProgress) {
      const guestPlayer = {
        username: 'Guest',
        current_level: guestProgress.current_level ?? 1,
        unlocked_levels: guestProgress.unlocked_levels ?? 1,
        money: guestProgress.money ?? 100,
        is_guest: true,
      };
      sessionStorage.setItem('player', JSON.stringify(guestPlayer));
      updateHUD(guestPlayer, true);
      return true;
    }
    window.location.href = '/login.html';
    return false;
  }

  const res = await fetch('/api/me', { headers: authHeaders() });
  if (!res.ok) {
    sessionStorage.removeItem('access_token');
    window.location.href = '/login.html';
    return false;
  }

  const player = await res.json();
  sessionStorage.setItem('player', JSON.stringify(player));
  updateHUD(player, false);
  return true;
}

function updateHUD(player, guest) {
  const moneyEl = document.getElementById('moneyAmount');
  if (moneyEl) moneyEl.textContent = `${player.money}€`;

  const guestBtn = document.getElementById('guestSignInBtn');
  const authBtn = document.getElementById('authButton');
  const authLabel = authBtn?.querySelector('span');

  if (guest) {
    if (guestBtn) guestBtn.style.display = 'flex';
    if (authLabel) authLabel.textContent = 'Sign In';
    if (authBtn) authBtn.onclick = () => { window.location.href = '/login.html'; };
  } else {
    if (guestBtn) guestBtn.style.display = 'none';
    if (authLabel) authLabel.textContent = 'Logout';
    if (authBtn) authBtn.onclick = logout;
  }
}

function logout() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('player');
  window.location.href = '/login.html';
}
