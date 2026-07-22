import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

import {
    COORDINATE_SCALE,
    WORD_SCREEN_OFFSET,
    WORD_SCREEN_WIDTH
} from "./constants.js?v=20260720-gordon-facet-picking";
import { getUniverse } from "./universes.js?v=20260720-gordon-facet-picking";

const GROWTH_PER_SECOND = 1.45;
const INACTIVE_OPACITY = 0.07;
const GORDON_ENTROPY_STEP = 0.025;
const WORD_LABEL_OPACITY = 0.94;
const WORD_LABEL_FADE_SECONDS = 0.3;
const LABEL_EDGE_OCCLUSION_TOLERANCE = 9;
const LABEL_EDGE_MIN_PROJECTED_LENGTH = 8;

const TETRAHEDRON_FACES = [
    [0, 1, 2],
    [0, 3, 1],
    [0, 2, 3],
    [1, 3, 2]
];
// G, R, D and N are a shared four-step amount scale. Each position in the
// name applies that amount to one clean, legible crystal operation.
const SIZE_FACTORS = [1.75, 1.95, 2.15, 2.35];
const AXIAL_ASPECT_RATIOS = [1, 1.35, 1.85, 2.5];
const COUNTER_TETRA_RATIOS = [0, 0.33, 0.67, 1];
const ROTATIONAL_STEPS = [null, (Math.PI * 2) / 3, Math.PI / 2, Math.PI / 3];
const PICK_PROXY_RADIUS = 4.5;
const POINT_MATCH_EPSILON = 0.00001;
const TETRAHEDRAL_CAP_HEIGHT = Math.sqrt(2 / 3);

function parametersFor(name) {
    return [name[0], name[2], name[3], name[5]]
        .map(letter => "GRDN".indexOf(letter));
}

function appendTriangle(positions, first, second, third) {
    [first, second, third].forEach(point => positions.push(point.x, point.y, point.z));
}

function uniquePoints(points) {
    return points.reduce((unique, point) => {
        if (!unique.some(candidate => (
            candidate.distanceToSquared(point) < POINT_MATCH_EPSILON
        ))) {
            unique.push(point.clone());
        }
        return unique;
    }, []);
}

function outwardTriangle(first, second, third) {
    const normal = new THREE.Vector3().crossVectors(
        second.clone().sub(first),
        third.clone().sub(first)
    );
    const centre = first.clone().add(second).add(third).multiplyScalar(1 / 3);

    return normal.dot(centre) >= 0
        ? [first, second, third]
        : [first, third, second];
}

function stretchAlongAxis(point, axis, aspectRatio) {
    // Volume remains broadly stable while the silhouette becomes distinctly
    // longitudinal: the local G axis lengthens as the threefold girdle narrows.
    const axialScale = Math.sqrt(aspectRatio);
    const transverseScale = 1 / axialScale;
    const axialDistance = point.dot(axis);
    const axial = axis.clone().multiplyScalar(axialDistance * axialScale);
    const transverse = point.clone()
        .addScaledVector(axis, -axialDistance)
        .multiplyScalar(transverseScale);

    return axial.add(transverse);
}

function rootTetrahedron(directions, bodySize, aspectRatio) {
    const axis = directions[0].clone().normalize();

    return directions.map(direction => stretchAlongAxis(
        direction.clone().multiplyScalar(bodySize),
        axis,
        aspectRatio
    ));
}

