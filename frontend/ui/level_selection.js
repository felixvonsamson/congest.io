import { load_level } from "../main.js";
import { DIFFICULTY_COLORS } from "../network/updateNetwork.js";
import { themes } from "../config.js";
import { starsRowHTML } from "./stars.js";

let difficultiesPromise = null;
function getLevelDifficulties() {
    if (!difficultiesPromise) {
        difficultiesPromise = fetch('/static/level_difficulties.json').then(r => r.json());
    }
    return difficultiesPromise;
}

const THUMB_SIZE = 148; // matches .levelThumbnail CSS size
const levelDataPromises = new Map();
const renderedThumbnails = []; // { canvas, data } pairs, redrawn on theme change

function getLevelData(levelNum) {
    if (!levelDataPromises.has(levelNum)) {
        levelDataPromises.set(levelNum, fetch(`/static/levels/Level${levelNum}.json`).then(r => r.json()));
    }
    return levelDataPromises.get(levelNum);
}

function hexToCss(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
}

// Renders a level thumbnail the same way the in-game minimap draws its
// overview: lines between node centers, and a filled dot per node colored
// by whether it's a producer or consumer.
function drawLevelThumbnail(canvas, data) {
    const theme = themes[document.documentElement.dataset.theme] || themes.dark;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = THUMB_SIZE * dpr;
    canvas.height = THUMB_SIZE * dpr;
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    c.fillStyle = hexToCss(theme.background);
    c.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

    const nodes = Object.values(data.nodes);
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const netW = (maxX - minX) || 1;
    const netH = (maxY - minY) || 1;

    const padding = THUMB_SIZE * 0.1;
    const avail = THUMB_SIZE - padding * 2;
    const scale = Math.min(avail / netW, avail / netH);
    const offsetX = padding + (avail - netW * scale) / 2 - minX * scale;
    const offsetY = padding + (avail - netH * scale) / 2 - minY * scale;
    const project = (x, y) => [x * scale + offsetX, y * scale + offsetY];

    c.lineCap = 'round';
    c.lineWidth = 2.5;
    c.strokeStyle = hexToCss(theme.line);
    for (const line of Object.values(data.lines)) {
        const from = data.nodes[line.from_node];
        const to = data.nodes[line.to_node];
        if (!from || !to) continue;
        const [x1, y1] = project(from.x, from.y);
        const [x2, y2] = project(to.x, to.y);
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
    }

    const nodeRadius = 3;
    for (const node of nodes) {
        const [x, y] = project(node.x, node.y);
        c.beginPath();
        c.fillStyle = hexToCss(node.injection >= 0 ? theme.nodeProd : theme.nodeCons);
        c.arc(x, y, nodeRadius, 0, Math.PI * 2);
        c.fill();
    }
}

function redrawAllThumbnails() {
    for (const { canvas, data } of renderedThumbnails) {
        drawLevelThumbnail(canvas, data);
    }
}

document.addEventListener('themechange', redrawAllThumbnails);

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

async function populateLevelList() {
    const levelListDiv = document.getElementById('levelList');
    levelListDiv.innerHTML = '';
    renderedThumbnails.length = 0;
    const player = JSON.parse(sessionStorage.getItem('player'));
    const levelStars = player?.level_stars || {};
    const difficulties = await getLevelDifficulties();
    for (let i = 1; i <= 100; i++) {
        const difficulty = difficulties[i - 1];
        const dotColor = DIFFICULTY_COLORS[difficulty] || '#9ca3af';
        const locked = i > player.unlocked_levels;
        const levelDiv = document.createElement('div');
        levelDiv.className = 'levelItem';
        levelDiv.innerHTML = `
        <div class="levelThumbWrap">
            <canvas class="levelThumbnail" aria-label="Level ${i}"></canvas>
            <div class="levelNumber">${i}</div>
            <div class="levelDifficultyDot" style="background:${dotColor}" title="${difficulty || ''}"></div>
        </div>
        <div class="levelStars">${locked ? '' : starsRowHTML(levelStars[i] || 0, 'starsRowGrid')}</div>
        `;
        const canvas = levelDiv.querySelector('canvas');
        getLevelData(i).then(data => {
            renderedThumbnails.push({ canvas, data });
            drawLevelThumbnail(canvas, data);
        });
        if (locked) {
            levelDiv.classList.add('lockedLevel');
        } else {
            if (i === player.unlocked_levels) levelDiv.classList.add('nextLevel');
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
    populateLevelList();
});