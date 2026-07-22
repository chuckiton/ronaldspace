import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { RonaldInput } from "./RonaldInput.js?v=20260720-random-universe-refresh";
import { RonaldHistory } from "./RonaldHistory.js?v=20260720-gordon-facet-picking";
import { RonaldPath } from "./RonaldPath.js?v=20260721-generic-inspector";
import { GordonObject } from "./GordonObject.js?v=20260721-generic-inspector";
import { initialiseRonaldSpace } from "./RonaldSpace.js?v=20260720-gordon-stage";
import { getUniverse, UNIVERSES } from "./universes.js?v=20260720-gordon-stage";

const scene = new THREE.Scene();
// A stable studio key lets facets move through light and shadow when the
// viewer orbits. The separate environment provides the reflected softboxes.
const gordonStageKey = new THREE.DirectionalLight(0xffffff, 5.2);
gordonStageKey.position.set(-12, 15, 10);
gordonStageKey.target.position.set(0, 0, 0);
scene.add(gordonStageKey, gordonStageKey.target);
const themeName = "light";
let universe = "ronald";
const testingTarget = new URLSearchParams(window.location.search).get("test");
let theme = getUniverse(universe).themeFor(themeName);
let targetBackground = new THREE.Color(theme.background);
scene.background = new THREE.Color(theme.background);

