import { config } from "../config.js";

export function getViewports(settings) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const gap = config.misc.gap;

  settings.isPortrait = H > W;

  if (settings.isPortrait) {
    if (settings.collapseOverview) {
      // only MAIN (full height)
      settings.main_viewport = {
        x: 0,
        y: 0,
        w: W,
        h: H - 2 * gap
      };
    } else {
      const h = 0.5 * H - gap;
      settings.overview_viewport = {
        x: 0,
        y: h + 2 * gap,
        w: W,
        h
      };
      settings.main_viewport = {
        x: 0,
        y: 0,
        w: W,
        h
      };
    }
  } else {
    if (settings.collapseOverview) {
      // only MAIN (full width)
      settings.main_viewport = {
        x: 2 * gap,
        y: 0,
        w: W - 2 * gap,
        h: H
      };
    } else {
      const w = 0.5 * W - gap;
      settings.overview_viewport = {
        x: 0,
        y: 0,
        w,
        h: H
      };
      settings.main_viewport = {
        x: w + 2 * gap,
        y: 0,
        w,
        h: H
      };
    }
  }
  settings.aspect = settings.main_viewport.w / settings.main_viewport.h;

  return {
    /** Convert mouse event → NDC for a given viewport */
    toNDC(event, vp) {
        const clientY = window.innerHeight - event.clientY; // invert Y for NDC calculation
      return {
        x: ((event.clientX - vp.x) / vp.w) * 2 - 1,
        y: ((clientY - vp.y) / vp.h) * 2 - 1
      };
    },

    /** Check if mouse is inside a viewport */
    contains(event, vp) {
        const clientY = window.innerHeight - event.clientY; // invert Y for checking
        return (
            event.clientX >= vp.x &&
            event.clientX <= vp.x + vp.w &&
            clientY >= vp.y &&
            clientY <= vp.y + vp.h
        );
    }
  };
}

// convert mouse to NDC for right viewport
    // let rightOffset = viewportWidth + 2 * config.misc.gap;
    // let topOffset = 0;
    // if (settings.collapseOverview){
    //   rightOffset = 2 * config.misc.gap;
    // }
    // if (settings.isPortrait) {
    //   rightOffset = 0;
    //   topOffset = viewportHeight + 2 * config.misc.gap;
    //   if (settings.collapseOverview){
    //     topOffset = 2 * config.misc.gap;
    //   }
    // }
    // mouse.x = ((event.clientX - rightOffset) / viewportWidth) * 2 - 1;
    // mouse.y = (-(event.clientY - topOffset) / viewportHeight) * 2 + 1;