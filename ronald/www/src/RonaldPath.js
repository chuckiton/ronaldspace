import * as THREE from "three";

import {
    END_OVERLAY_SEGMENTS,
    ENTROPY_STEP,
    GERALD_DISTORTION_DRIVE,
    GERALD_HARMONIC_GAINS,
    PATH_GROWTH_PER_SECOND,
    PATH_RADIAL_SEGMENTS,
    PATH_SAMPLES,
    PATH_TUBE_RADIUS,
    SELECTED_PATH_TUBE_RADIUS,
    WORD_ANCHOR_PROGRESS,
    WORD_CHARACTER_PROGRESS,
    WORD_SCREEN_OFFSET,
    WORD_SCREEN_WIDTH
} from "./constants.js?v=20260722-gerald-live-wave";
import {
    geraldWaveValue,
    getUniverse
} from "./universes.js?v=20260722-gerald-live-wave";

const WORD_LABEL_OPACITY = 0.94;
const WORD_LABEL_FADE_SECONDS = 0.3;
const UNSELECTED_PATH_OPACITY = 0.56;
const ACTIVE_PATH_OPACITY = 0.74;
const INACTIVE_UNIVERSE_PATH_OPACITY = 0.075;
const LANE_OFFSET_DISTANCE = 0.075;
const MARTIN_ORBIT_SECONDS = 7;
// Each fixed orbit segment ages from the moment the MARTIN passes it. The
// lifetime is one orbit, so no residual colour survives into a second pass.
const MARTIN_TRAIL_LIFETIME_SECONDS = MARTIN_ORBIT_SECONDS;
const MARTIN_HEAD_LENGTH = 0.075;
const MARTIN_COLOUR_LENGTH = 0.34;
const MARTIN_PHASE_SLOTS = 256;
const MARTIN_PARAMETER_INDEX = { M: 0, R: 1, T: 2, N: 3 };
const GERALD_IDLE_ROTATION_SPEED = 0.105;
// Keep the live waveform's rapid motion readable without changing its audio
// recipe or temporal rate.
const GERALD_LIVE_VISUAL_AMPLITUDE = 0.58;

function distortedGeraldWave(value, distortion) {
    const drive = GERALD_DISTORTION_DRIVE[distortion] ?? 0;
    if (drive === 0) return value;
    const amount = 1 + drive * 0.08;
    return Math.tanh(value * amount) / Math.tanh(amount);
}

function liveGeraldWaveValue(crown, progress, temporalPhase) {
    let value = 0;
    let totalGain = 0;

    for (let harmonic = 0; harmonic <= crown.harmonics; harmonic += 1) {
        const gain = GERALD_HARMONIC_GAINS[harmonic];
        const phase = (progress * crown.cycles + temporalPhase) * (harmonic + 1);
        value += geraldWaveValue(crown.waveform, phase) * gain;
        totalGain += gain;
    }

    return distortedGeraldWave(value / totalGain, crown.distortion);
}

const MARTIN_TRAIL_VERTEX_SHADER = `
    attribute vec3 color;
    attribute float trailOpacity;
    varying vec3 vTrailColour;
    varying float vTrailOpacity;

    void main() {
        vTrailColour = color;
        vTrailOpacity = trailOpacity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const MARTIN_TRAIL_FRAGMENT_SHADER = `
    uniform float uGlobalOpacity;
    varying vec3 vTrailColour;
    varying float vTrailOpacity;

    void main() {
        float opacity = vTrailOpacity * uGlobalOpacity;
        if (opacity < 0.001) discard;
        gl_FragColor = vec4(vTrailColour, opacity);
    }
`;

const GERALD_INSPECTOR_VERTEX_SHADER = `
    attribute vec3 color;
    uniform vec3 uFadeCentre;
    varying vec3 vGeraldColour;
    varying float vGeraldDepth;

    void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vGeraldColour = color;
        vGeraldDepth = dot(
            worldPosition.xyz - uFadeCentre,
            normalize(cameraPosition - uFadeCentre)
        );
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

const GERALD_INSPECTOR_FRAGMENT_SHADER = `
    uniform float uFadeEnabled;
    uniform float uFadeRadius;
    varying vec3 vGeraldColour;
    varying float vGeraldDepth;

    void main() {
        float backFade = smoothstep(
            -uFadeRadius,
            -uFadeRadius * 0.12,
            vGeraldDepth
        );
        // Keep the rear projection present as depth information, but quiet
        // enough that it cannot compete with the front 2D reading.
        float opacity = 0.22 + 0.78 * backFade;
        opacity = mix(1.0, opacity, uFadeEnabled) * 0.94;
        if (opacity < 0.004) discard;
        gl_FragColor = vec4(vGeraldColour, opacity);
    }
`;

