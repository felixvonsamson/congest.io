const TOTAL_LEVELS = 37;

let leaderboardData = [];
let sortState = { col: 'daily_streak', dir: 'desc' };

function sortData() {
  const { col, dir } = sortState;
  return [...leaderboardData].sort((a, b) => {
    let va = a[col] ?? 0;
    let vb = b[col] ?? 0;
    if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return dir === 'asc' ? va - vb : vb - va;
  });
}

function updateSortHeaders() {
  document.querySelectorAll('#leaderboardTable [data-col]').forEach(th => {
    if (th.dataset.col === sortState.col) {
      th.classList.add('text-white');
    } else {
      th.classList.remove('text-white');
    }
  });
}

function renderRows() {
  const player = JSON.parse(sessionStorage.getItem('player'));
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = '';

  sortData().forEach((entry, i) => {
    const isMe = entry.username === player?.username;
    const rank = i + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const campaign = `${entry.unlocked_levels}/${TOTAL_LEVELS}`;
    const streak = entry.daily_streak > 0 ? entry.daily_streak : '—';
    const daily = entry.daily_solved_count > 0 ? entry.daily_solved_count : '—';

    const tr = document.createElement('tr');
    tr.className = `border-b border-white/[0.04] transition-colors ${isMe ? 'bg-blue-600/10' : 'hover:bg-white/[0.03]'}`;
    tr.innerHTML = `
      <td class="px-5 py-3 text-gray-400 font-medium">${medal}</td>
      <td class="px-5 py-3 font-semibold ${isMe ? 'text-blue-300' : 'text-white'}">
        ${entry.username}${isMe ? ' <span class="text-xs text-blue-400 font-normal ml-1">(you)</span>' : ''}
      </td>
      <td class="px-5 py-3 text-right text-gray-300">${campaign}</td>
      <td class="px-5 py-3 text-right text-gray-300">${streak}</td>
      <td class="px-5 py-3 text-right text-gray-300">${daily}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function fetchAndRender() {
  const player = JSON.parse(sessionStorage.getItem('player'));
  const tbody = document.getElementById('leaderboardBody');

  if (player?.is_guest) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-10 text-center text-gray-500">Sign in to see the leaderboard.</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-10 text-center text-gray-500">Loading…</td></tr>';

  try {
    const res = await fetch('/api/leaderboard', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('access_token')}`,
      },
    });
    if (!res.ok) throw new Error(res.status);
    leaderboardData = await res.json();
  } catch {
    tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-10 text-center text-red-400">Failed to load leaderboard.</td></tr>';
    return;
  }

  if (leaderboardData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-5 py-10 text-center text-gray-500">No players yet.</td></tr>';
    return;
  }

  updateSortHeaders();
  renderRows();
}

document.querySelectorAll('#leaderboardTable [data-col]').forEach(th => {
  th.addEventListener('click', () => {
    if (!leaderboardData.length) return;
    if (sortState.col === th.dataset.col) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.col = th.dataset.col;
      sortState.dir = 'desc';
    }
    updateSortHeaders();
    renderRows();
  });
});

document.getElementById('scoreboardBtn').addEventListener('click', () => {
  document.getElementById('menuButtons').style.display = 'none';
  document.getElementById('scoreboardPanel').style.display = 'block';
  fetchAndRender();
});

document.getElementById('scoreboardCloseBtn').addEventListener('click', () => {
  document.getElementById('scoreboardPanel').style.display = 'none';
});

window._refreshScoreboard = () => {};
