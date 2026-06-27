import { Application, Container, Graphics, Text } from 'pixi.js';
import { config } from './config.js';

const STEPS = [
  {
    text: 'This is a power network. Blue nodes produce electricity, red nodes consume it. Power flows through the grey lines.',
    highlight: null,
  },
  {
    text: 'Each line has a capacity limit. When a line carries more power than its limit, it becomes congested (shown in red).',
    highlight: 'overload',
  },
  {
    text: 'You can fix congestion by toggling switches — small circles on each line end. A switch splits a node into two separate busbars, rerouting power.',
    highlight: 'switch',
  },
  {
    text: 'If switching alone is not enough, use Redispatch: adjust how much power each generator produces or each consumer draws. This costs money.',
    highlight: null,
  },
  {
    text: 'Your goal: make all lines green. Good luck!',
    highlight: null,
  },
];

let step = 0;

(async () => {
  const app = new Application();
  await app.init({
    resizeTo:        window,
    backgroundColor: config.colors.background,
    antialias:       true,
    resolution:      window.devicePixelRatio || 1,
    autoDensity:     true,
  });
  document.getElementById('app').appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  // ── Draw a simple 3-node illustrative network ────────────────
  // Node positions (centered around 0,0)
  const nodes = [
    { x:   0, y: -80, producer: true,  label: '+80' },
    { x: -80, y:  40, producer: false, label: '-50' },
    { x:  80, y:  40, producer: false, label: '-30' },
  ];
  const lines = [
    { from: 0, to: 1, overloaded: false },
    { from: 0, to: 2, overloaded: false },
    { from: 1, to: 2, overloaded: true  },
  ];

  const linesGfx     = new Graphics();
  const overloadGfx  = new Graphics();
  const normalGfx    = new Graphics();

  world.addChild(normalGfx);
  world.addChild(overloadGfx);

  for (const line of lines) {
    const a = nodes[line.from];
    const b = nodes[line.to];
    const target = line.overloaded ? overloadGfx : normalGfx;
    const color  = line.overloaded ? config.colors.lineOverload : config.colors.line;
    target.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 3, color });
  }

  // Switch indicators on the overloaded line
  const switchContainer = new Container();
  world.addChild(switchContainer);

  for (const end of ['from', 'to']) {
    const a  = nodes[lines[2].from];
    const b  = nodes[lines[2].to];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const nx = dx / len;
    const ny = dy / len;
    const base = end === 'from' ? a : b;
    const dir  = end === 'from' ? 1 : -1;

    const sw = new Graphics();
    sw.circle(0, 0, 8).fill({ color: 0xc8c8c8, alpha: 0.9 });
    sw.circle(0, 0, 12).stroke({ width: 2, color: 0xc8c8c8, alpha: 0.2 });
    sw.x = base.x + nx * 15 * dir;
    sw.y = base.y + ny * 15 * dir;
    switchContainer.addChild(sw);
  }

  // Nodes
  const nodeContainer = new Container();
  world.addChild(nodeContainer);
  const labelContainer = new Container();
  world.addChild(labelContainer);

  for (const node of nodes) {
    const g = new Graphics();
    g.circle(0, 0, config.sizes.nodeRadius).fill(
      node.producer ? config.colors.nodeProd : config.colors.nodeCons,
    );
    g.x = node.x;
    g.y = node.y;
    nodeContainer.addChild(g);

    const t = new Text({
      text: node.label,
      style: {
        fill: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'sans-serif',
        dropShadow: { color: '#000', blur: 6, distance: 0, alpha: 1 },
      },
    });
    t.anchor.set(0.5);
    t.x = node.x;
    t.y = node.y;
    labelContainer.addChild(t);
  }

  // ── Center world on screen ───────────────────────────────────
  function centerWorld() {
    world.scale.set(2);
    world.x = app.screen.width  / 2;
    world.y = app.screen.height / 2;
  }
  centerWorld();
  window.addEventListener('resize', centerWorld);

  // ── Pulse overloaded line ────────────────────────────────────
  app.ticker.add(() => {
    overloadGfx.alpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.004);

    // Highlight relevant elements based on current step
    const highlight = STEPS[step]?.highlight;
    switchContainer.alpha = highlight === 'switch'   ? 1 : 0.25;
    overloadGfx.visible   = highlight === 'overload' || highlight === 'switch' || highlight === null;
    linesGfx.visible      = true;
  });

  // ── Tutorial text steps ──────────────────────────────────────
  const helpEl = document.getElementById('tutorialHelp');

  function renderStep() {
    const s = STEPS[step];
    helpEl.innerHTML =
      `<p>${s.text}</p>` +
      `<div style="display:flex;gap:12px;justify-content:center;margin-top:12px;">` +
      (step > 0
        ? `<button class="button grey" id="prevBtn">← Back</button>`
        : '') +
      (step < STEPS.length - 1
        ? `<button class="button blue" id="nextBtn">Next →</button>`
        : `<button class="button blue" id="doneBtn">Start playing →</button>`) +
      `</div>`;

    document.getElementById('nextBtn')?.addEventListener('click', () => { step++; renderStep(); });
    document.getElementById('prevBtn')?.addEventListener('click', () => { step--; renderStep(); });
    document.getElementById('doneBtn')?.addEventListener('click', () => { window.location.href = '/'; });
  }

  renderStep();
})();
