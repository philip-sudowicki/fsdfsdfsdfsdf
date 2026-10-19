import { ButtonGroup } from '../ui.js';

export class Scene {
  constructor() {
    this.t = 0;
    this.ui = new ButtonGroup();
    this.fade = 1;
    this.freezeBelow = false;
    this.leaving = false;
    this.leaveT = 0;
  }

  enter() {}

  exit() {}

  layout() {}

  update(dt) {
    this.t += dt;
    this.ui.update(dt);
  }

  draw() {}

  pointerDown(p) {
    return this.ui.pointerDown(p);
  }

  pointerMove(p) {
    this.ui.pointerMove(p);
  }

  pointerUp(p, cancelled) {
    if (cancelled) {
      this.ui.cancel();
      return false;
    }
    return this.ui.pointerUp(p);
  }

  keyDown(code) {
    return this.ui.key(code);
  }
}
