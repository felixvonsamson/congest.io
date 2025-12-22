export function createToggle(type = 'normal', controls) {
  let backgroundColor = type === 'b' ? 'rgba(200, 200, 200, 0.2)' : 'rgba(200, 200, 200, 0.9)';
  let borderColor = type === 'b' ? 'rgba(200, 200, 200, 0.9)' : 'rgba(200, 200, 200, 0.2)';
  const div = document.createElement('div');
  div.className = 'line-toggle';
  div.style.backgroundColor = backgroundColor;
  div.style.outline = `6px solid ${borderColor}`;
  div.style.outlineOffset = '3px';
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