const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    120
);
camera.position.set(18, 13, 22);
camera.lookAt(0, 0, 0);
const HOME_CAMERA_POSITION = camera.position.clone();
const HOME_CAMERA_TARGET = new THREE.Vector3();
const CAMERA_ORBIT_AXIS = new THREE.Vector3(0, 1, 0);
const CAMERA_ORBIT_SPEED = THREE.MathUtils.degToRad(6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1;
document.body.appendChild(renderer.domElement);

// This is lighting information only: the visible stage background remains
// unchanged, while physical GORDON facets gain bright studio reflections.
const gordonPmrem = new THREE.PMREMGenerator(renderer);
scene.environment = gordonPmrem.fromScene(new RoomEnvironment(), 0.04).texture;
gordonPmrem.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.enableRotate = true;
controls.target.set(0, 0, 0);
controls.update();

function updateGordonRenderPipeline() {
    const inGordonverse = universe === "gordon";
    renderer.toneMapping = inGordonverse
        ? THREE.ACESFilmicToneMapping
        : THREE.NoToneMapping;
    renderer.toneMappingExposure = inGordonverse ? 1.1 : 1;
}

updateGordonRenderPipeline();

const space = initialiseRonaldSpace(scene, theme, getUniverse(universe).vectors);
const ronalds = [];
let selectedRonald = null;
const identifiedNames = Object.fromEntries(
    Object.keys(UNIVERSES).map(id => [id, 0])
);
const unlockedUniverses = new Set(["ronald"]);
const ronaldCount = document.querySelector("#ronald-count");
const unveilAllButton = document.querySelector("#unveil-all");
const clearAllButton = document.querySelector("#clear-all");
const rodneyWarning = document.querySelector("#rodney-warning");
const cancelRodneyButton = document.querySelector("#cancel-rodney");
const confirmRodneyButton = document.querySelector("#confirm-rodney");
const martinWarning = document.querySelector("#martin-warning");
const cancelMartinButton = document.querySelector("#cancel-martin");
const confirmMartinButton = document.querySelector("#confirm-martin");
const gordonWarning = document.querySelector("#gordon-warning");
const cancelGordonButton = document.querySelector("#cancel-gordon");
const confirmGordonButton = document.querySelector("#confirm-gordon");
const godneyWarning = document.querySelector("#godney-warning");
const acknowledgeGodneyButton = document.querySelector("#acknowledge-godney");
const layerMenu = document.querySelector("#layer-menu");
const abandonGordonButton = document.querySelector("#abandon-gordon");
const orbitCameraButton = document.querySelector("#orbit-camera");
let hoveredRonald = null;
let focusedEntity = null;
let cameraTransition = null;
let cameraOrbiting = false;

const INSPECTOR_EXIT_LABELS = {
    ronald: "thank you RONALD",
    rodney: "forsake RODNEY",
    martin: "disregard MARTIN"
};

function findRonald(name) {
    return ronalds.find(ronald => ronald.universe === universe && ronald.name === name);
}

function activeDefinition() {
    return getUniverse(universe);
}

function isNameInActiveUniverse(name) {
    return activeDefinition().isGeneratedName(name);
}

function updateRonaldCount() {
    const definition = activeDefinition();
    const count = identifiedNames[universe];
    const noun = count === 1 ? definition.noun : definition.plural;
    ronaldCount.textContent = `${count} ${noun} identified`;
}

function updateUnveilAllButton() {
    const definition = activeDefinition();
    const names = definition.allNames;
    const discovered = ronalds.filter(ronald => ronald.universe === universe).length;

    unveilAllButton.textContent = definition.revealLabel;
    unveilAllButton.disabled = discovered === names.length;
}

function updateClearAllButton() {
    const definition = activeDefinition();
    const discovered = ronalds.filter(ronald => ronald.universe === universe).length;

    clearAllButton.textContent = `Clear all ${definition.plural}`;
    clearAllButton.disabled = discovered === 0;
}

function selectRonald(ronald) {
    if (ronald.locked || ronald.universe !== universe) {
        return;
    }
    if (selectedRonald) {
        selectedRonald.setSelected(false);
    }

    selectedRonald = ronald;
    selectedRonald.setSelected(true);
    history.setSelected(selectedRonald);
}

function transitionCamera(position, target, duration) {
    cameraTransition = {
        startPosition: camera.position.clone(),
        startTarget: controls.target.clone(),
        endPosition: position.clone(),
        endTarget: target.clone(),
        duration,
        elapsed: 0
    };
    controls.enabled = false;
}

function updateCameraTransition(delta) {
    if (!cameraTransition) {
        return;
    }

    cameraTransition.elapsed = Math.min(
        cameraTransition.duration,
        cameraTransition.elapsed + delta
    );
    const progress = THREE.MathUtils.smootherstep(
        cameraTransition.elapsed / cameraTransition.duration,
        0,
        1
    );
    camera.position.lerpVectors(
        cameraTransition.startPosition,
        cameraTransition.endPosition,
        progress
    );
    controls.target.lerpVectors(
        cameraTransition.startTarget,
        cameraTransition.endTarget,
        progress
    );

    if (cameraTransition.elapsed === cameraTransition.duration) {
        cameraTransition = null;
        controls.enabled = true;
    }
}

function cameraOrbitTarget() {
    return focusedEntity
        ? focusedEntity.getFocusTarget()
        : HOME_CAMERA_TARGET.clone();
}

function setCameraOrbiting(orbiting) {
    cameraOrbiting = orbiting;
    orbitCameraButton.setAttribute("aria-pressed", String(cameraOrbiting));

    if (!cameraOrbiting || cameraTransition) {
        return;
    }

    const target = cameraOrbitTarget();
    if (controls.target.distanceToSquared(target) > 0.0001) {
        transitionCamera(camera.position.clone(), target, 0.3);
    }
}

function toggleCameraOrbit() {
    setCameraOrbiting(!cameraOrbiting);
}

function updateCameraOrbit(delta) {
    if (!cameraOrbiting || cameraTransition) {
        return;
    }

    const target = cameraOrbitTarget();
    const offset = camera.position.clone().sub(target);
    offset.applyAxisAngle(CAMERA_ORBIT_AXIS, -CAMERA_ORBIT_SPEED * delta);
    camera.position.copy(target).add(offset);
    controls.target.copy(target);
}

function focusEntity(ronald) {
    if (ronald.locked || ronald.universe !== universe) {
        return;
    }

    selectRonald(ronald);
    focusedEntity = ronald;
    const exitLabel = INSPECTOR_EXIT_LABELS[ronald.universe]
        ?? `Abandon ${ronald.name}`;
    abandonGordonButton.textContent = exitLabel;
    abandonGordonButton.setAttribute("aria-label", exitLabel);
    abandonGordonButton.hidden = false;

    const viewingDirection = camera.position.clone()
        .sub(controls.target)
        .normalize();
    const distance = Math.max(8, ronald.getFocusRadius() * 3);
    const target = ronald.getFocusTarget();
    const position = target.clone().addScaledVector(viewingDirection, distance);
    transitionCamera(position, target, 0.38);
}

function abandonFocus() {
    focusedEntity = null;
    abandonGordonButton.textContent = "Abandon GORDON";
    abandonGordonButton.setAttribute("aria-label", "Abandon GORDON");
    abandonGordonButton.hidden = true;
    transitionCamera(HOME_CAMERA_POSITION, HOME_CAMERA_TARGET, 0.48);
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

function selectFromHistory(ronald) {
    focusEntity(ronald);
}

const history = new RonaldHistory({
    onSelect: selectFromHistory,
    onHoverChange: setHoveredRonald
});

function addRonald(name) {
    if (!isNameInActiveUniverse(name)) {
        return null;
    }

    const ronald = activeDefinition().objectGenerator
        ? new GordonObject(scene, name, theme, { universe })
        : new RonaldPath(scene, name, theme, {
        universe
        });
    ronald.enableWordLabel();
    ronalds.push(ronald);
    history.add(ronald);
    identifiedNames[universe] += 1;
    return ronald;
}

function discoverRonald(name) {
    if (!isNameInActiveUniverse(name)) {
        return null;
    }

    const existingRonald = findRonald(name);

    if (existingRonald) {
        selectRonald(existingRonald);
        return existingRonald;
    }

    ronalds.filter(ronald => ronald.universe === universe).forEach(ronald => ronald.increaseEntropy());
    history.refresh();
    const ronald = addRonald(name);
    selectRonald(ronald);
    updateRonaldCount();
    updateUnveilAllButton();
    updateClearAllButton();
    return ronald;
}

const input = new RonaldInput(
    discoverRonald,
    findRonald,
    transition => {
        if (transition.id === "godney-invocation") {
            openGodneyWarning();
            return;
        }

        if (transition.id === "universe-navigation") {
            setUniverse(transition.to);
            return;
        }

        if (transition.id === "rodney-incursion") {
            openRodneyWarning();
            return;
        }

        if (transition.id === "martin-discovery") {
            openMartinWarning();
            return;
        }

        if (transition.id === "gordon-discovery") {
            openGordonWarning();
        }
    }
);

function updateUniverseNavigations() {
    input.setUniverseNavigations(
        [...unlockedUniverses]
            .filter(id => id !== universe)
            .map(id => ({ name: getUniverse(id).initialBuilderName, to: id }))
    );
}

updateUniverseNavigations();

unveilAllButton.addEventListener("click", () => {
    const names = activeDefinition().allNames;
    const remainingRonalds = names.filter(name => !findRonald(name));

    if (remainingRonalds.length === 0) {
        return;
    }

    ronalds.filter(ronald => ronald.universe === universe).forEach(ronald => ronald.increaseEntropy());
    history.refresh();
    remainingRonalds.forEach(addRonald);
    updateRonaldCount();
    updateUnveilAllButton();
    updateClearAllButton();
    input.refresh();
});

clearAllButton.addEventListener("click", () => {
    if (focusedEntity) {
        abandonFocus();
    }
    selectedRonald?.setSelected(false);
    selectedRonald = null;
    history.setSelected(null);
    setHoveredRonald(null);

    for (let index = ronalds.length - 1; index >= 0; index -= 1) {
        const ronald = ronalds[index];

        if (ronald.universe !== universe) {
            continue;
        }

        history.remove(ronald);
        ronald.dispose();
        ronalds.splice(index, 1);
    }

    identifiedNames[universe] = 0;
    updateRonaldCount();
    updateUnveilAllButton();
    updateClearAllButton();
    input.refresh();
});

function setUniverse(nextUniverse) {
    if (nextUniverse === universe || !unlockedUniverses.has(nextUniverse)) {
        return;
    }

    if (focusedEntity) {
        abandonFocus();
    }
    selectedRonald?.setSelected(false);
    selectedRonald = null;
    history.setSelected(null);
    setHoveredRonald(null);
    ronalds.filter(ronald => ronald.universe === universe).forEach(ronald => {
        ronald.ageToMaximumEntropy();
        ronald.setLocked(true);
    });
    universe = nextUniverse;
    updateGordonRenderPipeline();
    document.documentElement.dataset.universe = universe;
    const definition = activeDefinition();
    theme = definition.themeFor(themeName);
    targetBackground.set(theme.background);
    space.setTheme(theme);
    space.setVectors(definition.vectors);
    ronalds.forEach(ronald => {
        ronald.setTheme(ronald.definition.themeFor(themeName));
        if (ronald.universe === universe) {
            // The entropy lock only protects the inactive layer during an
            // incursion. Returning restores both vitality and interaction.
            ronald.setLocked(false);
            ronald.recoverVitality();
        }
        ronald.setUniverseVisible(ronald.universe === universe);
    });
    history.setUniverse(universe);
    input.setUniverse(universe);
    updateUniverseNavigations();
    updateRonaldCount();
    updateUnveilAllButton();
    updateClearAllButton();
}

function unlockUniverse(id) {
    unlockedUniverses.add(id);
    document.documentElement.dataset[`${id}Access`] = "true";
    updateUniverseNavigations();
}

function openRodneyWarning() {
    rodneyWarning.hidden = false;
    cancelRodneyButton.focus();
}

function closeRodneyWarning() {
    rodneyWarning.hidden = true;
    input.clearEntry();
}

cancelRodneyButton.addEventListener("click", closeRodneyWarning);
confirmRodneyButton.addEventListener("click", () => {
    closeRodneyWarning();
    unlockUniverse("rodney");
    setUniverse("rodney");
    discoverRonald("RODNEY");
});

function openMartinWarning() {
    martinWarning.hidden = false;
    cancelMartinButton.focus();
}

function closeMartinWarning() {
    martinWarning.hidden = true;
    input.clearEntry();
}

cancelMartinButton.addEventListener("click", closeMartinWarning);
confirmMartinButton.addEventListener("click", () => {
    closeMartinWarning();
    unlockUniverse("martin");
    setUniverse("martin");
    discoverRonald("MARTIN");
});

function openGordonWarning() {
    gordonWarning.hidden = false;
    cancelGordonButton.focus();
}

function closeGordonWarning() {
    gordonWarning.hidden = true;
    input.clearEntry();
}

cancelGordonButton.addEventListener("click", closeGordonWarning);
confirmGordonButton.addEventListener("click", () => {
    closeGordonWarning();
    unlockUniverse("gordon");
    setUniverse("gordon");
    discoverRonald("GORDON");
});

function openGodneyWarning() {
    godneyWarning.hidden = false;
    acknowledgeGodneyButton.focus();
}

function closeGodneyWarning() {
    godneyWarning.hidden = true;
    input.clearEntry();
}

acknowledgeGodneyButton.addEventListener("click", closeGodneyWarning);
abandonGordonButton.addEventListener("click", abandonFocus);
orbitCameraButton.addEventListener("click", toggleCameraOrbit);

window.addEventListener("keydown", event => {
    if (event.code === "Space" && !event.repeat) {
        const warningOpen = !rodneyWarning.hidden
            || !martinWarning.hidden
            || !gordonWarning.hidden
            || !godneyWarning.hidden;

        if (!warningOpen) {
            event.preventDefault();
            toggleCameraOrbit();
        }
        return;
    }

    if (event.key !== "Enter" || event.repeat) {
        return;
    }

    const acceptButton = !rodneyWarning.hidden
        ? confirmRodneyButton
        : !martinWarning.hidden
        ? confirmMartinButton
        : !gordonWarning.hidden
        ? confirmGordonButton
        : !godneyWarning.hidden
        ? acknowledgeGodneyButton
        : null;

    if (!acceptButton) {
        return;
    }

    // Dialogues are div-based rather than native forms, so explicitly make
    // Enter their affirmative action instead of activating the focused cancel
    // button or submitting the name entry behind the dialogue.
    event.preventDefault();
    acceptButton.click();
});

layerMenu.addEventListener("click", event => {
    const layer = event.target.closest("[data-layer]")?.dataset.layer;
    if (layer) setUniverse(layer);
});

if (testingTarget === "gordon") {
    // Deliberately URL-only: this is a test harness, not a discoverable app
    // control. It grants the route and materialises a useful reference gem.
    ["rodney", "martin", "gordon"].forEach(unlockUniverse);
    setUniverse("gordon");
    discoverRonald("GORDON");
}

space.fontReady.then(() => {
    input.setTypefaceReady();
    if (testingTarget === "gordon") {
        input.clearEntry();
        return;
    }
    input.playDemo(getUniverse("ronald").demoName, 260, 600);
});

updateUnveilAllButton();
updateClearAllButton();

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;
let canvasTap = false;
let hoverFrame = null;

function pickRonald(event, allowNearestGordon = false) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);

    const objects = ronalds.flatMap(ronald => ronald.getPickableObjects());
    const raycastHits = raycaster.intersectObjects(objects, false);
    // The expanded GORDON spheres make a forgiving fallback, but may overlap
    // in perspective. A real facet is therefore always the first authority.
    const visibleSurfaceHit = raycastHits.find(
        hit => !hit.object.userData.gordonPickProxy
    )?.object.userData.ronaldPath;
    // Gemstone transmission means two real volumes can intersect in the
    // raycast stack even though one is visibly behind the other. In the
    // GORDONverse, the nearest projected crystal is the faithful answer to
    // "the one I clicked"; its footprint is based on the actual geometry's
    // bounding radius, not the invisible recovery sphere.
    const projectedGordonHit = pickGordonOnScreen(event, bounds, allowNearestGordon);
    return projectedGordonHit ?? visibleSurfaceHit;
}