function createMartinOrbitMaterial(opacity = 1) {
    return new THREE.ShaderMaterial({
        vertexShader: MARTIN_TRAIL_VERTEX_SHADER,
        fragmentShader: MARTIN_TRAIL_FRAGMENT_SHADER,
        uniforms: {
            uGlobalOpacity: { value: opacity }
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
    });
}

function createGeraldInspectorMaterial() {
    return new THREE.ShaderMaterial({
        vertexShader: GERALD_INSPECTOR_VERTEX_SHADER,
        fragmentShader: GERALD_INSPECTOR_FRAGMENT_SHADER,
        uniforms: {
            uFadeEnabled: { value: 0 },
            uFadeCentre: { value: new THREE.Vector3() },
            uFadeRadius: { value: 1 }
        },
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
}

function laneOffsetForName(name) {
    let hash = 0;

    for (const letter of name) {
        hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
    }

    const offset = new THREE.Vector3(
        ((hash & 0xff) / 255) - 0.5,
        (((hash >>> 8) & 0xff) / 255) - 0.5,
        (((hash >>> 16) & 0xff) / 255) - 0.5
    );

    return offset.normalize().multiplyScalar(LANE_OFFSET_DISTANCE);
}

function martinPhaseForName(name) {
    const parameters = [name[0], name[2], name[3], name[5]];
    const parameterIndex = parameters.reduce(
        (index, letter) => index * 4 + MARTIN_PARAMETER_INDEX[letter],
        0
    );

    // The 256 valid four-parameter combinations occupy evenly spaced phase
    // slots. The first name starts at zero and the final name sits just
    // before the wrap, keeping the two endpoints visually distinct.
    return parameterIndex / MARTIN_PHASE_SLOTS;
}

function createWordLabel(scene, name, curve, colour) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;

    const context = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.25),
        new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            opacity: 0,
            side: THREE.DoubleSide
        })
    );

    label.renderOrder = 2;
    label.visible = false;
    scene.add(label);

    const tangent = curve.getTangent(WORD_ANCHOR_PROGRESS).normalize();
    const referenceUp = Math.abs(tangent.dot(new THREE.Vector3(0, 1, 0))) > 0.95
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const up = referenceUp.addScaledVector(tangent, -referenceUp.dot(tangent)).normalize();

    return {
        canvas,
        context,
        texture,
        label,
        name,
        colour,
        anchor: curve.getPoint(WORD_ANCHOR_PROGRESS),
        tangent,
        up,
        normal: new THREE.Vector3().crossVectors(tangent, up).normalize(),
        visibleCharacters: 0
    };
}

function drawWord(word, visibleCharacters) {
    word.context.clearRect(0, 0, word.canvas.width, word.canvas.height);
    word.context.fillStyle = `#${word.colour.getHexString()}`;
    word.context.font = "80px ProFont, monospace";
    word.context.textAlign = "center";
    word.context.textBaseline = "middle";
    word.context.fillText(word.name.slice(0, visibleCharacters), 256, 64);
    word.texture.needsUpdate = true;
    word.visibleCharacters = visibleCharacters;
}

