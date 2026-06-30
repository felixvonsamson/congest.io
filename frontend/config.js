const darkColors = {
  background: 0x151b23,
  nodeProd: 0x5096c7,
  nodeCons: 0xd98a4a,
  bNode: 0x5fc7e0,   // accent — b-node ring
  line: 0x3a4757,
  lineOverload: 0xf1584d,
  viewportRect: 0xff9600,
  redispatch: 0x4ade80,
  labelText: '#0a1018',  // nodeText — dark on lighter node fills
  labelShadow: '#8cc4e4',
  switch: 0x2c3d4e,   // secondary gray — muted, close to line
  switchActive: 0x6a8499,   // primary gray — lighter, acts as active indicator
  flowDot: 0x5fc7e0,
  overloadDot: 0xff8479,
  chipBg: 0x222b36,
  chipBorder: 0x39434f,
  chipText: '#cdd6e0',
  chipTextOverload: '#f1584d',
};

const lightColors = {
  background: 0xeef1f5,
  nodeProd: 0x3d7ea6,
  nodeCons: 0xc2773a,
  bNode: 0x0fa3bd,   // accent
  line: 0xb4bdcc,
  lineOverload: 0xdf463d,
  viewportRect: 0xff9600,
  redispatch: 0x059669,
  labelText: '#ffffff',  // nodeText — white on colored node fills
  labelShadow: '#1a2940',
  switch: 0x9aaaba,   // secondary gray — muted, close to line
  switchActive: 0x3d5066,   // primary gray — darker, acts as active indicator
  flowDot: 0x43abc9,
  overloadDot: 0xf06a5f,
  chipBg: 0xffffff,
  chipBorder: 0xd3dae2,
  chipText: '#37475a',
  chipTextOverload: '#df463d',
};

export const themes = { dark: darkColors, light: lightColors };

export const config = {
  colors: { ...darkColors },
  sizes: {
    nodeRadius: 7,
    ringRadiusOuter: 9,
    ringRadiusInner: 7,
    particleRadius: 1.25,
    lineWidth: 2.25,
    switchRadius: 6,
  },
};
