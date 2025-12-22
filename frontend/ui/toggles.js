export function createToggle(type = 'normal') {
  const div = document.createElement('div');
  div.className = 'line-toggle';
  div.style.backgroundColor =
    type === 'b' ? 'rgba(200,200,200,0.2)' : 'rgba(200,200,200,0.9)';
  return div;
}
