import * as THREE from "three";

import {
    END_OVERLAY_SEGMENTS,
    ENTROPY_STEP,
    PATH_GROWTH_PER_SECOND,
    PATH_RADIAL_SEGMENTS,
    PATH_SAMPLES,
    PATH_TUBE_RADIUS,
    SELECTED_PATH_TUBE_RADIUS,
    WORD_ANCHOR_PROGRESS,
    WORD_CHARACTER_PROGRESS,
    WORD_SCREEN_OFFSET,
    WORD_SCREEN_WIDTH
} from "./constants.js?v=20260720-gordon-stage";
import { getUniverse } from "./universes.js?v=20260720-gordon-stage";

const WORD_LABEL_OPACITY = 0.94;
const WORD_LABEL_FADE_SECONDS = 0.3;
const UNSELECTED_PATH_OPACITY = 0.56;
const ACTIVE_PATH_OPACITY = 0.74;
const INACTIVE_UNIVERSE_PATH_OPACITY = 0.075;
const LANE_OFFSET_DISTANCE = 0.075;
const MARTIN_ORBIT_SECONDS = 7;
const MARTIN_POINT_RADIUS = 0.16;

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
        this.martinOrbitProgress = 0;
        this.martinOrbitTurns = 0;
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
        this.selectedMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.94,
            side: THREE.DoubleSide
        });
        this.selectedPath = new THREE.Mesh(this.selectedGeometry, this.selectedMaterial);
        this.selectedPath.renderOrder = 2;
        this.selectedPath.visible = false;

        this.martinPoint = null;
        if (this.isMartin) {
            this.martinPoint = new THREE.Mesh(
                new THREE.SphereGeometry(MARTIN_POINT_RADIUS, 12, 8),
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 1,
                    depthWrite: false
                })
            );
            this.martinPoint.renderOrder = 2;
            this.martinPoint.userData.ronaldPath = this;
            this.martinPoint.position.copy(this.curve.getPointAt(0));
        }

        [this.path, this.endPath, this.selectedPath].forEach(mesh => {
            mesh.userData.ronaldPath = this;
        });

        this.updateLaneOffset();

        if (this.isMartin) {
            this.path.visible = false;
            this.endPath.visible = false;
            this.selectedPath.visible = false;
        }

        scene.add(this.path, this.endPath, this.selectedPath);
        if (this.martinPoint) {
            scene.add(this.martinPoint);
        }
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
        if (this.martinPoint) {
            this.martinPoint.visible = !locked && !this.inactiveUniverse;
        }
    }

    setUniverseVisible(active) {
        // Other layers remain as a faint, non-interactive trace instead of
        // disappearing completely. This makes the layer transition legible
        // without allowing cross-universe selection.
        this.inactiveUniverse = !active;
        this.path.visible = active && !this.isMartin;
        this.endPath.visible = active && !this.isMartin;
        this.selectedPath.visible = active
            && !this.isMartin
            && (this.selected || this.hovered);
        if (this.martinPoint) {
            this.martinPoint.visible = active && !this.locked;
        }
        this.updateBasePathOpacity();
        this.updateWordVisibility();
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

        if (this.isMartin) {
            this.updateMartinOrbit(delta, camera, renderer);
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
        if (this.locked || this.inactiveUniverse) {
            return [];
        }

        return this.isMartin
            ? [this.martinPoint]
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

    updateWordVisibility() {
        if (this.word) {
            this.word.label.visible = !this.inactiveUniverse
                && this.word.visibleCharacters > 0
                && (this.selected || (this.hovered && !this.labelSuppressed));
        }
    }

    updateHighlightVisibility() {
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

        if (this.martinPoint) {
            this.martinPoint.userData.laneOffset = offset;
        }
    }

    updateBasePathOpacity() {
        const opacity = this.inactiveUniverse
            ? INACTIVE_UNIVERSE_PATH_OPACITY
            : this.selected || this.hovered
            ? ACTIVE_PATH_OPACITY
            : UNSELECTED_PATH_OPACITY;

        this.martinBaseOpacity = opacity;
        this.material.opacity = opacity;
        this.endMaterial.opacity = opacity;
    }

    updateMartinOrbit(delta, camera, renderer) {
        this.martinOrbitProgress += delta / MARTIN_ORBIT_SECONDS;
        while (this.martinOrbitProgress >= 1) {
            this.martinOrbitProgress -= 1;
            this.martinOrbitTurns += 1;
        }

        const progress = this.martinOrbitProgress;
        const point = this.curve.getPointAt(progress);
        const offset = this.martinPoint.userData.laneOffset ?? this.laneOffset;
        this.martinPoint.position.copy(point).add(offset);

        const colourProgress = THREE.MathUtils.smoothstep(progress, 0, 0.55);
        const fadeProgress = THREE.MathUtils.smoothstep(progress, 0.55, 1);
        const pointColour = new THREE.Color(0xffffff)
            .lerp(this.identityColour, colourProgress)
            .lerp(this.agedColour, this.entropy);
        this.martinPoint.material.color.copy(pointColour);
        this.martinPoint.material.opacity = this.martinBaseOpacity * (1 - fadeProgress);
        this.martinPoint.scale.setScalar(this.selected ? 1.3 : this.hovered ? 1.12 : 1);

        if (this.martinOrbitTurns === 0) {
            this.updateWord(progress, camera, renderer);
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

        if (this.martinPoint) {
            this.scene.remove(this.martinPoint);
            this.martinPoint.geometry.dispose();
            this.martinPoint.material.dispose();
        }

        if (this.word) {
            this.scene.remove(this.word.label);
            this.word.label.geometry.dispose();
            this.word.label.material.map.dispose();
            this.word.label.material.dispose();
        }

    }
}
