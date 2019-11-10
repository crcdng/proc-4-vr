/* global AFRAME */

// JavaScript does not have a seeded random function
function mulberry(a = Date.now()) {
  console.log(`the random seed: ${a}`);
  return function() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const srand = mulberry();
function randInt(max, min = 0) {
  return min + Math.floor(srand() * (max - min));
} // [0..max)
function sample(arr) {
  return arr[randInt(arr.length)];
}

const direction = { north: 0, east: 1, south: 2, west: 3 };
const opposite = { 0: 2, 1: 3, 2: 0, 3: 1 };
const directionValues = Object.values(direction);
function directionKey(value) {
  return Object.keys(direction).find(key => direction[key] === value);
}
function cellToPosition(row, column, rows, columns, cellSize, height = 0) {
  return { x: column * cellSize, y: height, z: (row - (rows - 1)) * cellSize };
}
const cellSize = 5;
const wallSize = 1;

class Cell {
  constructor(row, column) {
    this.row = row;
    this.column = column;
    this.links = new Map();
    this.north = null;
    this.south = null;
    this.west = null;
    this.east = null;
  }

  distances() {
    // Dijstra
    const distances = new Map([[this, 0]]);
    let frontier = [this];
    while (frontier.length > 0) {
      const newFrontier = [];
      for (const cell of frontier) {
        for (const linked of cell.linkedCells()) {
          if (distances.has(linked)) {
            continue;
          }
          distances.set(linked, distances.get(cell) + 1);
          newFrontier.push(linked);
        }
      }
      frontier = newFrontier;
    }
    return distances;
  }

  link(cell, bidi = true) {
    this.links.set(cell, true);
    if (bidi) {
      cell.link(this, false);
    }
  }

  linked(cell) {
    return this.links.has(cell);
  }

  // do not call a JavaScript method "links"
  linkedCells() {
    return this.links.keys();
  }

  neighbours() {
    // British English
    const list = [];
    if (this.north != null) {
      list.push(this.north);
    }
    if (this.south != null) {
      list.push(this.south);
    }
    if (this.east != null) {
      list.push(this.east);
    }
    if (this.west != null) {
      list.push(this.west);
    }
    return list;
  }

  unlink(cell, bidi = true) {
    this.links.delete(cell);
    if (bidi) {
      cell.unlink(this, false);
    }
  }
}

class Grid {
  constructor(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.grid = this.prepareGrid();
    this.configureCells();
  }

  binaryTree() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        const neighbors = [];
        const cell = this.grid[r][c];
        if (cell.north != null) {
          neighbors.push(cell.north);
        }
        if (cell.east != null) {
          neighbors.push(cell.east);
        }
        const neighbor = sample(neighbors);
        if (neighbor != null) {
          this.grid[r][c].link(neighbor);
        }
      }
    }
  }

  configureCells() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.columns; c++) {
        if (this.inBounds(r - 1, c)) {
          this.grid[r][c].north = this.grid[r - 1][c];
        }
        if (this.inBounds(r + 1, c)) {
          this.grid[r][c].south = this.grid[r + 1][c];
        }
        if (this.inBounds(r, c - 1)) {
          this.grid[r][c].west = this.grid[r][c - 1];
        }
        if (this.inBounds(r, c + 1)) {
          this.grid[r][c].east = this.grid[r][c + 1];
        }
      }
    }
  }

  contentsOf(cell) {
    const dist = this.distances;
    if (dist != null && dist.has(cell)) {
      return dist.get(cell).toString(36); // Integer mod 36
    } else {
      return " ";
    }
  }

  inBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.columns;
  }

  prepareGrid() {
    const grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.columns; c++) {
        row.push(new Cell(r, c));
      }
      grid.push(row);
    }
    return grid;
  }

  randomCell() {
    const row = randInt(this.rows);
    const col = randInt(this.columns);
    return this.grid[row][col];
  }

  size() {
    return this.rows * this.columns;
  }

  toString() {
    let output = "+" + "---+".repeat(this.columns) + "\n";
    for (const row of this.grid) {
      let top = "|";
      let bottom = "+";
      for (const cell of row) {
        const eastBoundary = cell.linked(cell.east) ? " " : "|";
        top = top + ` ${this.contentsOf(cell)} ` + eastBoundary;
        const southBoundary = cell.linked(cell.south) ? "   " : "---";
        bottom = bottom + southBoundary + "+";
      }
      output = output + top + "\n";
      output = output + bottom + "\n";
    }
    return output;
  }
}

