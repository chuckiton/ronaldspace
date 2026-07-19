import * as THREE from "three";

import {
    COORDINATE_SCALE,
    END_OVERLAY_SEGMENTS,
    ENTROPY_STEP,
    PATH_GROWTH_PER_SECOND,
    PATH_RADIAL_SEGMENTS,
    PATH_SAMPLES,
    PATH_TUBE_RADIUS,
    SELECTED_PATH_TUBE_RADIUS,
    VECTORS,
    WORD_ANCHOR_PROGRESS,
    WORD_CHARACTER_PROGRESS,
    WORD_SCREEN_OFFSET,
    WORD_SCREEN_WIDTH
} from "./constants.js";

const WORD_LABEL_OPACITY = 0.94;
const WORD_LABEL_FADE_SECONDS = 0.3;
const UNSELECTED_PATH_OPACITY = 0.56;
const ACTIVE_PATH_OPACITY = 0.74;
const LANE_OFFSET_DISTANCE = 0.075;

function colourForName(name, theme) {
    let hash = 0;

    for (const letter of name) {
        hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
    }

    return new THREE.Color().setHSL(
        (hash % 360) / 360,
        0.66,
        theme.identityLightness
    );
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
    constructor(scene, name, theme) {
        this.scene = scene;
        this.name = name;
        this.theme = theme;
        this.visibleSegments = 0;
        this.ready = false;
        this.selected = false;
        this.hovered = false;
        this.labelSuppressed = false;
        this.word = null;
        this.entropy = 0;
        this.labelFadeProgress = 0;
        this.laneOffset = laneOffsetForName(name);

        const letters = [name[0], name[2], name[4], name[5]];
        const controlPoints = [new THREE.Vector3()];
        let current = new THREE.Vector3();

        letters.forEach(letter => {
            current = current.clone().add(
                VECTORS[letter].clone().multiplyScalar(COORDINATE_SCALE)
            );
            controlPoints.push(current.clone());
        });

        this.curve = new THREE.CatmullRomCurve3(controlPoints, false, "centripetal");
        const identityColour = colourForName(name, theme);
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
            false
        );

        const colours = new Float32Array(
            (PATH_SAMPLES + 1) * (PATH_RADIAL_SEGMENTS + 1) * 3
        );
        const selectedColours = new Float32Array(colours.length);
        const selectedColour = identityColour.clone().offsetHSL(0, 0.2, -0.03);

        for (let ring = 0; ring <= PATH_SAMPLES; ring += 1) {
            const progress = ring / PATH_SAMPLES;
            const colour = new THREE.Color(theme.pathOrigin).lerp(identityColour, progress);

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
        this.geometry.setDrawRange(0, 0);
        this.material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: UNSELECTED_PATH_OPACITY,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.path = new THREE.Mesh(this.geometry, this.material);

        // The returning end renders after the main path at the origin, but
        // retains depth testing so it cannot show through foreground segments.
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
            false
        );
        this.selectedGeometry.setAttribute(
            "color",
            new THREE.BufferAttribute(selectedColours, 3)
        );
        this.selectedGeometry.setDrawRange(0, 0);
        this.selectedMaterial = new THREE.MeshBasicMaterial({
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

        scene.add(this.path, this.endPath, this.selectedPath);
    }

    setTheme(theme) {
        this.theme = theme;
        this.identityColour.copy(colourForName(this.name, theme));
        this.agedColour.set(theme.agedPath);
        this.updateColours();
    }

    increaseEntropy() {
        this.entropy = 1 - (1 - this.entropy) * (1 - ENTROPY_STEP);
        this.updateColours();
    }

    updateColours() {
        const colourAttributes = [
            this.geometry.getAttribute("color"),
            this.endGeometry.getAttribute("color")
        ];

        for (let ring = 0; ring <= PATH_SAMPLES; ring += 1) {
            const colour = new THREE.Color(this.theme.pathOrigin).lerp(
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
        this.selected = selected;
        this.updateLaneOffset();
        this.updateBasePathOpacity();
        this.updateHighlightVisibility();
    }

    setHovered(hovered) {
        this.hovered = hovered;
        this.updateLaneOffset();
        this.updateBasePathOpacity();
        this.updateHighlightVisibility();
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
        return [this.path, this.endPath, this.selectedPath];
    }

    updateWordVisibility() {
        if (this.word) {
            this.word.label.visible = !this.labelSuppressed && this.word.visibleCharacters > 0 && (
                this.selected || this.hovered
            );
        }
    }

    updateHighlightVisibility() {
        this.selectedPath.visible = this.selected || this.hovered;
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
        const opacity = this.selected || this.hovered
            ? ACTIVE_PATH_OPACITY
            : UNSELECTED_PATH_OPACITY;

        this.material.opacity = opacity;
        this.endMaterial.opacity = opacity;
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

        const cameraDistance = camera.position.distanceTo(this.word.anchor);
        const worldHeight = 2 * cameraDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const worldUnitsPerPixel = worldHeight / renderer.domElement.clientHeight;
        const labelScale = worldUnitsPerPixel * WORD_SCREEN_WIDTH;
        const labelOffset = PATH_TUBE_RADIUS + worldUnitsPerPixel * WORD_SCREEN_OFFSET;
        const reversed = this.word.normal.dot(
            camera.position.clone().sub(this.word.anchor)
        ) < 0;

        const xAxis = this.word.tangent.clone();
        const yAxis = this.word.up.clone();
        const zAxis = this.word.normal.clone();

        if (reversed) {
            xAxis.negate();
            zAxis.negate();
        }

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
        this.word.label.position.copy(this.word.anchor)
            .addScaledVector(this.word.up, labelOffset);
        this.word.label.quaternion.setFromRotationMatrix(orientation);
        this.word.label.scale.setScalar(labelScale);
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
