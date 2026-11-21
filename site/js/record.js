// Recording, in the Creator: a person acts a movement out by dragging the parts of the fencers, and each part they let go of
// is a milestone, a step after the one they began from, which takes as long as they took.
//
// What they took is worked into what a step can say: whole tens of milliseconds, the grain of the step's fields, and no
// shorter or longer than a move is worth giving, so that a drag that made no time still moves, and a stop to think is not
// played back as a hold.

// The shortest and longest a move into a milestone is given (ms): how long the drag took, from the first change it made
// to the last.
export const MOVE_MS = { min: 100, max: 5000 };
// The longest a pause between two milestones is kept (ms), as the hold on the first of them.
export const PAUSE_MAX_MS = 2000;
// What the step's time fields count in (ms).
const GRAIN = 10;

const tens = (ms) => Math.round((Number.isFinite(ms) ? ms : 0) / GRAIN) * GRAIN;

/** The `ms` of a milestone: how long the drag took to make it, in whole tens of milliseconds within `MOVE_MS`. */
export function moveTime(took) {
  return Math.min(MOVE_MS.max, Math.max(MOVE_MS.min, tens(took)));
}

/** The `hold` of the step a milestone followed on from: the pause before the drag that made it, in whole tens, between 0 and `PAUSE_MAX_MS`. */
export function pauseTime(between) {
  return Math.min(PAUSE_MAX_MS, Math.max(0, tens(between)));
}

/** What a milestone is called: who moved what. */
export function milestoneLabel(who, part) {
  return `${who} moves the ${part}`;
}

/**
 * What the note under the stage says while recording: how it is done and how far it has got, or, when no part can be taken
 * hold of (`ready` false), why nothing is being recorded.
 */
export function recordNote({ ready, count }) {
  if (!ready) return "Recording takes drags of the dots, which are not on the stage now: turn on Drag dots, or pause on a step.";
  if (count === 0) return "Recording: drag a part of a fencer and let go, and that is a milestone, a new step after this one that takes as long as you took. Press Record again to stop.";
  return `Recording: ${count === 1 ? "1 milestone" : `${count} milestones`} so far. Drag the next part, or press Record again to stop.`;
}
