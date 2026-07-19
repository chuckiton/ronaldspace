import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { RonaldInput } from "./RonaldInput.js?v=20260719-12";
import { RonaldHistory } from "./RonaldHistory.js";
import { RonaldPath } from "./RonaldPath.js";
import { initialiseRonaldSpace } from "./RonaldSpace.js";
import { THEMES } from "./constants.js";

const RONALD_LETTERS = ["R", "N", "L", "D"];
const ALL_RONALDS = RONALD_LETTERS.flatMap(first =>
    RONALD_LETTERS.flatMap(third =>
        RONALD_LETTERS.flatMap(fifth =>
            RONALD_LETTERS.map(sixth => `${first}O${third}A${fifth}${sixth}`)
        )
    )
);

const scene = new THREE.Scene();
let themeName = "light";
let theme = THEMES[themeName];
scene.background = new THREE.Color(theme.background);

const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    120
);
camera.position.set(18, 13, 22);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.enableRotate = true;
controls.target.set(0, 0, 0);
controls.update();

const space = initialiseRonaldSpace(scene, theme);
const ronalds = [];
let selectedRonald = null;
let identifiedRonalds = 0;
const ronaldCount = document.querySelector("#ronald-count");
const themeToggle = document.querySelector("#theme-toggle");
const unveilAllButton = document.querySelector("#unveil-all");
let hoveredRonald = null;

function findRonald(name) {
    return ronalds.find(ronald => ronald.name === name);
}

function updateRonaldCount() {
    const noun = identifiedRonalds === 1 ? "Ronald" : "Ronalds";
    ronaldCount.textContent = `${identifiedRonalds} ${noun} identified`;
}

function updateUnveilAllButton() {
    unveilAllButton.disabled = ronalds.length === ALL_RONALDS.length;
}

function selectRonald(ronald) {
    if (selectedRonald) {
        selectedRonald.setSelected(false);
    }

    selectedRonald = ronald;
    selectedRonald.setSelected(true);
}

function setHoveredRonald(nextHoveredRonald, departingRonald = null) {
    if (departingRonald && hoveredRonald !== departingRonald) {
        return;
    }

    if (nextHoveredRonald === hoveredRonald) {
        return;
    }

    hoveredRonald?.setHovered(false);
    hoveredRonald = nextHoveredRonald;
    hoveredRonald?.setHovered(true);
    ronalds.forEach(ronald => {
        ronald.setLabelSuppressed(
            hoveredRonald !== null && ronald !== hoveredRonald
        );
    });
    history.setHovered(hoveredRonald);
}

const history = new RonaldHistory({
    onSelect: selectRonald,
    onHoverChange: setHoveredRonald
});

function setTheme(nextThemeName) {
    themeName = nextThemeName;
    theme = THEMES[themeName];
    document.documentElement.dataset.theme = themeName;
    scene.background.set(theme.background);
    space.setTheme(theme);
    ronalds.forEach(ronald => ronald.setTheme(theme));
    history.refresh();
    input.refresh();
    themeToggle.textContent = themeName === "light" ? "Dark mode" : "Light mode";
}

themeToggle.addEventListener("click", () => {
    setTheme(themeName === "light" ? "dark" : "light");
});

function addRonald(name) {
    const ronald = new RonaldPath(scene, name, theme);
    ronald.enableWordLabel();
    ronalds.push(ronald);
    history.add(ronald);
    identifiedRonalds += 1;
    return ronald;
}

function discoverRonald(name) {
    const existingRonald = findRonald(name);

    if (existingRonald) {
        selectRonald(existingRonald);
        return existingRonald;
    }

    ronalds.forEach(ronald => ronald.increaseEntropy());
    history.refresh();
    const ronald = addRonald(name);
    selectRonald(ronald);
    updateRonaldCount();
    updateUnveilAllButton();
    return ronald;
}

const input = new RonaldInput(discoverRonald, findRonald);

unveilAllButton.addEventListener("click", () => {
    const remainingRonalds = ALL_RONALDS.filter(name => !findRonald(name));

    if (remainingRonalds.length === 0) {
        return;
    }

    ronalds.forEach(ronald => ronald.increaseEntropy());
    history.refresh();
    remainingRonalds.forEach(addRonald);
    updateRonaldCount();
    updateUnveilAllButton();
    input.refresh();
});

space.fontReady.then(() => {
    input.setTypefaceReady();
    input.playDemo("RONALD", 260, 600);
});

updateUnveilAllButton();

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;
let hoverFrame = null;

function pickRonald(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);

    const objects = ronalds.flatMap(ronald => ronald.getPickableObjects());
    return raycaster.intersectObjects(objects, false)[0]?.object.userData.ronaldPath ?? null;
}

function updateHoveredRonald(event) {
    const nextHoveredRonald = pickRonald(event);
    setHoveredRonald(nextHoveredRonald);
}

renderer.domElement.addEventListener("pointermove", event => {
    if (pointerStart || hoverFrame) {
        return;
    }

    hoverFrame = requestAnimationFrame(() => {
        hoverFrame = null;
        updateHoveredRonald(event);
    });
});

renderer.domElement.addEventListener("pointerleave", () => {
    if (hoverFrame) {
        cancelAnimationFrame(hoverFrame);
        hoverFrame = null;
    }

    setHoveredRonald(null);
});

renderer.domElement.addEventListener("pointerdown", event => {
    pointerStart = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener("pointerup", event => {
    if (!pointerStart) {
        return;
    }

    const dragDistance = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y
    );
    pointerStart = null;

    if (dragDistance > 4) {
        return;
    }

    const clickedRonald = pickRonald(event);

    if (clickedRonald) {
        selectRonald(clickedRonald);
    }
});

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    ronalds.forEach(ronald => ronald.update(delta, camera, renderer));
    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
