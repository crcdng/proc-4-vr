function mulberry (a = Date.now()) {
  return function () {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let srand = mulberry();
function randInt (max) { return Math.floor(srand() * max); } // [0..max)
function sample (arr) {
  return arr[randInt(arr.length)];
}

class Cell {
  constructor (row, column) {
    this.row = row;
    this.column = column;
    this.links = new Map();
    this.north = null;
    this.south = null;
    this.west = null;
    this.east = null;
  }

  link (cell, bidi = true) {
    this.links.set(cell, true);
    if (bidi) { cell.link(this, false); }
  }

  unlink (cell, bidi = true) {
    this.links.delete(cell);
    if (bidi) { cell.unlink(this, false); }
  }

  links () { return this.links.keys(); }

  linked (cell) { return this.links.has(cell); }

  neighbours () {
    const list = [];
    if (this.north != null) { list.push(this.north); }
    if (this.south != null) { list.push(this.south); }
    if (this.east != null) { list.push(this.east); }
    if (this.west != null) { list.push(this.west); }
    return list;
  }
}

class Grid {
  constructor (rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.grid = this.prepareGrid();
    this.configureCells();
  }

  prepareGrid () {
    const grid = [];
    for (let r = 0; r < this.rows; r++) {
      let row = [];
      for (let c = 0; c < this.columns; c++) {
        row.push(new Cell(r, c));
      }
      grid.push(row);
    }
    return grid;
  }

  configureCells () {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        if (this.inBounds(r - 1, c)) { this.grid[r][c].north = this.grid[r - 1][c]; }
        if (this.inBounds(r + 1, c)) { this.grid[r][c].south = this.grid[r + 1][c]; }
        if (this.inBounds(r, c - 1)) { this.grid[r][c].west = this.grid[r][c - 1]; }
        if (this.inBounds(r, c + 1)) { this.grid[r][c].east = this.grid[r][c + 1]; }
      }
    }
  }

  binaryTree () {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        let neighbors = [];
        let cell = this.grid[r][c];
        if (cell.north != null) { neighbors.push(cell.north); }
        if (cell.east != null) { neighbors.push(cell.east); }
        const neighbor = sample(neighbors);
        if (neighbor != null) { this.grid[r][c].link(neighbor); }
      }
    }
  }

  inBounds (r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.columns;
  }

  randomCell () {
    const row = randInt(this.rows);
    const col = randInt(this.columns);
    return this.grid[row][col];
  }

  size () { return this.rows * this.columns; }

  toString () {
    let output = '+' + '---+'.repeat(this.columns) + '\n';
    for (let row of this.grid) {
      let top = '|';
      let bottom = '+';
      for (let cell of row) {
        const eastBoundary = cell.linked(cell.east) ? ' ' : '|';
        top = top + '      ' + eastBoundary;
        const southBoundary = cell.linked(cell.south) ? '     ' : '---';
        bottom = bottom + southBoundary + '+';
      }
      output = output + top + '\n';
      output = output + bottom + '\n';
    }
    return output;
  }
}

AFRAME.registerComponent('maze', {
  schema: {
    rows: { type: 'number' },
    cols: { type: 'number' }
  },

  init: function () {
    function addBlock (x, y, z) {
      const sceneEl = document.querySelector('a-scene');
      let newWallEl = document.createElement('a-entity');
      newWallEl.setAttribute('mixin', 'wall');
      newWallEl.object3D.position.set(x, y, z);
      sceneEl.appendChild(newWallEl);
    }

    const size = 5;
    let maze = new Grid(this.data.rows, this.data.cols);
    console.log(`${maze}`);
    maze.binaryTree();
    console.log(`${maze}`);
    const grid = maze.grid;

    for (let row of grid) {
      for (let cell of row) {
        const x1 = cell.column * size;
        const x2 = (cell.column + 1) * size;
        const z1 = cell.row * size;
        const z2 = (cell.row + 1) * size;
        if (cell.north == null) {
          for (let x = x1; x < x2; x++) { addBlock(x, 0, z1); }
        }
        if (cell.west == null) {
          for (let z = z1; z < z2; z++) { addBlock(x1, 0, z); }
        }
        if (!cell.linked(cell.south)) {
          for (let x = x1; x <= x2; x++) { addBlock(x, 0, z2); }
        }
        if (cell.column === maze.columns - 1 && cell.row === 0) { continue; } // opening
        if (!cell.linked(cell.east)) {
          for (let z = z1; z <= z2; z++) { addBlock(x2, 0, z); }
        }
      }
    }
  }
});