let maze; // shared between components

// this is drone by Kris Slyka https://twitter.com/KrisSlyka

AFRAME.registerComponent("drone", {
  init: function() {
    const steps = [0, 3, 5, 7, 10];

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.08;
    compressor.release.value = 0.21;

    compressor.connect(audioCtx.destination);

    const delay = audioCtx.createDelay();
    delay.delayTime.value = 0.77;

    const delayFilter = audioCtx.createBiquadFilter();
    delayFilter.type = "lowpass";
    delayFilter.Q.value = 0;
    delayFilter.frequency.value = 500;

    const delayGain = audioCtx.createGain();
    delayGain.gain.value = 0.9;

    delay.connect(delayGain);
    delayGain.connect(delayFilter);
    delayFilter.connect(delay);
    delayFilter.connect(compressor);

    const reverbDelayA = audioCtx.createDelay();
    reverbDelayA.delayTime.value = 0.82;

    const reverbDelayB = audioCtx.createDelay();
    reverbDelayB.delayTime.value = 1.73;

    const reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.4;

    const reverbFilter = audioCtx.createBiquadFilter();
    reverbFilter.type = "lowpass";
    reverbFilter.Q.value = 0;
    reverbFilter.frequency.value = 1200;

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

    function addDrone() {
      const length = 1.0 + srand() * 3;

      const note = Math.floor(srand() * steps.length);
      const octave = Math.floor(srand() * srand() * 1);

      const freq =
        Math.pow(2, (36 + steps[note] + 12 * octave - 69) / 12) * 120;

      const oscillatorL = audioCtx.createOscillator();
      oscillatorL.type = "sawtooth";
      oscillatorL.frequency.value = freq;
      oscillatorL.detune.setValueAtTime(
        srand() * 4.0 - 2.0,
        audioCtx.currentTime
      );
      oscillatorL.detune.linearRampToValueAtTime(
        srand() * 4.0 - 2.0,
        audioCtx.currentTime + length
      );

      const panL = -srand();
      const panR = srand();

      let pannerL, pannerR;
      if (audioCtx.createStereoPanner) {
        pannerL = audioCtx.createStereoPanner();
        pannerL.pan.value = panL;
        pannerR = audioCtx.createStereoPanner();
        pannerR.pan.value = panR;
      } else {
        pannerL = audioCtx.createPanner();
        pannerL.panningModel = "equalpower";
        pannerL.setPosition(panL, 0, 1 - Math.abs(panL));
        pannerR = audioCtx.createPanner();
        pannerR.panningModel = "equalpower";
        pannerR.setPosition(panR, 0, 1 - Math.abs(panR));
      }

      const oscillatorR = audioCtx.createOscillator();
      oscillatorR.type = "sawtooth";
      oscillatorR.frequency.value = freq;
      oscillatorR.detune.setValueAtTime(
        srand() * 40.0 - 20.0,
        audioCtx.currentTime
      );
      oscillatorR.detune.linearRampToValueAtTime(
        srand() * 40.0 - 20.0,
        audioCtx.currentTime + length
      );

      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = srand() * 1.2;
      filter.frequency.setValueAtTime(0.0, audioCtx.currentTime);
      filter.frequency.linearRampToValueAtTime(
        freq * 1.5 + srand() * freq * 2.5,
        audioCtx.currentTime + length / 2.0
      );
      filter.frequency.linearRampToValueAtTime(
        0.0,
        audioCtx.currentTime + length
      );

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

      setTimeout(addDrone, srand() * 100 + 250);
    }
    addDrone();
  }
});

