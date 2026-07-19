import * as THREE from "three";

import { AXIS_LABEL_RADIUS, COORDINATE_SCALE, VECTORS } from "./constants.js";

function drawAxisLabel(label, colour) {
    label.context.clearRect(0, 0, 256, 128);
    label.context.fillStyle = colour;
    label.context.font = "70px ProFont, monospace";
    label.context.fillText(label.text, 20, 80);
    label.texture.needsUpdate = true;
}

function createAxisLabel(scene, text, position, colour) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            opacity: 0.9
        })
    );

    label.position.copy(position);
    label.scale.set(0.9, 0.45, 1);
    label.renderOrder = 3;
    scene.add(label);

    const axisLabel = { text, context: canvas.getContext("2d"), texture };
    drawAxisLabel(axisLabel, colour);
    return axisLabel;
}

function createPossibilityNodes(scene, theme) {
    const points = [];
    const seen = new Set();

    function add(point) {
        const key = `${point.x},${point.y},${point.z}`;

        if (!seen.has(key)) {
            seen.add(key);
            points.push(point.clone().multiplyScalar(COORDINATE_SCALE));
        }
    }

    function branch(point, depth) {
        add(point);

        if (depth === 4) {
            return;
        }

        Object.values(VECTORS).forEach(vector => {
            branch(point.clone().add(vector), depth + 1);
        });
    }

    branch(new THREE.Vector3(), 0);

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.PointsMaterial({
        color: theme.node,
        size: 0.09,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.22
    });

    scene.add(new THREE.Points(geometry, material));
    return material;
}

function createAxisLines(scene, theme) {
    const points = [];

    Object.values(VECTORS).forEach(vector => {
        points.push(new THREE.Vector3(), vector.clone().multiplyScalar(AXIS_LABEL_RADIUS));
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
        color: theme.axisLine,
        transparent: true,
        opacity: 0.24
    });

    scene.add(new THREE.LineSegments(geometry, material));
    return material;
}

export function initialiseRonaldSpace(scene, initialTheme) {
    const state = {
        theme: initialTheme,
        labels: [],
        nodeMaterial: createPossibilityNodes(scene, initialTheme),
        axisMaterial: createAxisLines(scene, initialTheme)
    };

    const fontReady = document.fonts.load("70px ProFont")
        .then(addAxisLabels)
        .catch(addAxisLabels);

    function addAxisLabels() {
        Object.entries(VECTORS).forEach(([letter, vector]) => {
            state.labels.push(
                createAxisLabel(
                    scene,
                    letter,
                    vector.clone().multiplyScalar(AXIS_LABEL_RADIUS),
                    state.theme.axisLabel
                )
            );
        });
    }

    return {
        fontReady,
        setTheme(theme) {
            state.theme = theme;
            state.nodeMaterial.color.set(theme.node);
            state.axisMaterial.color.set(theme.axisLine);
            state.labels.forEach(label => drawAxisLabel(label, theme.axisLabel));
        }
    };
}
