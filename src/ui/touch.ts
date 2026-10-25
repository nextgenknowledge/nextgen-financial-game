/**
 * Touch screens (phones, tablets, touch Chromebooks without a mouse). Quest steps and Narwhal's
 * lines are written for keyboard and mouse; on a touch screen they are reworded to match the
 * on-screen joystick and buttons.
 */

export function isTouch(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.matchMedia?.('(pointer: coarse)').matches;
}

const RULES: [RegExp, string][] = [
  [/\b(?:with |use )?(?:W A S D|WASD) or (?:the )?arrow keys\b/gi, 'with the joystick'],
  [/Drag with your mouse to look around/g, 'Drag on the screen to look around'],
  [/\bclick the ground\b/g, 'tap the ground'],
  [/\bclick\b/g, 'tap'],
  [/\bClick\b/g, 'Tap'],
  [/\bJump with Space\b/g, 'Jump with the jump button'],
  [/\bpress Space\b/g, 'tap the jump button'],
  [/\bPress Space\b/g, 'Tap the jump button'],
  [/\(hold Shift to sprint\)/g, '(push the stick all the way to run)'],
  [/\bHold Shift to (?:sprint|run fast)!?/g, 'Push the stick all the way to run!'],
  [/\bpress E\b/g, 'tap the gold E button'],
  [/\bPress E\b/g, 'Tap the gold E button'],
  [/\bPress P or tap\b/g, 'Tap'],
];

/** Reword keyboard and mouse instructions for touch players; unchanged on other devices. */
export function forDevice(text: string): string {
  if (!isTouch()) return text;
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  // "Walk around! with the joystick" reads oddly; tidy the joins the rewrites can leave
  return out
    .replace(/!\s+with the joystick/g, ' with the joystick!')
    .replace(/\. with the joystick/g, '. Use the joystick')
    .replace(/!\./g, '!');
}