AFRAME.registerComponent("game", {
  dependencies: ["drone"], // make sure sound is initialized fist

  init: function() {
    const sceneEl = document.querySelector("a-scene");
    const gameEl = this.el;

    function addFloor(
      parentEl,
      w,
      h,
      material = "color: red",
      x = 0,
      y = 0,
      z = 0,
      a = 0,
      p = 0,
      r = 0
    ) {
      const floorEl = document.createElement("a-plane");
      floorEl.setAttribute("position", `${x} ${y} ${z}`);
      floorEl.setAttribute("rotation", `${a} ${p} ${r}`);
      floorEl.setAttribute("width", `${w}`);
      floorEl.setAttribute("height", `${h}`);
      floorEl.setAttribute("material", `${material}`);

      parentEl.appendChild(floorEl);
    }

    function addMaze(parentEl, rows, columns, x = 0, y = 0, z = 0) {
      const mazeEl = document.createElement("a-entity");
      mazeEl.setAttribute("maze", { rows: rows, columns: columns });
      mazeEl.object3D.position.set(x, y, z);
      parentEl.appendChild(mazeEl);
    }

    function addMonster(
      parentEl,
      row,
      column,
      direction,
      height = 1,
      material = "color: red"
    ) {
      const monsterEl = document.createElement("a-cylinder");
      monsterEl.setAttribute("material", `${material}`);
      monsterEl.setAttribute("theta-start", -150);
      monsterEl.setAttribute("theta-length", 300);
      monsterEl.setAttribute("height", height);
      monsterEl.setAttribute("side", "double");
      monsterEl.setAttribute("monster", {
        row: row,
        column: column,
        direction: direction,
        height: height
      }); // returns asynchronously after the scene is initialized (!)
      parentEl.appendChild(monsterEl);
    }

    function addPlayer(parentEl, row, column, direction) {
      const playerEl = document.createElement("a-entity");
      playerEl.setAttribute("id", "player");
      playerEl.setAttribute("player", {
        row: row,
        column: column,
        direction: direction
      });
      playerEl.setAttribute("wasd-maze", ""); // must set an attribute value
      playerEl.setAttribute("drone"); // sound follows player

      const cameraEl = document.createElement("a-camera");
      cameraEl.setAttribute("id", "camera");
      cameraEl.setAttribute("wasd-controls-enabled", "false");

      const cursorEl = document.createElement("a-cursor");

      parentEl.appendChild(playerEl);
      playerEl.appendChild(cameraEl);
      cameraEl.appendChild(cursorEl);
    }

    function addSky(parentEl, material = "color: yellow") {
      const skyEl = document.createElement("a-sky");
      skyEl.setAttribute("material", `${material}`);
      parentEl.appendChild(skyEl);
    }

    sceneEl.appendChild(gameEl); // has to be attached first(!)

    // initialize game elements
    addMaze(gameEl, 8, 8);
    addFloor(
      gameEl,
      40,
      40,
      "shader: floor; color: red; opacity: 0.7; transparent: true",
      18,
      0,
      -18,
      -90,
      0,
      0
    );
    addSky(
      gameEl,
      "shader: sky; u_color: black; u_opacity: 0.7; transparent: true"
    );
    addPlayer(gameEl, 7, 0, direction.north); // row, column starting at 0
    const monsters = 3;
    for (let m = 0; m < monsters; m++) {
      addMonster(
        gameEl,
        randInt(0, 5),
        randInt(0, 8),
        direction.north,
        m === 0 ? 1.8 : m * 5, // height: 1.8, 5, 10
        "shader: monster; color: #ff9002; opacity: 0.7; transparent: true"
      );
    }
  }
});

