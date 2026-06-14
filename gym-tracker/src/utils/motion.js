// Shared animation presets built on top of the `motion` library
// (https://motion.dev). Keep these small and reusable so every
// screen/list/tab animates consistently.

// Fade + slide-up used when a screen first appears.
export const screenTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: "easeOut" },
};

// Fade + slide-up used for cards in a list, staggered by index.
export const cardTransition = (index = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" },
});

// Cross-fade used when switching between tabs (e.g. List/Calendar/By Exercise).
export const tabContent = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.18, ease: "easeOut" },
};

// Subtle press feedback for buttons.
export const tapScale = { scale: 0.97 };

// Eye-catching pop-in/out for a single highlighted card (e.g. "latest record"),
// with a slight overshoot for a springy feel.
export const popIn = {
  initial: { opacity: 0, scale: 0.92, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -8 },
  transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
};
