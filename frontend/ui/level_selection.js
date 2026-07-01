import { load_level } from "../main.js";

function updateDailyCard() {
    const player = JSON.parse(sessionStorage.getItem('player'));
    const todayIso = new Date().toISOString().slice(0, 10);
    const solved = player?.daily_solved_date === todayIso;
    const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    document.getElementById('dailyCardDate').textContent = dateLabel;

    const statusEl = document.getElementById('dailyCardStatus');
    if (solved) {
        statusEl.innerHTML = `<span class="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>Solved</span>`;
    } else {
        statusEl.innerHTML = `<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-black">NEW</span>`;
    }
}

function populateLevelList() {
    const levelListDiv = document.getElementById('levelList');
    const player = JSON.parse(sessionStorage.getItem('player'));
    for (let i = 1; i <= 37; i++) {
        const levelDiv = document.createElement('div');
        levelDiv.className = 'levelItem';
        levelDiv.innerHTML = `
        <div class="levelItem">
            <img src="/static/level_miniatures/level${i}.png" alt="Level ${i}" class="levelThumbnail">
            <div class="levelNumber">${i}</div>
        </div>
        `;
        if (i > player.unlocked_levels) {
            levelDiv.classList.add('lockedLevel');
        } else {
            levelDiv.addEventListener('click', () => {
                load_level(i);
                document.getElementById('levelSelectionPanel').style.display = 'none';
            });
        }
        levelListDiv.appendChild(levelDiv);
    }
}

document.getElementById('levelSelection').addEventListener('click', (e) => {
    document.getElementById('levelSelectionPanel').style.display = 'block';
    document.getElementById('menuButtons').style.display = 'none';
    updateDailyCard();
    if (document.getElementById('levelList').children.length === 0) {
        populateLevelList();
    }
});