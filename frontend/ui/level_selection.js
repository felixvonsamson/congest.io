import { load_level } from "../main.js";

function populateLevelList() {
    // for the 37 pictures found in frontend/static/images/level miniatures, add div in the div called levelList that displays the image of the level anf the number on top.
    const levelListDiv = document.getElementById('levelList');
    const player = JSON.parse(sessionStorage.getItem('player'));
    for (let i = 1; i <= 37; i++) {
        const levelDiv = document.createElement('div');
        levelDiv.className = 'levelItem';
        levelDiv.innerHTML = `
        <div class="levelItem">
            <img src="./static/images/level_miniatures/level${i}.png" alt="Level ${i}" class="levelThumbnail">
            <div class="levelNumber">${i}</div>
        </div>
        `;
        if (i > player.unlocked_levels) {
            levelDiv.classList.add('lockedLevel');
        }else {
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
    if (document.getElementById('levelList').children.length === 0){
        populateLevelList();
    }
});