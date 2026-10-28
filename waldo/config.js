/**
 * config.js — the booth's settings. This is the one file to edit.
 *
 * ADDING A REAL PICTURE TO "BIG PICTURE SEARCH"
 *  1. Put the image file in /waldo/images/ (e.g. images/beach.jpg).
 *  2. Open the picture, find Waldo, and note where he is as a percentage
 *     of the picture's width (x) and height (y). Top-left is 0,0 and
 *     bottom-right is 100,100. "r" is how big the tap zone is, as a
 *     percentage of the picture's width (3–5 is usually right).
 *  3. Add an entry to SCENES below. Remove the placeholder scenes when you
 *     have real pictures. Each round shows a different picture; all of them
 *     are shown once before any repeats.
 *  Until a real picture is added, every round draws a brand-new crowd with the
 *  gold-star person in a random spot (scene-maker.js); the placeholders below are unused.
 *  Real pictures are shown in random order and mirrored half the time (mirrorScenes).
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

  // Leaderboard: the Google Apps Script web app link (ends in /exec).
  // Both the games and capsunlocked.com/waldoleaderboard read it from here.
  // While it's empty, finished rounds wait on the booth device and send once it's filled in.
  leaderboardUrl: "https://script.google.com/macros/s/AKfycbxcPbkvzTF6-e3jBL-qpCWbpvM7aP65AnRlBKi5ELbr-NQnUu6fDWz9zOzpSp7XQcNV/exec",

  // Classrooms — after picking a game, kids pick their grade, then their teacher.
  // Teachers are shown by last name only: the picker shows "Dargen", the leaderboard "Team Dargen (2)"
  classrooms: [
    { grade: "K", team: "Karim" },
    { grade: "K", team: "Tung" },
    { grade: "K", team: "Vuksich" },
    { grade: "K", team: "Wang" },
    { grade: "1", team: "Amato" },
    { grade: "1", team: "Chen" },
    { grade: "1", team: "Eggers" },
    { grade: "1", team: "Yin" },
    { grade: "2", team: "Chen" },
    { grade: "2", team: "Dargen" },
    { grade: "2", team: "England" },
    { grade: "2", team: "Tong" },
    { grade: "3", team: "Goodman" },
    { grade: "3", team: "Kerrigan" },
    { grade: "3", team: "Toevs" },
    { grade: "4", team: "Elms" },
    { grade: "4", team: "Kochanowski" },
    { grade: "4", team: "Scoggins" },
    { grade: "5", team: "Johnston" },
    { grade: "5", team: "Little" },
    { grade: "5", team: "Silver" },
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

  // Big Picture Search: flip real pictures left-to-right half the time so Waldo moves
  mirrorScenes: true,

  // Big Picture Search gets harder by grade (only for the drawn crowds, not real pictures):
  //  people = crowd size · decoys = gold hats with no star · tricky = stars on other-color hats
  //  size = how big everyone is drawn · zone = how close a tap must be (% of picture width)
  searchLevels: {
    K: { people: 70,  decoys: 0,  tricky: 0, size: 1.45, zone: 5.5 },
    1: { people: 110, decoys: 3,  tricky: 0, size: 1.3,  zone: 5 },
    2: { people: 160, decoys: 6,  tricky: 0, size: 1.15, zone: 4.5 },
    3: { people: 210, decoys: 9,  tricky: 2, size: 1.0,  zone: 4 },
    4: { people: 260, decoys: 12, tricky: 4, size: 0.92, zone: 3.5 },
    5: { people: 320, decoys: 15, tricky: 7, size: 0.85, zone: 3.5 },
  },
  searchDefaultGrade: "2", // used when a kid taps "Just play (no class)"
  // Settings are dealt like cards (each shows once before any repeats).
  // Remove any you don't want: festival, beach, forest, school, playground, river, baseball
  searchThemes: ["festival", "beach", "forest", "school", "playground", "river", "baseball"],

  // Big Picture Search scenes
  SCENES: [
    { name: "Placeholder festival 1", src: "/waldo/images/scene-1.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.", x: 4.6, y: 59.6, r: 3.5, placeholder: true },
    { name: "Placeholder festival 2", src: "/waldo/images/scene-2.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.", x: 16.8, y: 76.0, r: 3.5, placeholder: true },
    { name: "Placeholder festival 3", src: "/waldo/images/scene-3.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.", x: 44.4, y: 47.4, r: 3.5, placeholder: true },
    { name: "Placeholder festival 4", src: "/waldo/images/scene-4.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.", x: 45.3, y: 75.0, r: 3.5, placeholder: true },
    { name: "Placeholder festival 5", src: "/waldo/images/scene-5.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.", x: 57.9, y: 55.7, r: 3.5, placeholder: true },
    { name: "Placeholder festival 6", src: "/waldo/images/scene-6.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.", x: 59.9, y: 68.9, r: 3.5, placeholder: true },
    { name: "Placeholder festival 7", src: "/waldo/images/scene-7.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.", x: 91.8, y: 54.8, r: 3.5, placeholder: true },
    { name: "Placeholder festival 8", src: "/waldo/images/scene-8.svg",
      clue: "Placeholder picture: find the person with the GOLD STAR hat.", x: 94.1, y: 92.1, r: 3.5, placeholder: true },
    // {
    //   name: "Beach day",
    //   src: "/waldo/images/beach.jpg",
    //   clue: "Find Waldo!",
    //   x: 62.5, y: 41.0, r: 4,
    // },
  ],
};
