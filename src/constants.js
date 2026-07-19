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

export const RONALD_PATTERN = /^[RNLD]O[RNLD]A[RNLD][RNLD]$/;
export const RONALD_TEMPLATE = ["RNLD", "O", "RNLD", "A", "RNLD", "RNLD"];

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