function crystalSurface(rootVertices, counterRatio) {
    const triangles = [];

    TETRAHEDRON_FACES.forEach(face => {
        const [first, second, third] = face.map(index => rootVertices[index]);
        const faceCentre = first.clone().add(second).add(third).multiplyScalar(1 / 3);
        const faceNormal = new THREE.Vector3().crossVectors(
            second.clone().sub(first),
            third.clone().sub(first)
        ).normalize();

        if (faceNormal.dot(faceCentre) < 0) {
            faceNormal.negate();
        }

        // The opposing tetrahedron is one controlled counter-form, rather
        // than a separate extrusion on every face. At B/A = 1 these apexes
        // form a regular tetrahedral cap over each face: a clean tetra star
        // with only twelve large facets and no recursive detail.
        const averageEdgeLength = (
            first.distanceTo(second)
            + second.distanceTo(third)
            + third.distanceTo(first)
        ) / 3;
        const apex = faceCentre.addScaledVector(
            faceNormal,
            averageEdgeLength * TETRAHEDRAL_CAP_HEIGHT * counterRatio
        );

        triangles.push(
            outwardTriangle(first, second, apex),
            outwardTriangle(second, third, apex),
            outwardTriangle(third, first, apex)
        );
    });

    return triangles;
}

function triangularBipyramidSurface(rootVertices) {
    // Local G is aimed inward by the object orientation. The face opposite G
    // therefore faces outward. Reflecting the G apex through that face creates
    // a congruent second tetrahedron with one shared triangular base.
    const inwardApex = rootVertices[0];
    const outwardFaceIndices = [1, 3, 2];
    const outwardFace = outwardFaceIndices.map(index => rootVertices[index]);
    const [first, second, third] = outwardFace;
    const faceNormal = new THREE.Vector3().crossVectors(
        second.clone().sub(first),
        third.clone().sub(first)
    ).normalize();
    const distanceToFace = faceNormal.dot(inwardApex.clone().sub(first));
    const outwardApex = inwardApex.clone().addScaledVector(
        faceNormal,
        -2 * distanceToFace
    );

    // The shared face is internal and is deliberately omitted, leaving one
    // closed six-face triangular bipyramid.
    return [
        outwardTriangle(inwardApex, rootVertices[1], rootVertices[2]),
        outwardTriangle(inwardApex, rootVertices[3], rootVertices[1]),
        outwardTriangle(inwardApex, rootVertices[2], rootVertices[3]),
        outwardTriangle(outwardApex, first, second),
        outwardTriangle(outwardApex, second, third),
        outwardTriangle(outwardApex, third, first)
    ];
}

