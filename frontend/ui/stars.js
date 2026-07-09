// Shared star-rating rendering: 3 stars for a zero-redispatch solve, 2 for
// under 100€, 1 otherwise. No image assets — stars are drawn as inline SVGs
// so they can be recolored per-theme and animated with plain CSS.

const STAR_PATH = "M12 2.5l2.9 6.06 6.6.79-4.86 4.68 1.24 6.53L12 17.4l-5.88 3.16 1.24-6.53L2.5 9.35l6.6-.79z";

export function starsForRedispatchCost(cost) {
    if (cost <= 1e-6) return 3;
    if (cost < 100) return 2;
    return 1;
}

function starSVG() {
    return `<svg viewBox="0 0 24 24" class="star"><path d="${STAR_PATH}"/></svg>`;
}

// Returns markup for a row of 3 star placeholders; `stars` (0-3) of them are
// marked filled. `extraClass` lets callers size the row (e.g. "starsRowSmall").
export function starsRowHTML(stars, extraClass = '') {
    let html = `<div class="starsRow ${extraClass}">`;
    for (let i = 0; i < 3; i++) {
        html += `<span class="starSlot${i < stars ? ' filled' : ''}">${starSVG()}</span>`;
    }
    html += `</div>`;
    return html;
}

// Plays the pop-in animation on the filled stars within `container` (a node
// containing a `.starsRow`), staggered left to right.
export function animateStarsRow(container) {
    const slots = container.querySelectorAll('.starSlot.filled');
    slots.forEach((slot, i) => {
        slot.classList.remove('pop');
        void slot.offsetWidth;
        slot.style.animationDelay = `${i * 0.15}s`;
        slot.classList.add('pop');
    });
}