AFRAME.registerComponent("maze", {
  schema: {
    rows: { type: "number" },
    columns: { type: "number" }
  },

  init: function() {
    const sceneEl = document.querySelector("a-scene");

    function addBlock(x, y, z) {
      const newWallEl = document.createElement("a-entity");
      newWallEl.setAttribute("id", "wall");
      newWallEl.setAttribute(
        "geometry",
        "primitive: box; height: 2; width: 1; depth: 1"
      );
      newWallEl.setAttribute(
        "material",
        "shader: wall; u_color: black; u_opacity: 0.7"
      );
      newWallEl.setAttribute("class", "cursor-listener");
      newWallEl.object3D.position.set(x, y, z);
      sceneEl.appendChild(newWallEl);
    }

    const rows = this.data.rows;
    const columns = this.data.columns;

    const offsetX = -0.5 * cellSize;
    const offsetZ = -(rows - 0.5) * cellSize;

    maze = new Grid(rows, columns);
    maze.binaryTree();
    const grid = maze.grid;
    const startCell = grid[rows - 1][0]; // south-west corner
    maze.distances = startCell.distances();
    console.log(`${maze}`);

    for (const row of grid) {
      for (const cell of row) {
        const x1 = cell.column * cellSize;
        const x2 = (cell.column + 1) * cellSize;
        const z1 = cell.row * cellSize;
        const z2 = (cell.row + 1) * cellSize;
        if (cell.north == null) {
          for (let x = x1; x < x2; x = x + wallSize) {
            addBlock(x + offsetX, 1, z1 + offsetZ);
          }
        }
        if (cell.west == null) {
          for (let z = z1; z < z2; z = z + wallSize) {
            addBlock(x1 + offsetX, 1, z + offsetZ);
          }
        }
        if (!cell.linked(cell.south)) {
          for (let x = x1; x <= x2; x = x + wallSize) {
            addBlock(x + offsetX, 1, z2 + offsetZ);
          }
        }
        if (cell.column === maze.columns - 1 && cell.row === 0) {
          continue;
        } // wall opening
        if (!cell.linked(cell.east)) {
          for (let z = z1; z <= z2; z = z + wallSize) {
            addBlock(x2 + offsetX, 1, z + offsetZ);
          }
        }
      }
    }
  }
});

AFRAME.registerComponent("monster", {
  schema: {
    row: { default: 0 },
    column: { default: 0 },
    direction: { default: direction.south },
    height: { default: 1 }
  },

  init: function() {
    this.row = this.data.row;
    this.column = this.data.column;
    this.direction = this.data.direction;
    this.height = this.data.height;
    this.grid = maze.grid;

    const { x, y, z } = cellToPosition(
      this.row,
      this.column,
      maze.rows,
      maze.columns,
      cellSize
    ); // retuns 0 for y by default

    // correct for vertical placement
    this.el.object3D.position.set(x, this.height / 2, z);
    this.el.object3D.rotation.set(0, (this.direction * Math.PI) / 2, 0);
    this.throttled = AFRAME.utils.throttle(this.move, 5000, this); // call move() every 5 second
  },

  move: function() {
    const dir = this.moveDirection();
    if (dir === direction.north) {
      this.row = this.row - 1;
      this.el.object3D.position.z += (dir - 1) * cellSize;
    } else if (dir === direction.south) {
      this.row = this.row + 1;
      this.el.object3D.position.z += (dir - 1) * cellSize;
    } else if (dir === direction.east) {
      this.column = this.column + 1;
      this.el.object3D.position.x += (-dir + 2) * cellSize;
    } else if (dir === direction.west) {
      this.column = this.column - 1;
      this.el.object3D.position.x += (-dir + 2) * cellSize;
    }
  },

  moveDirection: function() {
    const row = this.row;
    const column = this.column;
    const loc = this.grid[row][column];
    const possibleDirections = [];
    for (let { row: linkedRow, column: linkedColumn } of loc.linkedCells()) {
      if (row > linkedRow) {
        possibleDirections.push(direction.north);
      } else if (row < linkedRow) {
        possibleDirections.push(direction.south);
      } else if (column > linkedColumn) {
        possibleDirections.push(direction.west);
      } else if (column < linkedColumn) {
        possibleDirections.push(direction.east);
      }
      // console.log(
      //   row,
      //   column,
      //   possibleDirections
      // );
    }
    return sample(possibleDirections);
  },

  tick: function(t, dt) {
    this.throttled(); // call move() every 5 second
  }
});

