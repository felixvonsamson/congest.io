import { config } from "../config.js";

export function getViewports(settings) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const gap = config.misc.gap;

  const overviewSize = Math.min(0.4 * W, 350);
  settings.overview_viewport = {
    x: 0,
    y: H-overviewSize,
    w: overviewSize,
    h: overviewSize
  }
  settings.main_viewport = {
    x: 0,
    y: 0,
    w: W,
    h: H
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