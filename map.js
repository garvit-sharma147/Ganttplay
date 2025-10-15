// map.js
// Defines a 30x30 map filled with 0 (grass).
// Also provides PRESET_BUILDINGS array listing building placements.

const MAP_SIZE = 30;

const map = Array.from({ length: MAP_SIZE }, () => Array.from({ length: MAP_SIZE }, () => 0));

// PRESET_BUILDINGS: Now includes the manual 'img' path for each building.
const PRESET_BUILDINGS = [
  { code: 1, x: 14, y: 14, level: 1, img: 'images/townhall.png' },      // Townhall
  { code: 2, x: 11, y: 14, level: 1, img: 'images/cannon.png' },        // Cannon
  { code: 3, x: 17, y: 14, level: 1, img: 'images/archertower.png' },   // Archer Tower
  { code: 4, x: 14, y: 11, level: 1, img: 'images/wizardtower.png' },   // Wizard Tower
  { code: 5, x: 14, y: 17, level: 1, img: 'images/monolith.png' },      // Monolith
  { code: 6, x: 8,  y: 14, level: 1, img: 'images/goldstorage.png' }, // Credit Storage
  { code: 7, x: 20, y: 14, level: 1, img: 'images/goldstorage.png' }   // Builder House (assuming you have this image)
];

/* Expose to global scope so script.js can access */
window.MAP_SIZE = MAP_SIZE;
window.map = map;
window.PRESET_BUILDINGS = PRESET_BUILDINGS;