AFRAME.registerComponent("player", {
  schema: {
    row: { default: 0 },
    column: { default: 0 },
    direction: { default: direction.north }
  },

  init: function() {
    this.row = this.data.row;
    this.column = this.data.column;
    this.direction = this.data.direction;
    this.grid = maze.grid;
    const { x, y, z } = cellToPosition(
      this.row,
      this.column,
      maze.rows,
      maze.columns,
      cellSize
    );
    this.el.object3D.position.set(x, y, z);
    this.el.object3D.rotation.set(0, (this.direction * Math.PI) / 2, 0);
    // this.throttled = AFRAME.utils.throttle(this.move, 1000, this);
  },

  move: function(dir) {
    // console.log(`moving ${dir}`);
    if (dir === direction.north) {
      this.row = this.row - 1;
      this.el.object3D.position.z += (dir - 1) * cellSize;
    } else if (dir === direction.south) {
      this.row = this.row + 1;
      this.el.object3D.position.z += (dir - 1) * cellSize;
    } else if (dir === direction.east) {
      this.column = this.column + 1;
      this.el.object3D.position.x += (-dir + 2) * cellSize;
    } else if (dir === direction.west) {
      this.column = this.column - 1;
      this.el.object3D.position.x += (-dir + 2) * cellSize;
    }
  },

  moveDirection: function(forward = true) {
    const row = this.row;
    const column = this.column;
    const loc = this.grid[row][column];
    let possibleDirection;
    for (let { row: linkedRow, column: linkedColumn } of loc.linkedCells()) {
      if (row > linkedRow) {
        possibleDirection = direction.north;
      } else if (row < linkedRow) {
        possibleDirection = direction.south;
      } else if (column > linkedColumn) {
        possibleDirection = direction.west;
      } else if (column < linkedColumn) {
        possibleDirection = direction.east;
      }
      // console.log(
      //   row,
      //   column,
      //   linkedRow,
      //   linkedColumn,
      //   this.direction,
      //   possibleDirection
      // );
      if (forward === true && this.direction === possibleDirection) {
        return this.direction;
      } else if (
        forward === false &&
        Math.abs(this.direction - possibleDirection) === 2
      ) {
        return opposite[this.direction];
      }
    }
    return null;
  },

  left: function() {
    this.direction =
      this.direction === 0 ? directionValues.length - 1 : this.direction - 1;
    // console.log(`new direction ${this.direction}`);
    this.el.object3D.rotateY(Math.PI / 2);
  },

  right: function() {
    this.direction = (this.direction + 1) % directionValues.length;
    // console.log(`new direction ${this.direction}`);
    this.el.object3D.rotateY(-Math.PI / 2);
  },

  forward: function() {
    const moveDirection = this.moveDirection(true);
    if (moveDirection != null) {
      this.move(moveDirection);
    }
  },

  back: function() {
    const moveDirection = this.moveDirection(false);
    if (moveDirection != null) {
      this.move(moveDirection);
    }
  },

  tick: function(t, dt) {
    // this.throttled();
  }
});

// THE FOLLOWING CODE IS COPIED FROM THE AFRAME WASD-COMPONENT
// https://github.com/aframevr/aframe/blob/master/src/components/wasd-controls.js
// TODO Clean up

