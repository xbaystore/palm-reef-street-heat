// Keyboard input. Held keys give a steering direction; one-shot presses (enter a
// car, punch, pause, confirm, continue) are queued and taken once by the loop, so
// a press between two frames is never lost and never counted twice. E and F are
// edge-triggered: holding them does not repeat the action.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONTINUE = 4;

export const IDLE_INPUT = {
  up: false,
  down: false,
  left: false,
  right: false,
  run: false,
  punch: false,
  enter: false,
};

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const ENTER_CAR = new Set(['KeyE']);
const PUNCH = new Set(['KeyF', 'Space']);
const CONFIRM = new Set(['Enter']);
const CONTINUE = new Set(['KeyC']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput() {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let punchQueued = false;
  let enterQueued = false;

  function attach() {
    window.addEventListener('keydown', (event) => {
      if (UP.has(event.code)) held.up = true;
      else if (DOWN.has(event.code)) held.down = true;
      else if (LEFT.has(event.code)) held.left = true;
      else if (RIGHT.has(event.code)) held.right = true;
      else if (RUN.has(event.code)) held.run = true;
      else if (ENTER_CAR.has(event.code)) {
        if (!event.repeat) enterQueued = true;
      } else if (PUNCH.has(event.code)) {
        if (!event.repeat) punchQueued = true;
      } else if (CONFIRM.has(event.code)) {
        if (!event.repeat) actions |= ACTION_CONFIRM;
      } else if (CONTINUE.has(event.code)) {
        if (!event.repeat) actions |= ACTION_CONTINUE;
      } else if (PAUSE.has(event.code)) {
        if (!event.repeat) actions |= ACTION_PAUSE;
      } else return;
      event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      if (UP.has(event.code)) held.up = false;
      else if (DOWN.has(event.code)) held.down = false;
      else if (LEFT.has(event.code)) held.left = false;
      else if (RIGHT.has(event.code)) held.right = false;
      else if (RUN.has(event.code)) held.run = false;
    });
    window.addEventListener('blur', () => {
      held.up = false;
      held.down = false;
      held.left = false;
      held.right = false;
      held.run = false;
    });
  }

  return {
    attach,
    /** The step input for this frame; one-shots are consumed on read. */
    read() {
      const input = {
        up: held.up,
        down: held.down,
        left: held.left,
        right: held.right,
        run: held.run,
        punch: punchQueued,
        enter: enterQueued,
      };
      punchQueued = false;
      enterQueued = false;
      return input;
    },
    /** The one-shot screen actions since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
