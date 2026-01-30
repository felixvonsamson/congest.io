export function createToggle(type = 'normal', controls) {
  const div = document.createElement('div');
  div.className = 'line-toggle';
  if (type === 'b') {
      div.classList.add('on');
  }
  attachToggleEvents(div, controls);
  return div;
}

export function createArrow(direction, controls) {
  const div = document.createElement('div');
  div.className = 'arrow-' + direction;
  attachToggleEvents(div, controls);
  return div;
}

function attachToggleEvents(el, controls) {
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    controls.enabled = false;
  });

  el.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    controls.enabled = true;
  });

  el.addEventListener('pointerleave', () => {
    controls.enabled = true;
  });
}