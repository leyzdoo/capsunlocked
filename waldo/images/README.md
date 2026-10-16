# Waldo booth pictures

Put the approved pictures (from the Where's Waldo shared folder) in this folder.

For each picture used in **Big Picture Search**, add an entry to `SCENES` in
`/waldo/config.js` with the file path and Waldo's spot (x, y as percentages).
Open `capsunlocked.com/waldo?mark=2` (2 = that picture's place in the list)
and tap Waldo to get the numbers.

For **Waldo's Hand**, set `handImage` in `config.js` to an approved hand
picture (a PNG with a see-through background works best).

`scene-1.svg` to `scene-8.svg` are original stand-in pictures. Remove them
from `SCENES` once real pictures are added.
