import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { RonaldInput } from "./RonaldInput.js";
import { RonaldHistory } from "./RonaldHistory.js";
import { RonaldPath } from "./RonaldPath.js";
import { GordonObject } from "./GordonObject.js";
import { GeraldSynth } from "./GeraldSynth.js";
import { initialiseRonaldSpace } from "./RonaldSpace.js";
import { getUniverse, UNIVERSES } from "./universes.js";

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
const HOME_CAMERA_UP = camera.up.clone();
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
const selectedRonalds = new Set();
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
const geraldWarning = document.querySelector("#gerald-warning");
const cancelGeraldButton = document.querySelector("#cancel-gerald");
const confirmGeraldButton = document.querySelector("#confirm-gerald");
const godneyWarning = document.querySelector("#godney-warning");
const acknowledgeGodneyButton = document.querySelector("#acknowledge-godney");
const layerMenu = document.querySelector("#layer-menu");
const inspectorExitButton = document.querySelector("#abandon-gordon");
const orbitCameraButton = document.querySelector("#orbit-camera");
const geraldSynth = new GeraldSynth();
let hoveredRonald = null;
let focusedEntity = null;
let cameraTransition = null;
let cameraOrbiting = false;
let orbitStartedByFocus = false;

const INSPECTOR_EXIT_PREFIXES = {
    ronald: "Thank you, ",
    rodney: "Begone, ",
    martin: "Disregard ",
    gordon: "Forsake ",
    gerald: "Mute "
};

function setInspectorExitLabel(ronald) {
    if (!ronald) {
        return;
    }

    const prefix = INSPECTOR_EXIT_PREFIXES[ronald.universe];
    if (!prefix) {
        return;
    }
    const label = `${prefix}${ronald.name}`;
    inspectorExitButton.textContent = label;
    inspectorExitButton.setAttribute("aria-label", label);
}

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

function updateGeraldAudition() {
    const selectedNames = [...selectedRonalds]
        .filter(ronald => ronald.universe === "gerald")
        .map(ronald => ronald.name);
    const hoverOnly = hoveredRonald?.universe === "gerald"
        && !selectedRonalds.has(hoveredRonald);
    const names = focusedEntity?.universe === "gerald"
        ? [focusedEntity.name]
        : hoverOnly
        ? [hoveredRonald.name]
        : selectedNames.length > 0
        ? selectedNames
        : hoveredRonald?.universe === "gerald"
        ? [hoveredRonald.name]
        : [];
    const scrutiny = focusedEntity?.universe === "gerald"
        ? 3
        : hoverOnly
        ? 1
        : selectedNames.length > 0
        ? 2
        : hoveredRonald?.universe === "gerald"
        ? 1
        : 0;
    geraldSynth.setNames(names);
    geraldSynth.setScrutiny(scrutiny);
}

function selectRonald(ronald, {
    additive = false,
    audition = false,
    toggleSame = false
} = {}) {
    if (ronald.locked || ronald.universe !== universe) {
        return;
    }

    if (toggleSame && !additive && selectedRonald === ronald && selectedRonalds.size === 1) {
        ronald.setSelected(false);
        selectedRonalds.clear();
        selectedRonald = null;
        history.setSelected(null);
        if (focusedEntity === ronald) abandonFocus();
        updateGeraldAudition();
        return;
    }

    if (additive) {
        if (selectedRonalds.has(ronald)) {
            ronald.setSelected(false);
            selectedRonalds.delete(ronald);
            if (selectedRonald === ronald) {
                selectedRonald = [...selectedRonalds].at(-1) ?? null;
            }
        } else {
            ronald.setSelected(true);
            selectedRonalds.add(ronald);
            selectedRonald = ronald;
        }
    } else {
        selectedRonalds.forEach(selected => {
            if (selected !== ronald) selected.setSelected(false);
        });
        selectedRonalds.clear();
        selectedRonalds.add(ronald);
        selectedRonald = ronald;
        ronald.setSelected(true);
    }

    history.setSelected(selectedRonald);
    if (audition && ronald.universe === "gerald") {
        geraldSynth.setEnabled(true);
    }
    updateGeraldAudition();
}

