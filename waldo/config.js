/**
 * config.js — the booth's settings. This is the one file to edit.
 *
 * ADDING A REAL PICTURE TO "BIG PICTURE SEARCH"
 *  1. Put the image file in /waldo/images/ (e.g. images/beach.jpg).
 *  2. Open the picture, find Waldo, and note where he is as a percentage
 *     of the picture's width (x) and height (y). Top-left is 0,0 and
 *     bottom-right is 100,100. "r" is how big the tap zone is, as a
 *     percentage of the picture's width (3–5 is usually right).
 *  3. Add an entry to SCENES below. Remove the placeholder when you have
 *     at least one real picture.
 *  Tip: open /waldo?mark=2 in a browser (2 = the 2nd scene in the list)
 *  and tap Waldo — it shows you the x and y numbers to copy in.
 */

window.BOOTH = {
  // Camilo's menu: seconds to choose before the most-played game starts
  pickSeconds: 10,

  // If nobody touches the screen for this long, go back to "Tap to play"
  idleSeconds: 60,

  // Perfect Pairs time limits by grade (seconds) — Camilo's numbers
  grades: [
    { id: "K", label: "Kindergarten", seconds: 90 },
    { id: "1", label: "1st grade", seconds: 60 },
    { id: "2", label: "2nd grade", seconds: 45 },
    { id: "3", label: "3rd grade", seconds: 35 },
    { id: "4", label: "4th grade", seconds: 30 },
    { id: "5", label: "5th grade", seconds: 25 },
  ],

  // Waldo's Hand
  handSeconds: 30,
  handStaysOutMs: 1500, // how long the hand stays out before it moves
  // Optional: an approved picture of a hand/sleeve to pop out.
  // Leave as null to use the placeholder hand.
  handImage: null, // e.g. "/waldo/images/waldo-hand.png"

  // Hat Trick
  hatRounds: 3,
  hatSwaps: 5,
  hatSwapMs: 900,

  // Big Picture Search scenes
  SCENES: [
    {
      name: "Placeholder festival",
      src: "/waldo/images/placeholder-scene.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.",
      x: 17.2, y: 61.5, r: 3.5,
      placeholder: true,
    },
    // {
    //   name: "Beach day",
    //   src: "/waldo/images/beach.jpg",
    //   clue: "Find Waldo!",
    //   x: 62.5, y: 41.0, r: 4,
    // },
  ],
};
