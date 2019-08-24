/* global AFRAME */

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

    const cellSize = 5;
    const wallSize = 1;
    let maze = new Grid(this.data.rows, this.data.cols);
    maze.binaryTree();
    console.log(`${maze}`);
    const grid = maze.grid;

    for (let row of grid) {
      for (let cell of row) {
        const x1 = cell.column * cellSize;
        const x2 = (cell.column + 1) * cellSize;
        const z1 = cell.row * cellSize;
        const z2 = (cell.row + 1) * cellSize;
        if (cell.north == null) {
          for (let x = x1; x < x2; x = x + wallSize) { addBlock(x, 1, z1); }
        }
        if (cell.west == null) {
          for (let z = z1; z < z2; z = z + wallSize) { addBlock(x1, 1, z); }
        }
        if (!cell.linked(cell.south)) {
          for (let x = x1; x <= x2; x = x + wallSize) { addBlock(x, 1, z2); }
        }
        if (cell.column === maze.columns - 1 && cell.row === 0) { continue; } // wall opening
        if (!cell.linked(cell.east)) {
          for (let z = z1; z <= z2; z = z + wallSize) { addBlock(x2, 1, z); }
        }
      }
    }
  }
});

AFRAME.registerComponent('drone', {
  init: function () {
    const steps = [ 0, 3, 5, 7, 10 ];

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    compressor.connect(audioCtx.destination);

    const delay = audioCtx.createDelay();
    delay.delayTime.value = 2.5;

    const delayFilter = audioCtx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.Q.value = 0;
    delayFilter.frequency.value = 500;

    const delayGain = audioCtx.createGain();
    delayGain.gain.value = 0.5;

    delay.connect(delayGain);
    delayGain.connect(delayFilter);
    delayFilter.connect(delay);
    delayFilter.connect(compressor);

    const reverbDelayA = audioCtx.createDelay();
    reverbDelayA.delayTime.value = 0.82;

    const reverbDelayB = audioCtx.createDelay();
    reverbDelayB.delayTime.value = 0.73;

    const reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.4;

    const reverbFilter = audioCtx.createBiquadFilter();
    reverbFilter.type = 'lowpass';
    reverbFilter.Q.value = 0;
    reverbFilter.frequency.value = 800;

    const splitter = audioCtx.createChannelSplitter(2);
    const merger = audioCtx.createChannelMerger(2);

    reverbGain.connect(reverbDelayA);
    reverbGain.connect(reverbDelayB);
    reverbDelayA.connect(reverbFilter);
    reverbDelayB.connect(reverbFilter);
    reverbFilter.connect(splitter);
    splitter.connect(merger, 1, 0);
    splitter.connect(merger, 0, 1);
    merger.connect(reverbGain);
    reverbGain.connect(compressor);

    delayFilter.connect(reverbFilter);

    function addDrone () {
      const length = 15 + srand() * 25;

      const note = Math.floor(srand() * steps.length);
      const octave = Math.floor(srand() * srand() * 4);

      const freq = Math.pow(2, ((36 + steps[ note ] + 12 * octave) - 69) / 12) * 440;

      console.log('Adding Drone: ' + length.toFixed(2) + ' / ' + freq.toFixed(2));

      const oscillatorL = audioCtx.createOscillator();
      oscillatorL.type = 'sawtooth';
      oscillatorL.frequency.value = freq;
      oscillatorL.detune.setValueAtTime(srand() * 40.0 - 20.0, audioCtx.currentTime);
      oscillatorL.detune.linearRampToValueAtTime(srand() * 40.0 - 20.0, audioCtx.currentTime + length);

      const panL = -srand();
      const panR = srand();

      if (audioCtx.createStereoPanner) {
        var pannerL = audioCtx.createStereoPanner();
        pannerL.pan.value = panL;
        var pannerR = audioCtx.createStereoPanner();
        pannerR.pan.value = panR;
      } else {
        var pannerL = audioCtx.createPanner();
        pannerL.panningModel = 'equalpower';
        pannerL.setPosition(panL, 0, 1 - Math.abs(panL));
        var pannerR = audioCtx.createPanner();
        pannerR.panningModel = 'equalpower';
        pannerR.setPosition(panR, 0, 1 - Math.abs(panR));
      }

      const oscillatorR = audioCtx.createOscillator();
      oscillatorR.type = 'sawtooth';
      oscillatorR.frequency.value = freq;
      oscillatorR.detune.setValueAtTime(srand() * 40.0 - 20.0, audioCtx.currentTime);
      oscillatorR.detune.linearRampToValueAtTime(srand() * 40.0 - 20.0, audioCtx.currentTime + length);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = srand() * 2.0;
      filter.frequency.setValueAtTime(0.0, audioCtx.currentTime);
      filter.frequency.linearRampToValueAtTime(freq * 1.5 + srand() * freq * 2.5, audioCtx.currentTime + length / 2.0);
      filter.frequency.linearRampToValueAtTime(0.0, audioCtx.currentTime + length);

      oscillatorL.connect(pannerL);
      oscillatorR.connect(pannerR);
      pannerL.connect(filter);
      pannerR.connect(filter);
      filter.connect(delay);
      filter.connect(reverbFilter);
      filter.connect(compressor);
      oscillatorL.start();
      oscillatorL.stop(audioCtx.currentTime + length);
      oscillatorR.start();
      oscillatorR.stop(audioCtx.currentTime + length);

      setTimeout(addDrone, srand() * 10000 + 2500);
    }
    addDrone();
  }
});

AFRAME.registerShader('ikeda', {
  schema: {
    color: { type: 'color', is: 'uniform', default: 'black' },
    opacity: { type: 'number', is: 'uniform', default: 1.0 },
    rnd: { type: 'number', is: 'uniform', default: srand() },
    t: { type: 'time', is: 'uniform' }
  },
  raw: false,
  fragmentShader:
  `
    precision mediump float;
    varying vec2 vUv;

    uniform vec3 color;
    uniform float opacity;
    uniform float rnd;
    uniform float t;

    void main () {
      float time = t / 1000.0;
      gl_FragColor = mix(
        vec4(mod(vUv , 0.05) * rnd * 20.0, 1.0, 1.0),
        vec4(color, 1.0),
        sin(time)
      );
      // gl_FragColor = vec4(color, opacity);

    }
  `,
  vertexShader:
  `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
  `
});