function clearActiveSelection() {
    selectedRonalds.forEach(selected => selected.setSelected(false));
    selectedRonalds.clear();
    selectedRonald = null;
    history.setSelected(null);
    setHoveredRonald(null);
    if (focusedEntity) abandonFocus();
    updateGeraldAudition();
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

function focusEntity(ronald, { activateOrbit = false } = {}) {
    if (ronald.locked || ronald.universe !== universe) {
        return;
    }

    if (focusedEntity && focusedEntity !== ronald) {
        focusedEntity.setInspection?.(false);
    }
    selectRonald(ronald, { audition: true });
    ronald.triggerShiver?.(0.105);
    ronald.setInspection?.(true);
    focusedEntity = ronald;
    setInspectorExitLabel(ronald);
    inspectorExitButton.hidden = false;

    const target = ronald.getFocusTarget();
    const inspectionViewDirection = ronald.getInspectionViewDirection?.();
    const inspectionUpDirection = ronald.getInspectionUpDirection?.();
    camera.up.copy(inspectionUpDirection ?? HOME_CAMERA_UP);
    const viewingDirection = inspectionViewDirection ?? camera.position.clone()
        .sub(controls.target)
        .normalize();
    const distance = ronald.getInspectionDistance?.(camera)
        ?? Math.max(8, ronald.getFocusRadius() * 3);
    const position = target.clone().addScaledVector(viewingDirection, distance);
    transitionCamera(position, target, 0.38);

    if (activateOrbit && !cameraOrbiting) {
        orbitStartedByFocus = true;
        setCameraOrbiting(true);
    }
    updateGeraldAudition();
}

function abandonFocus() {
    const dismissedEntity = focusedEntity;
    dismissedEntity?.setInspection?.(false);
    focusedEntity = null;
    camera.up.copy(HOME_CAMERA_UP);
    if (orbitStartedByFocus) {
        orbitStartedByFocus = false;
        setCameraOrbiting(false);
    }
    setInspectorExitLabel(dismissedEntity);
    inspectorExitButton.hidden = true;
    transitionCamera(HOME_CAMERA_POSITION, HOME_CAMERA_TARGET, 0.48);
    updateGeraldAudition();
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
    updateGeraldAudition();
}

function selectFromHistory(ronald, event) {
    if (event?.shiftKey) {
        selectRonald(ronald, { additive: true, audition: true });
        return;
    }
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

function discoverRonald(name, { audition = false } = {}) {
    if (!isNameInActiveUniverse(name)) {
        return null;
    }

    const existingRonald = findRonald(name);

    if (existingRonald) {
        selectRonald(existingRonald, { audition });
        return existingRonald;
    }

    ronalds.filter(ronald => ronald.universe === universe).forEach(ronald => ronald.increaseEntropy());
    history.refresh();
    const ronald = addRonald(name);
    selectRonald(ronald, { audition });
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
            return;
        }

        if (transition.id === "gerald-discovery") {
            openGeraldWarning();
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
    selectedRonalds.forEach(selected => selected.setSelected(false));
    selectedRonalds.clear();
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
    selectedRonalds.forEach(selected => selected.setSelected(false));
    selectedRonalds.clear();
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
    geraldSynth.setVisible(universe === "gerald");
    updateGeraldAudition();
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

function openGeraldWarning() {
    geraldWarning.hidden = false;
    cancelGeraldButton.focus();
}

function closeGeraldWarning() {
    geraldWarning.hidden = true;
    input.clearEntry();
}

cancelGeraldButton.addEventListener("click", closeGeraldWarning);
confirmGeraldButton.addEventListener("click", () => {
    closeGeraldWarning();
    unlockUniverse("gerald");
    setUniverse("gerald");
    discoverRonald("GERALD");
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
inspectorExitButton.addEventListener("click", abandonFocus);
orbitCameraButton.addEventListener("click", toggleCameraOrbit);

window.addEventListener("keydown", event => {
    if (event.code === "Space" && !event.repeat) {
        const warningOpen = !rodneyWarning.hidden
            || !martinWarning.hidden
            || !gordonWarning.hidden
            || !geraldWarning.hidden
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
        : !geraldWarning.hidden
        ? confirmGeraldButton
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

if (testingTarget === "gordon" || testingTarget === "gerald") {
    // Deliberately URL-only: this is a test harness, not a discoverable app
    // control. It grants the route and materialises a useful reference gem.
    ["rodney", "martin", "gordon", "gerald"].forEach(unlockUniverse);
    setUniverse(testingTarget);
    discoverRonald(testingTarget === "gerald" ? "GERALD" : "GORDON");
}

space.fontReady.then(() => {
    input.setTypefaceReady();
    if (testingTarget === "gordon" || testingTarget === "gerald") {
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

function pointerInsideGeraldRing(ronald, event) {
    if (ronald?.universe !== "gerald") {
        return false;
    }

    const bounds = renderer.domElement.getBoundingClientRect();
    const centre = ronald.getFocusTarget();
    const projectedCentre = centre.clone().project(camera);
    if (projectedCentre.z < -1 || projectedCentre.z > 1) {
        return false;
    }

    // Use the complete local bounding sphere rather than the currently
    // visible waveform segments. This keeps the hover target stable while the
    // live crown rotates through the pointer.
    const radius = ronald.getFocusRadius();
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const screenCentreX = bounds.left + (projectedCentre.x + 1) * bounds.width / 2;
    const screenCentreY = bounds.top + (1 - projectedCentre.y) * bounds.height / 2;
    const projectedRight = centre.clone()
        .addScaledVector(cameraRight, radius)
        .project(camera);
    const projectedUp = centre.clone()
        .addScaledVector(cameraUp, radius)
        .project(camera);
    const screenRadius = Math.max(
        28,
        Math.hypot(
            (projectedRight.x - projectedCentre.x) * bounds.width / 2,
            (projectedRight.y - projectedCentre.y) * bounds.height / 2
        ),
        Math.hypot(
            (projectedUp.x - projectedCentre.x) * bounds.width / 2,
            (projectedUp.y - projectedCentre.y) * bounds.height / 2
        )
    );

    return Math.hypot(
        event.clientX - screenCentreX,
        event.clientY - screenCentreY
    ) <= screenRadius;
}

function updateHoveredRonald(event) {
    if (
        hoveredRonald?.universe === "gerald"
        && pointerInsideGeraldRing(hoveredRonald, event)
    ) {
        return;
    }
    const nextHoveredRonald = pickRonald(event);
    setHoveredRonald(nextHoveredRonald);
}

function selectRonaldAt(event) {
    const clickedRonald = pickRonald(event, true);
    if (clickedRonald) {
        selectRonald(clickedRonald, {
            additive: event.shiftKey,
            audition: true,
            toggleSame: true
        });
    } else if (!event.shiftKey) {
        clearActiveSelection();
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
        focusEntity(clickedRonald, {
            activateOrbit: clickedRonald.universe !== "gerald"
        });
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