function bind(fn, ctx /* , arg1, arg2 */) {
  return (function(prependedArgs) {
    return function bound() {
      // Concat the bound function arguments with those passed to original bind
      var args = prependedArgs.concat(Array.prototype.slice.call(arguments, 0));
      return fn.apply(ctx, args);
    };
  })(Array.prototype.slice.call(arguments, 2));
}

function isEmptyObject(keys) {
  var key;
  for (key in keys) {
    return false;
  }
  return true;
}

AFRAME.registerComponent("wasd-maze", {
  schema: {
    acceleration: { default: 65 },
    adAxis: { default: "x", oneOf: ["x", "y", "z"] },
    wsAxis: { default: "z", oneOf: ["x", "y", "z"] }
  },

  init: function() {
    // To keep track of the pressed keys.
    this.keys = {};
    this.easing = 1.1;

    this.velocity = new THREE.Vector3();

    // Bind methods and add event listeners.
    this.onBlur = bind(this.onBlur, this);
    this.onFocus = bind(this.onFocus, this);
    this.onKeyDown = bind(this.onKeyDown, this);
    this.onKeyUp = bind(this.onKeyUp, this);
    this.onVisibilityChange = bind(this.onVisibilityChange, this);
    this.attachVisibilityEventListeners();
  },

  tick: function(time, delta) {
    var data = this.data;
    var el = this.el;
    var velocity = this.velocity;

    if (
      !velocity[data.adAxis] &&
      !velocity[data.wsAxis] &&
      isEmptyObject(this.keys)
    ) {
      return;
    }

    // Update velocity.
    delta = delta / 1000;
    // this.updateVelocity(delta);

    if (!velocity[data.adAxis] && !velocity[data.wsAxis]) {
      return;
    }

    // Get movement vector and translate position.
    // el.object3D.position.add(this.getMovementVector(delta));
  },

  remove: function() {
    this.removeKeyEventListeners();
    this.removeVisibilityEventListeners();
  },

  play: function() {
    this.attachKeyEventListeners();
  },

  pause: function() {
    this.keys = {};
    this.removeKeyEventListeners();
  },

  updateVelocity: function(delta) {
    const CLAMP_VELOCITY = 0.00001;
    const MAX_DELTA = 0.2;

    var acceleration;
    var adAxis;
    var data = this.data;
    var keys = this.keys;
    var velocity = this.velocity;
    var wsAxis;

    adAxis = data.adAxis;
    wsAxis = data.wsAxis;

    // If FPS too low, reset velocity.
    if (delta > MAX_DELTA) {
      velocity[adAxis] = 0;
      velocity[wsAxis] = 0;
      return;
    }

    // https://gamedev.stackexchange.com/questions/151383/frame-rate-independant-movement-with-acceleration
    var scaledEasing = Math.pow(1 / this.easing, delta * 60);
    // Velocity Easing.
    if (velocity[adAxis] !== 0) {
      velocity[adAxis] -= velocity[adAxis] * scaledEasing;
    }
    if (velocity[wsAxis] !== 0) {
      velocity[wsAxis] -= velocity[wsAxis] * scaledEasing;
    }

    // Clamp velocity easing.
    if (Math.abs(velocity[adAxis]) < CLAMP_VELOCITY) {
      velocity[adAxis] = 0;
    }
    if (Math.abs(velocity[wsAxis]) < CLAMP_VELOCITY) {
      velocity[wsAxis] = 0;
    }

    // Update velocity using keys pressed.
    acceleration = data.acceleration;

    if (keys.KeyW || keys.ArrowUp) {
      velocity[wsAxis] -= acceleration * delta;
    }
    if (keys.KeyS || keys.ArrowDown) {
      velocity[wsAxis] += acceleration * delta;
    }
  },

  getMovementVector: (function() {
    var directionVector = new THREE.Vector3(0, 0, 0);
    var rotationEuler = new THREE.Euler(0, 0, 0, "YXZ");

    return function(delta) {
      var rotation = this.el.getAttribute("rotation");
      var velocity = this.velocity;
      var xRotation;

      directionVector.copy(velocity);
      directionVector.multiplyScalar(delta);

      // Absolute.
      if (!rotation) {
        return directionVector;
      }

      // Transform direction relative to heading.
      rotationEuler.set(
        THREE.Math.degToRad(xRotation),
        THREE.Math.degToRad(rotation.y),
        0
      );
      directionVector.applyEuler(rotationEuler);
      return directionVector;
    };
  })(),

  attachVisibilityEventListeners: function() {
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  },

  removeVisibilityEventListeners: function() {
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("focus", this.onFocus);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  },

  attachKeyEventListeners: function() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  },

  removeKeyEventListeners: function() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  },

  onBlur: function() {
    this.pause();
  },

  onFocus: function() {
    this.play();
  },

  onVisibilityChange: function() {
    if (document.hidden) {
      this.onBlur();
    } else {
      this.onFocus();
    }
  },

  onKeyDown: function(event) {
    const keycodeToCode = {
      "38": "ArrowUp",
      "37": "ArrowLeft",
      "40": "ArrowDown",
      "39": "ArrowRight",
      "87": "KeyW",
      "65": "KeyA",
      "83": "KeyS",
      "68": "KeyD"
    };
    const keys = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown"
    ];
    function shouldCaptureKeyEvent(event) {
      if (event.metaKey) {
        return false;
      }
      return document.activeElement === document.body;
    }
    var code;
    if (!shouldCaptureKeyEvent(event)) {
      return;
    }
    code = event.code || keycodeToCode[event.keyCode];
    // if (KEYS.indexOf(code) !== -1) {
    //   this.keys[code] = true;
    // }
  },

  onKeyUp: function(event) {
    const keycodeToCode = {
      "38": "ArrowUp",
      "37": "ArrowLeft",
      "40": "ArrowDown",
      "39": "ArrowRight",
      "87": "KeyW",
      "65": "KeyA",
      "83": "KeyS",
      "68": "KeyD"
    };
    const keys = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown"
    ];
    function shouldCaptureKeyEvent(event) {
      if (event.metaKey) {
        return false;
      }
      return document.activeElement === document.body;
    }
    var code;
    if (!shouldCaptureKeyEvent(event)) {
      return;
    }
    code = event.code || keycodeToCode[event.keyCode];
    if (code == "KeyD" || code == "ArrowRight") {
      this.el.components.player.right();
    } else if (code == "KeyA" || code == "ArrowLeft") {
      this.el.components.player.left();
    }
    if (code == "KeyW" || code == "ArrowUp") {
      this.el.components.player.forward();
    } else if (code == "KeyS" || code == "ArrowDown") {
      this.el.components.player.back();
    }
  }
});