export class RonaldPath {
    constructor(scene, name, theme, { universe = "ronald" } = {}) {
        this.scene = scene;
        this.name = name;
        this.theme = theme;
        this.universe = universe;
        this.definition = getUniverse(universe);
        this.locked = false;
        this.inactiveUniverse = false;
        this.visibleSegments = 0;
        this.ready = false;
        this.selected = false;
        this.hovered = false;
        this.labelSuppressed = false;
        this.word = null;
        this.entropy = 0;
        this.labelFadeProgress = 0;
        this.laneOffset = laneOffsetForName(name);
        this.closedPath = Boolean(this.definition.closedPath);
        this.isMartin = universe === "martin";
        this.isGerald = universe === "gerald";
        this.geraldCrown = this.isGerald
            ? this.definition.crownForName(name)
            : null;
        this.geraldAudioPhase = 0;
        this.geraldShiver = 0;
        this.geraldShiverPhase = 0;
        this.geraldShiverSide = this.isGerald
            ? new THREE.Vector3().crossVectors(
                this.geraldCrown.axis,
                this.geraldCrown.viewDirection
            ).normalize()
            : null;
        this.geraldInspecting = false;
        this.martinOrbitProgress = this.isMartin ? martinPhaseForName(name) : 0;
        this.martinSegmentAges = this.isMartin
            ? new Float32Array(PATH_SAMPLES).fill(-1)
            : null;
        this.martinRevealProgress = 0;
        this.martinBaseOpacity = UNSELECTED_PATH_OPACITY;

        const controlPoints = this.definition.createControlPoints(name);

        this.curve = new THREE.CatmullRomCurve3(
            controlPoints,
            this.closedPath,
            "centripetal"
        );
        const identityColour = this.definition.colourForName(name, theme);
        this.identityColour = identityColour;
        this.agedColour = new THREE.Color(theme.agedPath);
        this.wordColour = new THREE.Color(theme.pathOrigin).lerp(
            identityColour,
            WORD_ANCHOR_PROGRESS
        );
        this.geometry = new THREE.TubeGeometry(
            this.curve,
            PATH_SAMPLES,
            PATH_TUBE_RADIUS,
            PATH_RADIAL_SEGMENTS,
            this.closedPath
        );

        const colours = new Float32Array(
            (PATH_SAMPLES + 1) * (PATH_RADIAL_SEGMENTS + 1) * 3
        );
        const selectedColours = new Float32Array(colours.length);
        const selectedColour = identityColour.clone().offsetHSL(0, 0.2, -0.03);

        for (let ring = 0; ring <= PATH_SAMPLES; ring += 1) {
            const progress = ring / PATH_SAMPLES;
            const colour = this.isGerald
                ? (this.hovered || this.selected
                    ? identityColour.clone().offsetHSL(0, 0.16, -0.01)
                    : identityColour.clone().lerp(this.agedColour, this.entropy))
                : new THREE.Color(theme.pathOrigin).lerp(identityColour, progress);

            for (let side = 0; side <= PATH_RADIAL_SEGMENTS; side += 1) {
                const offset = (ring * (PATH_RADIAL_SEGMENTS + 1) + side) * 3;
                colours[offset] = colour.r;
                colours[offset + 1] = colour.g;
                colours[offset + 2] = colour.b;
                selectedColours[offset] = selectedColour.r;
                selectedColours[offset + 1] = selectedColour.g;
                selectedColours[offset + 2] = selectedColour.b;
            }
        }

        this.geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
        if (this.isMartin) {
            const trailOpacity = new Float32Array(
                (PATH_SAMPLES + 1) * (PATH_RADIAL_SEGMENTS + 1)
            );
            this.geometry.setAttribute(
                "trailOpacity",
                new THREE.Float32BufferAttribute(trailOpacity, 1)
            );
        }
        this.geometry.setDrawRange(0, 0);
        this.material = this.isMartin
            ? createMartinOrbitMaterial(UNSELECTED_PATH_OPACITY)
            : new THREE.MeshBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: UNSELECTED_PATH_OPACITY,
                depthWrite: false,
                side: THREE.DoubleSide
            });
        this.path = new THREE.Mesh(this.geometry, this.material);

        // The finishing segments render after the main path, while retaining
        // depth testing so they cannot show through foreground segments.
        this.endGeometry = this.geometry.clone();
        this.endGeometry.setDrawRange(0, 0);
        this.endMaterial = this.material.clone();
        this.endPath = new THREE.Mesh(this.endGeometry, this.endMaterial);
        this.endPath.renderOrder = 1;

        this.selectedGeometry = new THREE.TubeGeometry(
            this.curve,
            PATH_SAMPLES,
            SELECTED_PATH_TUBE_RADIUS,
            PATH_RADIAL_SEGMENTS,
            this.closedPath
        );
        this.selectedGeometry.setAttribute(
            "color",
            new THREE.BufferAttribute(selectedColours, 3)
        );
        this.selectedGeometry.setDrawRange(0, 0);
        this.geraldBasePositions = this.isGerald
            ? this.selectedGeometry.getAttribute("position").array.slice()
            : null;
        this.selectedMaterial = this.isGerald
            ? createGeraldInspectorMaterial()
            : new THREE.MeshBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.94,
                side: THREE.DoubleSide
            });
        this.selectedPath = new THREE.Mesh(this.selectedGeometry, this.selectedMaterial);
        this.selectedPath.renderOrder = 2;
        this.selectedPath.visible = false;

        [this.path, this.endPath, this.selectedPath].forEach(mesh => {
            mesh.userData.ronaldPath = this;
        });

        this.updateLaneOffset();

        if (this.isMartin) {
            this.path.visible = false;
            this.endPath.visible = false;
            this.selectedPath.visible = false;
            this.path.renderOrder = 1;
        }

        scene.add(this.path, this.endPath, this.selectedPath);
    }

    setTheme(theme) {
        this.theme = theme;
        this.identityColour.copy(this.definition.colourForName(this.name, theme));
        this.agedColour.set(theme.agedPath);
        this.updateColours();
    }

    increaseEntropy() {
        this.entropy = 1 - (1 - this.entropy) * (1 - ENTROPY_STEP);
        this.updateColours();
    }

    ageToMaximumEntropy() {
        this.entropy = 1;
        this.updateColours();
    }

    recoverVitality() {
        this.entropy = 0;
        this.updateColours();
    }

    setLocked(locked) {
        this.locked = locked;
        if (locked) {
            this.setSelected(false);
            this.setHovered(false);
        }
    }

    setUniverseVisible(active) {
        // Other layers remain as a faint, non-interactive trace instead of
        // disappearing completely. This makes the layer transition legible
        // without allowing cross-universe selection.
        this.inactiveUniverse = !active;
        // Keep MARTIN's last rendered trail visible as a faint layer while
        // its universe is inactive; getPickableObjects still prevents input.
        this.path.visible = true;
        this.endPath.visible = this.isMartin ? false : true;
        this.selectedPath.visible = active
            && !this.isMartin
            && (this.selected || this.hovered);
        this.updateBasePathOpacity();
        this.updateWordVisibility();
        if (!active && this.geraldInspecting) this.setInspection(false);
    }

    updateColours() {
        const colourAttributes = [
            this.geometry.getAttribute("color"),
            this.endGeometry.getAttribute("color")
        ];

        if (this.isMartin) {
            this.updateMartinTrailAttributes();
        } else {
            for (let ring = 0; ring <= PATH_SAMPLES; ring += 1) {
                const colour = this.isGerald
                    ? (this.hovered || this.selected
                        ? this.identityColour.clone().offsetHSL(0, 0.16, -0.01)
                        : this.identityColour.clone().lerp(this.agedColour, this.entropy))
                    : new THREE.Color(this.theme.pathOrigin).lerp(
                        this.identityColour,
                        ring / PATH_SAMPLES
                    ).lerp(this.agedColour, this.entropy);

                for (let side = 0; side <= PATH_RADIAL_SEGMENTS; side += 1) {
                    const offset = (ring * (PATH_RADIAL_SEGMENTS + 1) + side) * 3;
                    colourAttributes.forEach(attribute => {
                        attribute.array[offset] = colour.r;
                        attribute.array[offset + 1] = colour.g;
                        attribute.array[offset + 2] = colour.b;
                    });
                }
            }

            colourAttributes.forEach(attribute => {
                attribute.needsUpdate = true;
            });
        }

        const selectedColour = this.identityColour.clone().offsetHSL(0, 0.2, -0.03);
        const selectedAttribute = this.selectedGeometry.getAttribute("color");

        for (let index = 0; index < selectedAttribute.count; index += 1) {
            selectedAttribute.setXYZ(index, selectedColour.r, selectedColour.g, selectedColour.b);
        }

        selectedAttribute.needsUpdate = true;
        this.wordColour = new THREE.Color(this.theme.pathOrigin).lerp(
            this.identityColour,
            WORD_ANCHOR_PROGRESS
        ).lerp(this.agedColour, this.entropy);

        if (this.word) {
            this.word.colour.copy(this.wordColour);
            drawWord(this.word, this.word.visibleCharacters);
        }
    }

    enableWordLabel() {
        if (this.ready) {
            return;
        }

        this.word = createWordLabel(this.scene, this.name, this.curve, this.wordColour);
        this.ready = true;
        this.updateWordVisibility();
    }

    update(delta, camera, renderer) {
        if (!this.ready) {
            return;
        }

        if (this.isMartin) {
            this.updateMartinOrbit(delta, camera, renderer);
            return;
        }

        if (this.isGerald) {
            this.updateGeraldCrown(delta);
        }

        if (this.visibleSegments < PATH_SAMPLES) {
            this.visibleSegments = Math.min(
                PATH_SAMPLES,
                this.visibleSegments + delta * PATH_GROWTH_PER_SECOND
            );

            const visibleSegments = Math.floor(this.visibleSegments);
            const mainSegments = Math.min(visibleSegments, PATH_SAMPLES - END_OVERLAY_SEGMENTS);
            const endSegments = Math.max(0, visibleSegments - (PATH_SAMPLES - END_OVERLAY_SEGMENTS));
            const indicesPerSegment = PATH_RADIAL_SEGMENTS * 6;

            this.geometry.setDrawRange(0, Math.max(1, mainSegments) * indicesPerSegment);
            this.endGeometry.setDrawRange(
                (PATH_SAMPLES - END_OVERLAY_SEGMENTS) * indicesPerSegment,
                endSegments * indicesPerSegment
            );
            this.selectedGeometry.setDrawRange(
                0,
                Math.max(1, visibleSegments) * indicesPerSegment
            );
            this.updateWord(0, camera, renderer);
            return;
        }

        this.labelFadeProgress = Math.min(
            1,
            this.labelFadeProgress + delta / WORD_LABEL_FADE_SECONDS
        );
        this.word.label.material.opacity = WORD_LABEL_OPACITY * this.labelFadeProgress;

        if (this.selected || this.hovered) {
            this.updateWord(1, camera, renderer);
        }
    }

    setSelected(selected) {
        if (selected && !this.selected && this.isGerald) {
            this.triggerShiver(0.105);
            this.geraldAudioPhase = 0;
        }
        this.selected = selected;
        this.updateLaneOffset();
        this.updateBasePathOpacity();
        this.updateHighlightVisibility();
        if (this.isGerald) this.updateColours();
    }

    triggerShiver(amount = 0.105) {
        if (!this.isGerald) return;
        this.geraldShiver = Math.max(this.geraldShiver, amount);
        this.geraldShiverPhase = 0;
    }

    setInspection(inspecting) {
        if (!this.isGerald || this.geraldInspecting === inspecting) return;
        this.geraldInspecting = inspecting;
        if (inspecting) {
            this.path.visible = false;
            this.endPath.visible = false;
            this.selectedPath.quaternion.copy(this.path.quaternion);
            this.selectedPath.scale.copy(this.path.scale);
            this.selectedPath.visible = true;
            if (this.selectedMaterial.uniforms?.uFadeEnabled) {
                this.selectedMaterial.uniforms.uFadeEnabled.value = 1;
                this.selectedMaterial.uniforms.uFadeCentre.value.copy(
                    this.getFocusTarget()
                );
                this.selectedMaterial.uniforms.uFadeRadius.value = (
                    this.geraldCrown.radius + SELECTED_PATH_TUBE_RADIUS
                );
            }
            if (this.word) this.word.label.visible = false;
            return;
        }
        this.path.visible = true;
        this.endPath.visible = true;
        this.selectedPath.quaternion.copy(this.path.quaternion);
        this.selectedPath.scale.copy(this.path.scale);
        if (this.selectedMaterial.uniforms?.uFadeEnabled) {
            this.selectedMaterial.uniforms.uFadeEnabled.value = 0;
        }
        this.updateHighlightVisibility();
    }

    setHovered(hovered) {
        this.hovered = hovered;
        if (hovered && this.isGerald && !this.selected) {
            this.geraldShiver = Math.max(this.geraldShiver, 0.022);
            this.geraldShiverPhase = 0;
            this.geraldAudioPhase = 0;
        }
        if (!hovered && !this.selected && this.isGerald && !this.geraldInspecting) {
            this.selectedPath.quaternion.copy(this.path.quaternion);
            this.selectedPath.scale.copy(this.path.scale);
        }
        this.updateLaneOffset();
        this.updateBasePathOpacity();
        this.updateHighlightVisibility();
        if (this.isGerald) this.updateColours();
    }

    setLabelSuppressed(suppressed) {
        this.labelSuppressed = suppressed;
        this.updateWordVisibility();
    }

    getHistoryColour(highlighted = false) {
        const colour = highlighted
            ? this.identityColour
            : this.identityColour.clone().lerp(this.agedColour, this.entropy);

        return `#${colour.getHexString()}`;
    }

    getIdentityColour() {
        return `#${this.identityColour.getHexString()}`;
    }

    getPickableObjects() {
        if (this.locked || this.inactiveUniverse) {
            return [];
        }

        if (this.isGerald && this.geraldInspecting) return [this.selectedPath];
        return this.isMartin
            ? [this.path]
            : [this.path, this.endPath, this.selectedPath];
    }

    getFocusTarget() {
        this.geometry.computeBoundingSphere();
        return this.path.localToWorld(this.geometry.boundingSphere.center.clone());
    }

    getFocusRadius() {
        this.geometry.computeBoundingSphere();
        return Math.max(1, this.geometry.boundingSphere.radius);
    }

    getInspectionViewDirection() {
        return this.geraldCrown?.viewDirection.clone() ?? null;
    }

    getInspectionUpDirection() {
        return this.geraldCrown?.axis.clone() ?? null;
    }

    getInspectionDistance() {
        // Side-on inspection targets roughly 70% of the viewport width.
        return this.isGerald ? this.geraldCrown.radius * 2.05 : null;
    }

    updateGeraldCrown(delta) {
        if (this.inactiveUniverse || this.locked) return;
        const rotation = new THREE.Quaternion().setFromAxisAngle(
            this.geraldCrown.axis,
            GERALD_IDLE_ROTATION_SPEED * delta
        );
        [this.path, this.endPath, this.selectedPath].forEach(mesh => {
            mesh.quaternion.premultiply(rotation);
        });

        if (this.geraldInspecting || this.hovered || this.selected) {
            this.geraldAudioPhase = THREE.MathUtils.euclideanModulo(
                this.geraldAudioPhase + delta * this.geraldCrown.frequency,
                1
            );
        }
        this.geraldShiver *= Math.exp(-delta * 10.5);
        this.geraldShiverPhase += delta * 48;
        this.updateGeraldShiverGeometry();
    }

    updateGeraldShiverGeometry() {
        if (!this.geraldBasePositions) return;
        const positions = this.selectedGeometry.getAttribute("position");
        const amplitude = this.geraldShiver;
        const phase = this.geraldShiverPhase;
        const live = this.geraldInspecting || this.hovered || this.selected;
        const audioAmplitude = GERALD_LIVE_VISUAL_AMPLITUDE;

        for (let vertex = 0; vertex < positions.count; vertex += 1) {
            const offset = vertex * 3;
            let waveOffset = 0;
            if (live) {
                const ring = Math.floor(vertex / (PATH_RADIAL_SEGMENTS + 1));
                const progress = Math.min(1, ring / PATH_SAMPLES);
                const recipeWave = geraldWaveValue(
                    this.geraldCrown.waveform,
                    progress * this.geraldCrown.cycles
                );
                const actualWave = liveGeraldWaveValue(
                    this.geraldCrown,
                    progress,
                    this.geraldAudioPhase
                );
                // Move the frozen recipe to the actual audio wave, rather
                // than layering a second waveform on top of it.
                waveOffset = (actualWave - recipeWave) * audioAmplitude;
            }
            if (amplitude < 0.00001) {
                positions.array[offset] = this.geraldBasePositions[offset]
                    + this.geraldCrown.axis.x * waveOffset;
                positions.array[offset + 1] = this.geraldBasePositions[offset + 1]
                    + this.geraldCrown.axis.y * waveOffset;
                positions.array[offset + 2] = this.geraldBasePositions[offset + 2]
                    + this.geraldCrown.axis.z * waveOffset;
                continue;
            }

            const noiseA = Math.sin(vertex * 0.73 + phase) * 0.62
                + Math.sin(vertex * 1.91 - phase * 0.71) * 0.38;
            const noiseB = Math.sin(vertex * 1.17 - phase * 1.13) * 0.58
                + Math.sin(vertex * 2.47 + phase * 0.61) * 0.42;
            const noiseC = Math.sin(vertex * 2.03 + phase * 0.83) * 0.5
                + Math.sin(vertex * 0.41 - phase * 1.47) * 0.5;
            // Keep the same decay and irregular motion, but make the
            // Vib-Ribbon-style deformation three times more legible.
            const jitter = amplitude * 5.4;
            const baseX = this.geraldBasePositions[offset];
            const baseY = this.geraldBasePositions[offset + 1];
            const baseZ = this.geraldBasePositions[offset + 2];
            positions.array[offset] = baseX
                + this.geraldCrown.axis.x * waveOffset
                + (this.geraldCrown.axis.x * noiseA
                    + this.geraldCrown.viewDirection.x * noiseB
                    + this.geraldShiverSide.x * noiseC) * jitter;
            positions.array[offset + 1] = baseY
                + this.geraldCrown.axis.y * waveOffset
                + (this.geraldCrown.axis.y * noiseA
                    + this.geraldCrown.viewDirection.y * noiseB
                    + this.geraldShiverSide.y * noiseC) * jitter;
            positions.array[offset + 2] = baseZ
                + this.geraldCrown.axis.z * waveOffset
                + (this.geraldCrown.axis.z * noiseA
                    + this.geraldCrown.viewDirection.z * noiseB
                    + this.geraldShiverSide.z * noiseC) * jitter;
        }
        positions.needsUpdate = true;
    }

    updateWordVisibility() {
        if (this.word) {
            this.word.label.visible = !this.inactiveUniverse
                && this.word.visibleCharacters > 0
                && (this.selected || (this.hovered && !this.labelSuppressed));
        }
    }

    updateHighlightVisibility() {
        if (this.isGerald) {
            const attentive = this.selected || this.hovered || this.geraldInspecting;
            this.path.visible = !attentive;
            this.endPath.visible = !attentive;
            this.selectedPath.visible = attentive;
            this.updateWordVisibility();
            if (this.geraldInspecting && this.word) this.word.label.visible = false;
            return;
        }
        this.selectedPath.visible = !this.inactiveUniverse
            && !this.isMartin
            && (this.selected || this.hovered);
        this.updateWordVisibility();
    }

    updateLaneOffset() {
        const offset = this.selected ? new THREE.Vector3() : this.laneOffset;
        const highlightOffset = this.selected
            ? new THREE.Vector3()
            : this.hovered ? this.laneOffset : new THREE.Vector3();

        this.path.position.copy(offset);
        this.endPath.position.copy(offset);
        this.selectedPath.position.copy(highlightOffset);
    }

    updateBasePathOpacity() {
        const opacity = this.inactiveUniverse
            ? INACTIVE_UNIVERSE_PATH_OPACITY
            : this.selected || this.hovered
            ? ACTIVE_PATH_OPACITY
            : UNSELECTED_PATH_OPACITY;

        this.martinBaseOpacity = opacity;
        if (this.isMartin) {
            this.material.uniforms.uGlobalOpacity.value = opacity;
        } else {
            this.material.opacity = opacity;
            this.endMaterial.opacity = opacity;
        }
    }

    updateMartinTrailAttributes() {
        if (!this.isMartin || !this.martinSegmentAges) {
            return;
        }

        const trailColour = this.identityColour.clone().lerp(this.agedColour, this.entropy);
        const white = new THREE.Color(0xffffff);
        const segmentColour = new THREE.Color();
        const attributeSets = [
            {
                colour: this.geometry.getAttribute("color"),
                opacity: this.geometry.getAttribute("trailOpacity")
            },
            {
                colour: this.endGeometry.getAttribute("color"),
                opacity: this.endGeometry.getAttribute("trailOpacity")
            }
        ];

        for (let ring = 0; ring <= PATH_SAMPLES; ring += 1) {
            const sourceRing = ring === PATH_SAMPLES ? 0 : ring;
            const age = this.martinSegmentAges[sourceRing];
            const ageProgress = age < 0
                ? 1
                : THREE.MathUtils.clamp(age / MARTIN_TRAIL_LIFETIME_SECONDS, 0, 1);
            const colourProgress = THREE.MathUtils.smoothstep(
                ageProgress,
                MARTIN_HEAD_LENGTH,
                MARTIN_COLOUR_LENGTH
            );
            const fadeProgress = THREE.MathUtils.smoothstep(
                ageProgress,
                MARTIN_COLOUR_LENGTH,
                1
            );
            const opacity = age < 0 ? 0 : 1 - fadeProgress;

            segmentColour.copy(white).lerp(trailColour, colourProgress);
            for (let side = 0; side <= PATH_RADIAL_SEGMENTS; side += 1) {
                const vertex = ring * (PATH_RADIAL_SEGMENTS + 1) + side;
                attributeSets.forEach(attributes => {
                    attributes.colour.setXYZ(
                        vertex,
                        segmentColour.r,
                        segmentColour.g,
                        segmentColour.b
                    );
                    attributes.opacity.setX(vertex, opacity);
                });
            }
        }

        attributeSets.forEach(attributes => {
            attributes.colour.needsUpdate = true;
            attributes.opacity.needsUpdate = true;
        });
    }

    updateMartinOrbit(delta, camera, renderer) {
        if (this.inactiveUniverse || this.locked) {
            return;
        }

        const orbitStep = delta / MARTIN_ORBIT_SECONDS;
        const previousProgress = this.martinOrbitProgress;
        this.martinOrbitProgress = THREE.MathUtils.euclideanModulo(
            previousProgress + orbitStep,
            1
        );

        for (let ring = 0; ring < PATH_SAMPLES; ring += 1) {
            const age = this.martinSegmentAges[ring];
            if (age >= 0) {
                this.martinSegmentAges[ring] = Math.min(
                    MARTIN_TRAIL_LIFETIME_SECONDS,
                    age + delta
                );
            }

            const ringProgress = ring / PATH_SAMPLES;
            const distanceTravelled = THREE.MathUtils.euclideanModulo(
                ringProgress - previousProgress,
                1
            );
            if (distanceTravelled <= orbitStep + 0.000001) {
                this.martinSegmentAges[ring] = 0;
            }
        }

        // Keep a small, crisp white head even between adjacent orbit rings.
        const headRing = Math.round(this.martinOrbitProgress * PATH_SAMPLES) % PATH_SAMPLES;
        this.martinSegmentAges[headRing] = 0;
        this.geometry.setDrawRange(0, PATH_SAMPLES * PATH_RADIAL_SEGMENTS * 6);
        this.updateMartinTrailAttributes();
        this.path.visible = true;

        // MARTIN's orbital motion is independent of its discovery animation.
        // Use the same reveal clock as RONALD/RODNEY so its label is not held
        // back until the first seven-second orbit completes.
        this.martinRevealProgress = Math.min(
            1,
            this.martinRevealProgress
                + delta * PATH_GROWTH_PER_SECOND / PATH_SAMPLES
        );
        if (this.martinRevealProgress < 1) {
            this.updateWord(this.martinRevealProgress, camera, renderer);
            return;
        }

        this.labelFadeProgress = Math.min(
            1,
            this.labelFadeProgress + delta / WORD_LABEL_FADE_SECONDS
        );
        this.word.label.material.opacity = WORD_LABEL_OPACITY * this.labelFadeProgress;

        if (this.selected || this.hovered) {
            this.updateWord(1, camera, renderer);
        }
    }

    updateWord(pathProgress, camera, renderer) {
        let visibleCharacters = 0;

        for (const progress of WORD_CHARACTER_PROGRESS) {
            if (pathProgress >= progress) {
                visibleCharacters += 1;
            }
        }

        if (visibleCharacters !== this.word.visibleCharacters) {
            drawWord(this.word, visibleCharacters);
        }

        this.updateWordVisibility();

        const selectedFrame = this.selected ? this.selectedWordFrame(camera) : null;
        const anchor = selectedFrame?.anchor ?? this.word.anchor;
        const xAxis = selectedFrame?.tangent ?? this.word.tangent.clone();
        let yAxis;
        let zAxis;

        if (selectedFrame) {
            zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
            xAxis.addScaledVector(zAxis, -xAxis.dot(zAxis));
            if (xAxis.lengthSq() < 0.000001) {
                xAxis.set(1, 0, 0).applyQuaternion(camera.quaternion);
            } else {
                xAxis.normalize();
            }
            yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
        } else {
            yAxis = this.word.up.clone();
            zAxis = this.word.normal.clone();
            const reversed = zAxis.dot(camera.position.clone().sub(anchor)) < 0;

            if (reversed) {
                xAxis.negate();
                zAxis.negate();
            }
        }

        const labelOffsetAxis = selectedFrame ? yAxis.clone() : this.word.up;

        const cameraSpaceTangent = xAxis.clone()
            .applyQuaternion(camera.quaternion.clone().invert());

        if (Math.hypot(cameraSpaceTangent.x, cameraSpaceTangent.y) > 0.001) {
            const angle = Math.atan2(cameraSpaceTangent.y, cameraSpaceTangent.x);

            if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                xAxis.negate();
                yAxis.negate();
            }
        }

        const orientation = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
        const cameraDistance = camera.position.distanceTo(anchor);
        const worldHeight = 2 * cameraDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const worldUnitsPerPixel = worldHeight / renderer.domElement.clientHeight;
        const labelScale = worldUnitsPerPixel * WORD_SCREEN_WIDTH;
        const labelOffset = PATH_TUBE_RADIUS + worldUnitsPerPixel * WORD_SCREEN_OFFSET;
        this.word.label.position.copy(anchor)
            .addScaledVector(labelOffsetAxis, labelOffset);
        this.word.label.quaternion.setFromRotationMatrix(orientation);
        this.word.label.scale.setScalar(labelScale);

        if (this.selected) {
            this.keepSelectedLabelOnscreen(camera, renderer, xAxis, yAxis, labelScale);
        }
    }

    selectedWordFrame(camera) {
        const canonicalProjection = this.word.anchor.clone().project(camera);

        if (canonicalProjection.z >= -1 && canonicalProjection.z <= 1) {
            return {
                anchor: this.word.anchor.clone(),
                tangent: this.word.tangent.clone()
            };
        }

        let bestFrame = null;
        for (let index = 0; index <= 32; index += 1) {
            const progress = index / 32;
            const anchor = this.curve.getPoint(progress);
            const projected = anchor.clone().project(camera);

            if (projected.z < -1 || projected.z > 1) {
                continue;
            }

            const overflow = Math.max(0, Math.abs(projected.x) - 0.88)
                + Math.max(0, Math.abs(projected.y) - 0.84);
            const score = overflow * 12
                + Math.abs(progress - WORD_ANCHOR_PROGRESS)
                + Math.hypot(projected.x, projected.y) * 0.04;

            if (!bestFrame || score < bestFrame.score) {
                bestFrame = {
                    anchor,
                    tangent: this.curve.getTangent(progress).normalize(),
                    score
                };
            }
        }

        return bestFrame ?? {
            anchor: this.word.anchor.clone(),
            tangent: new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
        };
    }

    keepSelectedLabelOnscreen(camera, renderer, xAxis, yAxis, labelScale) {
        const viewportWidth = renderer.domElement.clientWidth;
        const viewportHeight = renderer.domElement.clientHeight;

        if (viewportWidth === 0 || viewportHeight === 0) {
            return;
        }

        const halfWidth = labelScale / 2;
        const halfHeight = labelScale * 0.125;
        const corners = [
            [-halfWidth, -halfHeight],
            [halfWidth, -halfHeight],
            [halfWidth, halfHeight],
            [-halfWidth, halfHeight]
        ].map(([across, up]) => (
            this.word.label.position.clone()
                .addScaledVector(xAxis, across)
                .addScaledVector(yAxis, up)
                .project(camera)
        )).map(point => ({
            x: (point.x + 1) * viewportWidth / 2,
            y: (1 - point.y) * viewportHeight / 2
        }));
        const minimumX = Math.min(...corners.map(point => point.x));
        const maximumX = Math.max(...corners.map(point => point.x));
        const minimumY = Math.min(...corners.map(point => point.y));
        const maximumY = Math.max(...corners.map(point => point.y));
        const margin = 12;
        let shiftX = 0;
        let shiftY = 0;

        if (minimumX < margin) {
            shiftX = margin - minimumX;
        } else if (maximumX > viewportWidth - margin) {
            shiftX = viewportWidth - margin - maximumX;
        }

        if (minimumY < margin) {
            shiftY = margin - minimumY;
        } else if (maximumY > viewportHeight - margin) {
            shiftY = viewportHeight - margin - maximumY;
        }

        if (shiftX === 0 && shiftY === 0) {
            return;
        }

        const projectedCentre = this.word.label.position.clone().project(camera);
        projectedCentre.x += shiftX * 2 / viewportWidth;
        projectedCentre.y -= shiftY * 2 / viewportHeight;
        this.word.label.position.copy(projectedCentre.unproject(camera));
    }


    dispose() {
        this.scene.remove(this.path, this.endPath, this.selectedPath);
        this.geometry.dispose();
        this.endGeometry.dispose();
        this.material.dispose();
        this.endMaterial.dispose();
        this.selectedGeometry.dispose();
        this.selectedMaterial.dispose();

        if (this.word) {
            this.scene.remove(this.word.label);
            this.word.label.geometry.dispose();
            this.word.label.material.map.dispose();
            this.word.label.material.dispose();
        }

    }
}
