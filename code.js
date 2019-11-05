/* global AFRAME */

function mulberry(a = Date.now()) {
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

  linkedCells() {
    // do not call a JS method "links"
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
      return dist.get(cell).toString(36); // Integer 36
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

AFRAME.registerComponent("drone", {
  init: function() {
    const steps = [0, 3, 5, 7, 10];

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
    delayFilter.type = "lowpass";
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
    reverbFilter.type = "lowpass";
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

    function addDrone() {
      const length = 15 + srand() * 25;

      const note = Math.floor(srand() * steps.length);
      const octave = Math.floor(srand() * srand() * 4);

      const freq =
        Math.pow(2, (36 + steps[note] + 12 * octave - 69) / 12) * 440;

      // console.log("Adding Drone: " + length.toFixed(2) + " / " + freq.toFixed(2));

      const oscillatorL = audioCtx.createOscillator();
      oscillatorL.type = "sawtooth";
      oscillatorL.frequency.value = freq;
      oscillatorL.detune.setValueAtTime(
        srand() * 40.0 - 20.0,
        audioCtx.currentTime
      );
      oscillatorL.detune.linearRampToValueAtTime(
        srand() * 40.0 - 20.0,
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
      filter.Q.value = srand() * 2.0;
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

      setTimeout(addDrone, srand() * 10000 + 2500);
    }
    addDrone();
  }
});

AFRAME.registerComponent("game", {
  // dependencies: ["maze", "player", "monster", "wasd-maze"],

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

    function addMonster(parentEl, row, column, direction, material = "color: red") {
      const monsterEl = document.createElement("a-cylinder");
      monsterEl.setAttribute("material", `${material}`);
      monsterEl.setAttribute("theta-start", -150);
      monsterEl.setAttribute("theta-length", 300);
      monsterEl.setAttribute("side", "double");
      monsterEl.setAttribute("monster", {
        row: row,
        column: column,
        direction: direction
      });
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

    addMaze(gameEl, 8, 8);
    addFloor(gameEl, 40, 40, "shader: floor; color: red; opacity: 0.7; transparent: true", 18, 0, -18, -90, 0, 0);
    addSky(gameEl, "shader: sky; color: yellow; opacity: 0.7; transparent: true");
    addPlayer(gameEl, 7, 0, direction.north); // row, column starting at 0
    const monsters = 3;
    for (let m = 0; m < monsters; m++) {
      addMonster(gameEl, randInt(0, 5), randInt(0, 8), direction.north, "shader: monster; color: #ff9002; opacity: 0.7; transparent: true");
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
      newWallEl.setAttribute("geometry", "primitive: box; height: 2; width: 1; depth: 1");
      newWallEl.setAttribute("material", "shader: wall; color: black; opacity: 0.7");
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
    direction: { default: direction.south }
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

  move: function() {},

  tick: function(t, dt) {
    // this.throttled();
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
      console.log(
        row,
        column,
        linkedRow,
        linkedColumn,
        this.direction,
        possibleDirection
      );
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

  move: function(dir) {
    console.log(`moving ${dir}`);
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

  rotate: function() {},

  left: function() {
    this.direction =
      this.direction === 0 ? directionValues.length - 1 : this.direction - 1;
    console.log(`new direction ${this.direction}`);
    this.el.object3D.rotateY(Math.PI / 2);
  },

  right: function() {
    this.direction = (this.direction + 1) % directionValues.length;
    console.log(`new direction ${this.direction}`);
    this.el.object3D.rotateY(-Math.PI / 2);
  },

  forwards: function() {
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
      this.el.components.player.forwards();
    } else if (code == "KeyS" || code == "ArrowDown") {
      this.el.components.player.back();
    }
  }
});

AFRAME.registerShader("floor", {
  schema: {
    color: {type: 'color', is: 'uniform', default: 'red'},
    opacity: {type: 'number', is: 'uniform', default: 1.0}
  },
  raw: false,
  fragmentShader: `
    precision mediump float;

    uniform vec3 color;
    uniform float opacity;

    void main () {
      gl_FragColor = vec4(color, opacity);
    }
  `
});

AFRAME.registerShader("monster", {
  schema: {
    color: {type: 'color', is: 'uniform', default: 'red'},
    opacity: {type: 'number', is: 'uniform', default: 1.0},
    rnd: { type: "number", is: "uniform", default: srand() },
    t: { type: "time", is: "uniform" }
  },
  raw: false,
  fragmentShader: `
    precision mediump float;

    uniform vec3 color;
    uniform float opacity;

    void main () {
      gl_FragColor = vec4(color, opacity);
    }
  `
});

AFRAME.registerShader("sky", {
  schema: {
    color: {type: 'color', is: 'uniform', default: 'yellow'},
    opacity: {type: 'number', is: 'uniform', default: 1.0}
  },
  raw: false,
  fragmentShader: `
    precision mediump float;

    uniform vec3 color;
    uniform float opacity;

    void main () {
      gl_FragColor = vec4(color, opacity);
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

AFRAME.registerShader("wall", {
  schema: {
    color: { type: "color", is: "uniform", default: "black" },
    opacity: { type: "number", is: "uniform", default: 1.0 },
    rnd: { type: "number", is: "uniform", default: srand() },
    t: { type: "time", is: "uniform" }
  },
  raw: false,
  fragmentShader: `
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
  vertexShader: `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
  `
});