AFRAME.registerShader("floor", {
  schema: {
    u_color: { type: "color", is: "uniform", default: "red" },
    u_opacity: { type: "number", is: "uniform", default: 1.0 },
    u_resolution: {
      type: "vec2",
      is: "uniform",
      default: { x: 700.0, y: 700.0 }
    },
    u_rnd: { type: "number", is: "uniform", default: srand() },
    u_time: { type: "time", is: "uniform" }
  },
  raw: false,
  fragmentShader: `
    precision mediump float;

    uniform vec3 u_color;
    uniform float u_opacity;
    uniform vec2 u_resolution;
    uniform float u_rnd;
    uniform float u_time;

    float box(in vec2 st, in vec2 size){
      size = vec2(0.5) - size * 0.5;
      vec2 uv = smoothstep(size, size + vec2(0.001), st);
      uv *= smoothstep(size, size+vec2(0.001), vec2(1.0) - st);
      return uv.x * uv.y;
    }

    void main () {
      vec2 st = gl_FragCoord.xy / u_resolution;
      vec3 color = vec3(0.0);
      vec2 translate = vec2(1.0 - tan(u_time));
      st += translate * u_rnd;
      color = vec3(0.0, 0.0, st.x * st.x * st.y * st.y * 0.02);
      color += vec3(box(st, vec2(1.95, 0.15)));
      gl_FragColor = vec4(color, 1.0);
    }
  `
});