function pickGordonOnScreen(event, bounds, allowNearestGordon) {
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    let closestGordon = null;
    let closestScore = Infinity;
    let activeGordonCount = 0;

    ronalds.forEach(ronald => {
        if (
            ronald.universe !== "gordon"
            || ronald.locked
            || ronald.inactiveUniverse
            || !ronald.object.visible
        ) {
            return;
        }
        activeGordonCount += 1;

        const centre = ronald.object.getWorldPosition(new THREE.Vector3());
        const projectedCentre = centre.clone().project(camera);

        if (projectedCentre.z < -1 || projectedCentre.z > 1) {
            return;
        }

        const projectedEdge = centre.addScaledVector(cameraRight, ronald.getFocusRadius())
            .project(camera);
        const screenCentreX = bounds.left + (projectedCentre.x + 1) * bounds.width / 2;
        const screenCentreY = bounds.top + (1 - projectedCentre.y) * bounds.height / 2;
        const screenRadius = Math.max(
            28,
            Math.hypot(
                (projectedEdge.x - projectedCentre.x) * bounds.width / 2,
                (projectedEdge.y - projectedCentre.y) * bounds.height / 2
            )
        );
        const score = Math.hypot(
            event.clientX - screenCentreX,
            event.clientY - screenCentreY
        ) / screenRadius;

        if (score < closestScore) {
            closestGordon = ronald;
            closestScore = score;
        }
    });

    if (closestScore <= 1) {
        return closestGordon;
    }

    // A click/double-click is intentional. Give a lone GORDON—or the nearest
    // visible one within a generous inspection zone—the benefit of the doubt
    // when transparent facets make a hardware ray miss.
    return allowNearestGordon && (activeGordonCount === 1 || closestScore <= 2.2)
        ? closestGordon
        : null;
}

function updateHoveredRonald(event) {
    const nextHoveredRonald = pickRonald(event);
    setHoveredRonald(nextHoveredRonald);
}

function selectRonaldAt(event) {
    const clickedRonald = pickRonald(event, true);
    if (clickedRonald) {
        selectRonald(clickedRonald);
    }
    return clickedRonald;
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
    canvasTap = false;
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
    canvasTap = dragDistance <= 4;

    if (canvasTap) {
        selectRonaldAt(event);
    }
});

renderer.domElement.addEventListener("click", event => {
    if (!canvasTap) {
        return;
    }

    canvasTap = false;
    selectRonaldAt(event);
});

renderer.domElement.addEventListener("dblclick", event => {
    const clickedRonald = pickRonald(event, true);

    if (clickedRonald) {
        event.preventDefault();
        focusEntity(clickedRonald);
    }
});

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    scene.background.lerp(targetBackground, Math.min(1, delta * 1.8));
    ronalds.forEach(ronald => ronald.update(delta, camera, renderer));
    updateCameraTransition(delta);
    updateCameraOrbit(delta);
    controls.update();
    renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