function axisBasis(axis) {
    const reference = Math.abs(axis.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(reference, axis).normalize();
    const bitangent = new THREE.Vector3().crossVectors(axis, tangent).normalize();

    return { tangent, bitangent };
}

function rotationalGeometry(triangles, axis, rotationalStep) {
    const iterations = Math.round((Math.PI * 2) / rotationalStep);
    // Each iteration carries a narrow pair of planes. Their alternating gaps
    // remain visible in the convex exterior, so the result reads as repeated
    // cuts rather than a mechanically regular cylinder.
    const halfWidth = rotationalStep * 0.18;
    const { tangent, bitangent } = axisBasis(axis);
    const sourcePoints = uniquePoints(triangles.flat());
    const rotatedPoints = [];

    sourcePoints.forEach(point => {
        const axialDistance = point.dot(axis);
        const radial = point.clone().addScaledVector(axis, -axialDistance);
        const radius = radial.length();

        if (radius < POINT_MATCH_EPSILON) {
            rotatedPoints.push(axis.clone().multiplyScalar(axialDistance));
            return;
        }

        for (let iteration = 0; iteration < iterations; iteration += 1) {
            const centreAngle = iteration * rotationalStep;

            [-halfWidth, halfWidth].forEach(offset => {
                const angle = centreAngle + offset;
                rotatedPoints.push(
                    axis.clone().multiplyScalar(axialDistance)
                        .addScaledVector(tangent, Math.cos(angle) * radius)
                        .addScaledVector(bitangent, Math.sin(angle) * radius)
                );
            });
        }
    });

    const geometry = new ConvexGeometry(uniquePoints(rotatedPoints));
    geometry.computeVertexNormals();
    return geometry;
}

function geometryFor(name, vectors, stage = 0) {
    const parameters = parametersFor(name);
    const bodySize = SIZE_FACTORS[parameters[0]];
    const aspectRatio = stage >= 1
        ? AXIAL_ASPECT_RATIOS[parameters[1]]
        : AXIAL_ASPECT_RATIOS[0];
    const counterRatio = stage >= 2
        ? COUNTER_TETRA_RATIOS[parameters[2]]
        : COUNTER_TETRA_RATIOS[0];
    const rotationalStep = ROTATIONAL_STEPS[parameters[3]];
    const tetrahedron = "GRDN".split("")
        .map(letter => vectors[letter].clone().normalize());
    const axis = tetrahedron[0].clone().normalize();
    const rootVertices = rootTetrahedron(tetrahedron, bodySize, aspectRatio);
    let triangles = stage >= 2 && parameters[2] === 0
        ? triangularBipyramidSurface(rootVertices)
        : crystalSurface(rootVertices, counterRatio);
    if (stage >= 3 && rotationalStep !== null) {
        return rotationalGeometry(triangles, axis, rotationalStep);
    }

    const positions = [];
    triangles.forEach(([first, second, third]) => {
        appendTriangle(positions, first, second, third);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function positionFor(name, vectors) {
    const letters = [name[0], name[2], name[3], name[5]];
    const position = new THREE.Vector3();

    // Four successive tetrahedral choices address 256 distinct, separated
    // cells. This preserves the shared geometry while preventing object
    // overlap when the whole Gordon collection is materialised.
    letters.forEach((letter, index) => {
        position.addScaledVector(
            vectors[letter],
            (COORDINATE_SCALE * 4) / (2 ** (index + 1))
        );
    });

    return position;
}

function createWordLabel(scene, name, colour) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;

    const context = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
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

    mesh.renderOrder = 2;
    mesh.visible = false;
    scene.add(mesh);

    const label = { canvas, context, texture, mesh, name };
    drawWordLabel(label, colour);
    return label;
}

function drawWordLabel(label, colour) {
    label.context.clearRect(0, 0, label.canvas.width, label.canvas.height);
    label.context.fillStyle = `#${colour.getHexString()}`;
    label.context.font = "80px ProFont, monospace";
    label.context.textAlign = "center";
    label.context.textBaseline = "middle";
    label.context.fillText(label.name, 256, 64);
    label.texture.needsUpdate = true;
}

function pointKey(point) {
    return [point.x, point.y, point.z]
        .map(value => value.toFixed(5))
        .join(",");
}

function cross2D(first, second) {
    return first.x * second.y - first.y * second.x;
}

function convexHull2D(points) {
    const sorted = [...points]
        .sort((first, second) => first.x - second.x || first.y - second.y)
        .filter((point, index, all) => (
            index === 0
            || Math.hypot(point.x - all[index - 1].x, point.y - all[index - 1].y) > 0.01
        ));

    if (sorted.length <= 2) {
        return sorted;
    }

    const turn = (first, second, third) => cross2D(
        { x: second.x - first.x, y: second.y - first.y },
        { x: third.x - second.x, y: third.y - second.y }
    );
    const buildHalf = vertices => {
        const half = [];
        vertices.forEach(vertex => {
            while (
                half.length >= 2
                && turn(half[half.length - 2], half[half.length - 1], vertex) <= 0
            ) {
                half.pop();
            }
            half.push(vertex);
        });
        return half;
    };
    const lower = buildHalf(sorted);
    const upper = buildHalf([...sorted].reverse());
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function rayExitDistance(origin, direction, hull) {
    let exitDistance = 0;

    hull.forEach((first, index) => {
        const second = hull[(index + 1) % hull.length];
        const segment = { x: second.x - first.x, y: second.y - first.y };
        const denominator = cross2D(direction, segment);

        if (Math.abs(denominator) < 0.00001) {
            return;
        }

        const relative = { x: first.x - origin.x, y: first.y - origin.y };
        const distance = cross2D(relative, segment) / denominator;
        const segmentProgress = cross2D(relative, direction) / denominator;

        if (
            distance >= -0.01
            && segmentProgress >= -0.001
            && segmentProgress <= 1.001
        ) {
            exitDistance = Math.max(exitDistance, distance);
        }
    });

    return exitDistance;
}

function labelGeometryForGeometry(geometry) {
    const positions = geometry.getAttribute("position");
    const indices = geometry.index;
    const triangleCount = (indices ? indices.count : positions.count) / 3;
    const edges = new Map();

    const pointAt = vertexIndex => new THREE.Vector3().fromBufferAttribute(
        positions,
        indices ? indices.getX(vertexIndex) : vertexIndex
    );

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
        const points = [0, 1, 2].map(offset => pointAt(triangleIndex * 3 + offset));
        const normal = new THREE.Vector3().crossVectors(
            points[1].clone().sub(points[0]),
            points[2].clone().sub(points[0])
        ).normalize();

        [[0, 1], [1, 2], [2, 0]].forEach(([firstIndex, secondIndex]) => {
            const first = points[firstIndex];
            const second = points[secondIndex];
            const keys = [pointKey(first), pointKey(second)].sort();
            const key = keys.join("|");
            const edge = edges.get(key);

            if (edge) {
                edge.normals.push(normal);
                return;
            }

            edges.set(key, {
                first: first.clone(),
                second: second.clone(),
                normals: [normal]
            });
        });
    }

    const allEdges = [...edges.values()];
    // Ignore diagonals introduced only to triangulate a flat polygon. What
    // remains is a real crease on the crystal's exterior surface.
    const exteriorEdges = allEdges.filter(edge => (
        edge.normals.length === 1
        || edge.normals.some((normal, index) => (
            edge.normals.slice(index + 1).some(other => (
                Math.abs(normal.dot(other)) < 0.995
            ))
        ))
    ));
    const candidates = exteriorEdges.length > 0 ? exteriorEdges : allEdges;
    const vertices = uniquePoints(
        Array.from({ length: positions.count }, (_, index) => (
            new THREE.Vector3().fromBufferAttribute(positions, index)
        ))
    );

    return { edges: candidates, vertices };
}

export class GordonObject {
    constructor(scene, name, theme, { universe = "gordon" } = {}) {
        this.scene = scene;
        this.name = name;
        this.theme = theme;
        this.universe = universe;
        this.definition = getUniverse(universe);
        this.locked = false;
        this.inactiveUniverse = false;
        this.selected = false;
        this.hovered = false;
        this.labelSuppressed = false;
        this.wordLabel = null;
        this.labelFadeProgress = 0;
        this.activeLabelEdge = null;
        this.entropy = 0;
        this.growth = 0;
        this.identityColour = this.definition.colourForName(name, theme);
        this.agedColour = new THREE.Color(theme.agedPath);
        this.stageGeometries = [0, 1, 2, 3].map(stage => (
            geometryFor(name, this.definition.vectors, stage)
        ));
        this.labelGeometries = this.stageGeometries.map(labelGeometryForGeometry);
        this.stageIndex = 0;
        this.geometry = this.stageGeometries[this.stageIndex];
        this.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            vertexColors: true,
            flatShading: true,
            metalness: 0,
            roughness: 0.05,
            ior: 1.76,
            transmission: 0.72,
            thickness: 0.7,
            attenuationColor: this.identityColour.clone(),
            attenuationDistance: 5.5,
            clearcoat: 0.24,
            clearcoatRoughness: 0.03,
            envMapIntensity: 1.4,
            emissive: this.identityColour.clone().multiplyScalar(0.025),
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.86,
            side: THREE.DoubleSide,
            depthWrite: true
        });
        this.object = new THREE.Mesh(this.geometry, this.material);
        this.object.userData.ronaldPath = this;
        this.object.position.copy(positionFor(name, this.definition.vectors));
        // G is the canonical forward tip of every local tetrahedron. Aim it
        // towards the shared centre so the whole GORDON field reads inward.
        const localForward = this.definition.vectors.G.clone().normalize();
        const inwardDirection = this.object.position.clone().negate().normalize();
        this.object.quaternion.setFromUnitVectors(localForward, inwardDirection);
        this.pickProxy = new THREE.Mesh(
            new THREE.SphereGeometry(PICK_PROXY_RADIUS, 20, 16),
            new THREE.MeshBasicMaterial({
                colorWrite: false,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                depthTest: false,
                side: THREE.DoubleSide
            })
        );
        this.pickProxy.position.copy(this.object.position);
        this.pickProxy.userData.ronaldPath = this;
        // This is deliberately a generous recovery target for translucent
        // facets, not the authoritative surface. The picker prioritises the
        // rendered crystal so neighbouring GORDON hit volumes cannot steal
        // one another's clicks.
        this.pickProxy.userData.gordonPickProxy = true;
        this.object.scale.setScalar(0.001);
        // The hit volume is deliberately available before the visible crystal
        // reaches full size, so a newly materialised GORDON never has a
        // non-interactive growth window.
        this.pickProxy.scale.setScalar(0.72);
        scene.add(this.object, this.pickProxy);
        this.updateAppearance();
    }

    enableWordLabel() {
        if (this.wordLabel) {
            return;
        }

        this.wordLabel = createWordLabel(this.scene, this.name, this.identityColour);
        this.updateWordLabelVisibility();
    }

    setLabelSuppressed(suppressed) {
        this.labelSuppressed = suppressed;
        this.updateWordLabelVisibility();
    }

    setTheme(theme) {
        this.theme = theme;
        this.identityColour.copy(this.definition.colourForName(this.name, theme));
        this.agedColour.set(theme.agedPath);
        this.updateAppearance();
    }

    increaseEntropy() {
        this.entropy = 1 - (1 - this.entropy) * (1 - GORDON_ENTROPY_STEP);
        this.updateAppearance();
    }
    ageToMaximumEntropy() { this.entropy = 1; this.updateAppearance(); }
    recoverVitality() { this.entropy = 0; this.updateAppearance(); }
    setLocked(locked) { this.locked = locked; if (locked) { this.setSelected(false); this.setHovered(false); } }

    setUniverseVisible(active) {
        this.inactiveUniverse = !active;
        this.object.visible = true;
        this.pickProxy.visible = true;
        this.updateAppearance();
    }

    setSelected(selected) { this.selected = selected; this.updateAppearance(); this.updateWordLabelVisibility(); }
    setHovered(hovered) { this.hovered = hovered; this.updateAppearance(); this.updateWordLabelVisibility(); }

    updateAppearance() {
        // Selection is an inspection state: it reveals the crystal at its
        // original vitality without erasing its accumulated entropy. As soon
        // as another GORDON is selected, this one resumes its aged appearance.
        const displayedEntropy = this.selected ? 0 : this.entropy;
        const colour = this.identityColour.clone().lerp(this.agedColour, displayedEntropy);
        const active = this.selected || this.hovered;
        this.updateVertexColours(colour);
        this.material.attenuationColor.copy(colour);
        // Selection opens the crystal up: less surface blur, more
        // transmission and substantially stronger studio reflections.
        this.material.roughness = this.selected ? 0.018 : this.hovered ? 0.03 : 0.05;
        this.material.transmission = this.selected ? 0.84 : this.hovered ? 0.78 : 0.72;
        this.material.thickness = this.selected ? 1 : this.hovered ? 0.82 : 0.7;
        this.material.clearcoat = this.selected ? 0.36 : this.hovered ? 0.3 : 0.24;
        this.material.clearcoatRoughness = this.selected ? 0.012 : this.hovered ? 0.02 : 0.03;
        this.material.envMapIntensity = this.selected ? 2.55 : this.hovered ? 1.85 : 1.4;
        this.material.emissive.copy(colour).multiplyScalar(active ? 0.04 : 0.025);
        this.material.emissiveIntensity = active ? 0.55 : 0.4;

        // The new convex surface has no competing internal faces, so a small
        // alpha contribution can expose the stage through the crystal without
        // reviving the old double-sided sorting artefacts.
        this.material.opacity = this.inactiveUniverse
            ? INACTIVE_OPACITY
            : this.selected
            ? 0.92
            : this.hovered
            ? 0.89
            : 0.86;

        if (this.wordLabel) {
            drawWordLabel(this.wordLabel, colour);
        }
        this.updateWordLabelVisibility();
    }

    updateVertexColours(colour) {
        const normals = this.geometry.getAttribute("normal");
        let colours = this.geometry.getAttribute("color");
        // The surface stays lightly tinted while attenuation carries the
        // saturated colour through the body. This leaves enough white light
        // to cross the volume and makes overlapping facets visibly refract.
        const surfaceClarity = this.selected ? 0.24 : this.hovered ? 0.19 : 0.14;
        const gemstoneColour = colour.clone()
            .lerp(new THREE.Color(0xffffff), surfaceClarity)
            .offsetHSL(0, 0.08, 0.015);

        if (!colours) {
            colours = new THREE.BufferAttribute(new Float32Array(normals.count * 3), 3);
            this.geometry.setAttribute("color", colours);
        }

        for (let index = 0; index < normals.count; index += 1) {
            colours.setXYZ(index, gemstoneColour.r, gemstoneColour.g, gemstoneColour.b);
        }
        colours.needsUpdate = true;
    }

    update(delta, camera, renderer) {
        if (this.growth < 1.3) {
            this.growth = Math.min(1.3, this.growth + delta * GROWTH_PER_SECOND);
            const scale = THREE.MathUtils.smootherstep(
                Math.min(1, this.growth / 0.55),
                0,
                1
            );
            this.object.scale.setScalar(Math.max(0.001, scale));
            this.pickProxy.scale.setScalar(Math.max(0.72, scale));

            const nextStage = this.growth < 0.55
                ? 0
                : Math.min(3, Math.floor((this.growth - 0.55) / 0.24) + 1);
            if (nextStage !== this.stageIndex) {
                this.stageIndex = nextStage;
                this.geometry = this.stageGeometries[this.stageIndex];
                this.object.geometry = this.geometry;
                this.updateAppearance();
            }
        }

        this.updateWordLabel(delta, camera, renderer);
    }

    updateWordLabelVisibility() {
        if (!this.wordLabel) {
            return;
        }

        const visible = !this.inactiveUniverse
            && (this.selected || (this.hovered && !this.labelSuppressed));
        this.wordLabel.mesh.visible = visible;

        if (!visible) {
            this.labelFadeProgress = 0;
            this.wordLabel.mesh.material.opacity = 0;
        }
    }

    updateWordLabel(delta, camera, renderer) {
        if (!this.wordLabel) {
            return;
        }

        this.updateWordLabelVisibility();
        if (!this.wordLabel.mesh.visible || renderer.domElement.clientHeight === 0) {
            return;
        }

        this.labelFadeProgress = Math.min(
            1,
            this.labelFadeProgress + delta / WORD_LABEL_FADE_SECONDS
        );
        this.wordLabel.mesh.material.opacity = WORD_LABEL_OPACITY * this.labelFadeProgress;

        const viewportWidth = renderer.domElement.clientWidth;
        const viewportHeight = renderer.domElement.clientHeight;
        const labelGeometry = this.labelGeometries[this.stageIndex];
        const toWorld = point => point.clone()
            .multiply(this.object.scale)
            .applyQuaternion(this.object.quaternion)
            .add(this.object.position);
        const toScreen = point => {
            const projected = point.clone().project(camera);
            return {
                x: (projected.x + 1) * viewportWidth / 2,
                y: (1 - projected.y) * viewportHeight / 2
            };
        };
        const screenVertices = labelGeometry.vertices.map(point => toScreen(toWorld(point)));
        const screenHull = convexHull2D(screenVertices);
        const screenCentre = toScreen(this.object.position);
        const labelHalfWidth = WORD_SCREEN_WIDTH / 2;
        const labelHalfHeight = WORD_SCREEN_WIDTH * 0.125;
        const viewportMargin = 8;
        const placements = [];

        labelGeometry.edges.forEach((edge, edgeIndex) => {
            const worldFirst = toWorld(edge.first);
            const worldSecond = toWorld(edge.second);
            const first = toScreen(worldFirst);
            const second = toScreen(worldSecond);
            const deltaX = second.x - first.x;
            const deltaY = second.y - first.y;
            const projectedLength = Math.hypot(deltaX, deltaY);
            const activeEdge = this.activeLabelEdge?.stageIndex === this.stageIndex
                && this.activeLabelEdge.edgeIndex === edgeIndex
                ? this.activeLabelEdge
                : null;
            let tangent;

            if (projectedLength >= 4) {
                tangent = { x: deltaX / projectedLength, y: deltaY / projectedLength };
            } else if (activeEdge?.tangent) {
                // An edge viewed end-on no longer supplies a useful screen
                // direction, but that does not make its already-clear label
                // invisible. Preserve the last stable direction.
                tangent = { ...activeEdge.tangent };
            } else {
                return;
            }

            const midpoint = {
                x: (first.x + second.x) / 2,
                y: (first.y + second.y) / 2
            };
            const outward = { x: -tangent.y, y: tangent.x };
            if (
                (midpoint.x - screenCentre.x) * outward.x
                + (midpoint.y - screenCentre.y) * outward.y < 0
            ) {
                outward.x *= -1;
                outward.y *= -1;
            }

            // Measure the whole projected crystal in this outward direction.
            // Beyond this support line is guaranteed empty space, even when
            // the chosen edge sits behind another transparent facet.
            const crystalExtent = Math.max(0, ...screenVertices.map(vertex => (
                (vertex.x - midpoint.x) * outward.x
                + (vertex.y - midpoint.y) * outward.y
            )));
            // Clear only the part of the silhouette beneath the label. A
            // global support line creates huge gaps on tapered crystals when
            // some unrelated vertex is much farther out in the same direction.
            const silhouetteDistance = Math.max(
                ...[-1, -0.67, -0.33, 0, 0.33, 0.67, 1].map(progress => (
                    rayExitDistance(
                        {
                            x: midpoint.x + tangent.x * labelHalfWidth * progress,
                            y: midpoint.y + tangent.y * labelHalfWidth * progress
                        },
                        outward,
                        screenHull
                    )
                ))
            );
            const centreOffset = silhouetteDistance + WORD_SCREEN_OFFSET + labelHalfHeight;
            const labelCentre = {
                x: midpoint.x + outward.x * centreOffset,
                y: midpoint.y + outward.y * centreOffset
            };
            const boxHalfWidth = Math.abs(tangent.x) * labelHalfWidth
                + Math.abs(outward.x) * labelHalfHeight;
            const boxHalfHeight = Math.abs(tangent.y) * labelHalfWidth
                + Math.abs(outward.y) * labelHalfHeight;
            const overflow = Math.max(0, viewportMargin + boxHalfWidth - labelCentre.x)
                + Math.max(0, labelCentre.x + boxHalfWidth + viewportMargin - viewportWidth)
                + Math.max(0, viewportMargin + boxHalfHeight - labelCentre.y)
                + Math.max(0, labelCentre.y + boxHalfHeight + viewportMargin - viewportHeight);
            const labelClearance = centreOffset - labelHalfHeight - silhouetteDistance;
            // Camera-space Y is the authority here: upper silhouette edges
            // should win whenever a replacement is genuinely required.
            const heightAboveCentre = screenCentre.y - midpoint.y;
            const upwardOutwardness = Math.max(0, -outward.y);
            const score = heightAboveCentre * 1.6
                + upwardOutwardness * 52
                + Math.min(projectedLength, WORD_SCREEN_WIDTH * 1.5) * 0.35
                - crystalExtent * 10
                - overflow * 25;

            placements.push({
                edgeIndex,
                worldFirst,
                worldSecond,
                tangent,
                outward,
                centreOffset,
                labelCentre,
                projectedLength,
                crystalExtent,
                silhouetteDistance,
                labelClearance,
                overflow,
                score
            });
        });

        if (placements.length === 0) {
            return;
        }

        const currentPlacement = this.activeLabelEdge?.stageIndex === this.stageIndex
            ? placements.find(placement => (
                placement.edgeIndex === this.activeLabelEdge.edgeIndex
            ))
            : null;
        const currentLabelIsClear = currentPlacement
            && currentPlacement.labelClearance >= 1
            && currentPlacement.overflow <= 1;
        const clearPlacements = placements.filter(placement => (
            placement.projectedLength >= LABEL_EDGE_MIN_PROJECTED_LENGTH
            && placement.crystalExtent <= LABEL_EDGE_OCCLUSION_TOLERANCE
            && placement.overflow <= 1
        ));
        const replacementPool = clearPlacements.length > 0
            ? clearPlacements
            : placements;
        // The edge may disappear behind the crystal without invalidating its
        // label. Relocate only when the label itself reaches the silhouette or
        // the viewport boundary; edge visibility only ranks replacements.
        const bestPlacement = currentLabelIsClear
            ? currentPlacement
            : replacementPool.reduce((best, placement) => (
                !best || placement.score > best.score ? placement : best
            ), null);

        this.activeLabelEdge = {
            stageIndex: this.stageIndex,
            edgeIndex: bestPlacement.edgeIndex,
            tangent: { ...bestPlacement.tangent }
        };
        const edgeMidpoint = bestPlacement.worldFirst.clone()
            .add(bestPlacement.worldSecond)
            .multiplyScalar(0.5);
        let tangentX = bestPlacement.tangent.x;
        let tangentY = bestPlacement.tangent.y;
        if (tangentX < 0 || (Math.abs(tangentX) < 0.001 && tangentY > 0)) {
            tangentX *= -1;
            tangentY *= -1;
        }

        const projectedDepth = edgeMidpoint.clone().project(camera).z;
        const unprojectScreen = point => new THREE.Vector3(
            point.x / viewportWidth * 2 - 1,
            1 - point.y / viewportHeight * 2,
            projectedDepth
        ).unproject(camera);
        const labelPosition = unprojectScreen(bestPlacement.labelCentre);
        const labelEnd = unprojectScreen({
            x: bestPlacement.labelCentre.x + tangentX * WORD_SCREEN_WIDTH,
            y: bestPlacement.labelCentre.y + tangentY * WORD_SCREEN_WIDTH
        });
        const xAxis = labelEnd.clone().sub(labelPosition).normalize();
        const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
        const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
        const labelScale = labelPosition.distanceTo(labelEnd);
        const orientation = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);

        this.wordLabel.mesh.position.copy(labelPosition);
        this.wordLabel.mesh.quaternion.setFromRotationMatrix(orientation);
        this.wordLabel.mesh.scale.setScalar(labelScale);
    }

    getPickableObjects() {
        return this.locked || this.inactiveUniverse ? [] : [this.object, this.pickProxy];
    }
    getFocusTarget() {
        return this.object.position.clone();
    }
    getFocusRadius() {
        this.geometry.computeBoundingSphere();
        return Math.max(1, this.geometry.boundingSphere.radius * this.object.scale.x);
    }
    getHistoryColour(highlighted = false) {
        const colour = highlighted ? this.identityColour : this.identityColour.clone().lerp(this.agedColour, this.entropy);
        return `#${colour.getHexString()}`;
    }
    getIdentityColour() { return `#${this.identityColour.getHexString()}`; }
    dispose() {
        this.scene.remove(this.object, this.pickProxy);
        this.stageGeometries.forEach(geometry => geometry.dispose());
        this.material.dispose();
        this.pickProxy.geometry.dispose();
        this.pickProxy.material.dispose();

        if (this.wordLabel) {
            this.scene.remove(this.wordLabel.mesh);
            this.wordLabel.mesh.geometry.dispose();
            this.wordLabel.texture.dispose();
            this.wordLabel.mesh.material.dispose();
        }
    }
}