AFRAME.registerShader("monster", {
  schema: {
    u_color: { type: "color", is: "uniform", default: "red" },
    u_opacity: { type: "number", is: "uniform", default: 1.0 },
    u_resolution: {
      type: "vec2",
      is: "uniform",
      default: { x: 700.0, y: 700.0 }
    },
    u_rnd: { type: "number", is: "uniform", default: srand() },
    u_time: { type: "time", is: "uniform" }
  },
  raw: false,
  fragmentShader: `
    precision mediump float;

    uniform vec3 u_color;
    uniform float u_opacity;
    uniform vec2 u_resolution;
    uniform float u_rnd;
    uniform float u_time;

    void main () {
      vec2 st = gl_FragCoord.xy / u_resolution;
      st *= 10.0;
      vec2 ipos = floor(st);
      vec3 color = vec3(u_rnd * u_color * st.y);

      gl_FragColor = vec4(color, u_opacity);
    }
  `
});

AFRAME.registerShader("sky", {
  schema: {
    u_color: { type: "color", is: "uniform", default: "yellow" },
    u_opacity: { type: "number", is: "uniform", default: 1.0 },
    u_resolution: {
      type: "vec2",
      is: "uniform",
      default: { x: 700.0, y: 700.0 }
    },
    u_rnd: { type: "number", is: "uniform", default: srand() },
    u_time: { type: "time", is: "uniform" }
  },
  raw: false,
  fragmentShader: `
    precision mediump float;

    uniform vec3 u_color;
    uniform vec2 u_resolution;
    uniform float u_opacity;
    uniform float u_rnd;
    uniform float u_time;

    void main () {
      vec2 st = gl_FragCoord.xy/u_resolution;
      float pct = 0.0;
      pct = distance(st, vec2(0.5));
      vec3 color = vec3(0.99 - pct);
      gl_FragColor = vec4(color * abs(sin(1.0 + u_time * u_rnd * 0.01)), 1.0);
    }
  `
});

AFRAME.registerShader("wall", {
  schema: {
    u_color: { type: "color", is: "uniform", default: "black" },
    u_opacity: { type: "number", is: "uniform", default: 1.0 },
    u_resolution: {
      type: "vec2",
      is: "uniform",
      default: { x: 700.0, y: 700.0 }
    },
    u_rnd: { type: "number", is: "uniform", default: srand() },
    u_time: { type: "time", is: "uniform" }
  },
  raw: false,
  fragmentShader: `
    #define PI 3.1415926538
    precision mediump float;
    varying vec2 vUv;

    uniform vec3 u_color;
    uniform float u_opacity;
    uniform vec2 u_resolution;
    uniform float u_rnd;
    uniform float u_time;

    float box(in vec2 st, in vec2 size){
      size = vec2(0.5) - size * 0.5;
      vec2 uv = smoothstep(size, size + vec2(0.001), st);
      uv *= smoothstep(size, size+vec2(0.001), vec2(1.0) - st);
      return uv.x * uv.y;
    }

    mat2 rotate2d(float angle){
      return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    }

    void main () {
      vec2 st = gl_FragCoord.xy / u_resolution;
      float time = u_time / 1000.0;

      vec3 color = vec3(0.0);
      vec2 translate = vec2(1.0-cos(u_time));
      st += translate * u_rnd;
      st += rotate2d( sin(u_time)*PI ) * st;
      color = vec3(0.0, 0.0, st.x * st.x * st.y * st.y * 0.02);
      color += vec3(box(st, vec2(1.95, 0.15)));

      gl_FragColor = mix(
        vec4(mod(vUv , 1.0) * u_rnd * 12.0, 1.0, 1.0),
        vec4(color, 1.0),
        abs(tan(time))
      );

    }
  `,
  vertexShader: `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
  `
});
