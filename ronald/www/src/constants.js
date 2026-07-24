import * as THREE from "three";

export const COORDINATE_SCALE = 3;
export const PATH_SAMPLES = 240;
export const PATH_GROWTH_PER_SECOND = 105;
export const PATH_RADIAL_SEGMENTS = 8;
export const PATH_TUBE_RADIUS = 0.115;
export const SELECTED_PATH_TUBE_RADIUS = 0.175;
export const END_OVERLAY_SEGMENTS = 28;
export const ENTROPY_STEP = 0.1;

// With five control points, 0.875 lies halfway along RNL → RNLD.
export const WORD_ANCHOR_PROGRESS = 0.875;
export const WORD_SCREEN_WIDTH = 120;
export const WORD_SCREEN_OFFSET = 22;
export const WORD_CHARACTER_PROGRESS = [0.54, 0.58, 0.62, 0.66, 0.70, 0.74];

export const AXIS_LABEL_RADIUS = 4.2;

export const VECTORS = {
    R: new THREE.Vector3(1, 1, 1),
    N: new THREE.Vector3(-1, -1, 1),
    L: new THREE.Vector3(-1, 1, -1),
    D: new THREE.Vector3(1, -1, -1)
};

// Rodneyspace occupies the same tetrahedron, replacing the Ronald L vertex
// with Y. Keeping the geometry shared makes layers feel related rather than
// like separate scenes.
export const RODNEY_VECTORS = {
    R: new THREE.Vector3(1, 1, 1),
    N: new THREE.Vector3(-1, -1, 1),
    Y: new THREE.Vector3(-1, 1, -1),
    D: new THREE.Vector3(1, -1, -1)
};

export const MARTIN_VECTORS = {
    M: new THREE.Vector3(-1, 1, -1),
    R: new THREE.Vector3(1, 1, 1),
    T: new THREE.Vector3(1, -1, -1),
    N: new THREE.Vector3(-1, -1, 1)
};

export const GORDON_VECTORS = {
    G: new THREE.Vector3(-1, 1, -1),
    R: new THREE.Vector3(1, 1, 1),
    D: new THREE.Vector3(1, -1, -1),
    N: new THREE.Vector3(-1, -1, 1)
};

export const GERALD_VECTORS = {
    G: new THREE.Vector3(-1, 1, -1),
    R: new THREE.Vector3(1, 1, 1),
    L: new THREE.Vector3(-1, -1, 1),
    D: new THREE.Vector3(1, -1, -1)
};

// Shared by the Web Audio voices and the live waveform renderer. The four
// name-controlled indices map to oscillator shape, note, chorus-note count,
// and low-pass sweep rate respectively.
// A2, C3, E3 and G3: a true minor-seventh arpeggio with an ascending octave
// continuation for chorus notes beyond the fourth slot.
export const GERALD_FREQUENCIES = [110, 130.81, 164.81, 196];
export const GERALD_CHORUS_GAINS = [1, 0.68, 0.48, 0.34];
export const GERALD_LOW_PASS_SWEEP_RATES = [0.35, 0.8, 1.8, 3.6];
export const GERALD_LOW_PASS_CUTOFF_CENTER = 3200;
export const GERALD_LOW_PASS_CUTOFF_DEPTH = 2600;

export const RONALD_PATTERN = /^[RNLD]O[RNLD]A[RNLD][RNLD]$/;
export const RONALD_TEMPLATE = ["RNLD", "O", "RNLD", "A", "RNLD", "RNLD"];
export const RODNEY_NAME = "RODNEY";
export const RODNEY_PATTERN = /^RODNEY$/;
export const MARTIN_NAME = "MARTIN";
export const MARTIN_PATTERN = /^MARTIN$/;
export const GORDON_NAME = "GORDON";
export const GORDON_PATTERN = /^GORDON$/;
export const GERALD_NAME = "GERALD";
export const GERALD_PATTERN = /^GERALD$/;
export const GODNEY_NAME = "GODNEY";

export const THEMES = {
    light: {
        background: 0xebebeb,
        pathOrigin: 0x2b2d30,
        agedPath: 0xcfccae,
        identityLightness: 0.42,
        axisLabel: "#2b2d30",
        axisLine: 0x6f7378,
        node: 0x6f7378
    },
    dark: {
        background: 0x2b2d30,
        pathOrigin: 0xf4f1ea,
        agedPath: 0xcfccae,
        identityLightness: 0.58,
        axisLabel: "#e8e6e1",
        axisLine: 0xb8babd,
        node: 0xa8abae
    }
};

export const RODNEY_THEME = {
    background: 0x000000,
    pathOrigin: 0xf7f7f7,
    agedPath: 0x4a4a4a,
    identityLightness: 0.48,
    axisLabel: "#ffffff",
    axisLine: 0x666666,
    node: 0x5a5a5a
};

export const MARTIN_THEME = {
    background: 0x06132b,
    pathOrigin: 0xe8f1ff,
    agedPath: 0x1c3156,
    identityLightness: 0.64,
    axisLabel: "#b9d5ff",
    axisLine: 0x4d76ab,
    node: 0x294d7b
};

export const GORDON_THEME = {
    background: 0x17120f,
    pathOrigin: 0xf1e6d2,
    agedPath: 0x57463b,
    identityLightness: 0.58,
    axisLabel: "#f1e6d2",
    axisLine: 0x967c68,
    node: 0x5a463a
};

export const GERALD_THEME = {
    background: 0x1b4d8f,
    pathOrigin: 0xf1f7ff,
    agedPath: 0x48658f,
    identityLightness: 0.61,
    axisLabel: "#f4f8ff",
    axisLine: 0x8db7ff,
    node: 0x5f91ed
};
