import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

import { COORDINATE_SCALE } from "./constants.js";
import { getUniverse } from "./universes.js";

const FORMATION_SECONDS = 2;
const BASE_RADIUS = 0.5;
const INACTIVE_OPACITY = 0.055;
const ENTROPY_STEP = 0.025;
const PICK_RADIUS = 0.92;
const SILVER = new THREE.Color(0xf7f4e8);
const WHITE = new THREE.Color(0xffffff);
const RELAXATION_STEPS = 12;
const SURFACE_TENSION = 0.19;

function positionFor(name, vectors) {
    const letters = [name[0], name[2], name[3], name[5]];
    const position = new THREE.Vector3();

    letters.forEach((letter, index) => {
        position.addScaledVector(
            vectors[letter],
            (COORDINATE_SCALE * 4) / (2 ** (index + 1))
        );
    });

    return position;
}

function smoother01(value) {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped * clamped * clamped
        * (clamped * (clamped * 6 - 15) + 10);
}

function geometryVolume(geometry) {
    const positions = geometry.getAttribute("position");
    const indices = geometry.index;
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();
    const third = new THREE.Vector3();
    const cross = new THREE.Vector3();
    let volume = 0;
    const triangleCount = indices ? indices.count / 3 : positions.count / 3;

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const offset = triangle * 3;
        const firstIndex = indices ? indices.getX(offset) : offset;
        const secondIndex = indices ? indices.getX(offset + 1) : offset + 1;
        const thirdIndex = indices ? indices.getX(offset + 2) : offset + 2;
        first.fromBufferAttribute(positions, firstIndex);
        second.fromBufferAttribute(positions, secondIndex);
        third.fromBufferAttribute(positions, thirdIndex);
        cross.crossVectors(second, third);
        volume += first.dot(cross) / 6;
    }

    return Math.abs(volume);
}

function particleArrayVolume(particles, indices) {
    let volume = 0;
    const triangleCount = indices.count / 3;

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const indexOffset = triangle * 3;
        const a = indices.getX(indexOffset) * 3;
        const b = indices.getX(indexOffset + 1) * 3;
        const c = indices.getX(indexOffset + 2) * 3;
        const crossX = particles[b + 1] * particles[c + 2]
            - particles[b + 2] * particles[c + 1];
        const crossY = particles[b + 2] * particles[c]
            - particles[b] * particles[c + 2];
        const crossZ = particles[b] * particles[c + 1]
            - particles[b + 1] * particles[c];
        volume += (
            particles[a] * crossX
            + particles[a + 1] * crossY
            + particles[a + 2] * crossZ
        ) / 6;
    }

    return Math.abs(volume);
}

function buildParticleNeighbours(geometry) {
    const positions = geometry.getAttribute("position");
    const indices = geometry.index;
    const neighbours = Array.from(
        { length: positions.count },
        () => new Set()
    );
    const triangleCount = indices ? indices.count / 3 : positions.count / 3;

    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const offset = triangle * 3;
        const a = indices ? indices.getX(offset) : offset;
        const b = indices ? indices.getX(offset + 1) : offset + 1;
        const c = indices ? indices.getX(offset + 2) : offset + 2;
        neighbours[a].add(b);
        neighbours[a].add(c);
        neighbours[b].add(a);
        neighbours[b].add(c);
        neighbours[c].add(a);
        neighbours[c].add(b);
    }

    return neighbours.map(set => Uint16Array.from(set));
}

function createContactMeniscusGeometry(
    radialSegments = 24,
    axialSegments = 12
) {
    const positions = new Float32Array(
        (axialSegments + 1) * radialSegments * 3
    );
    const indices = [];

    for (let axial = 0; axial < axialSegments; axial += 1) {
        for (let radial = 0; radial < radialSegments; radial += 1) {
            const nextRadial = (radial + 1) % radialSegments;
            const a = axial * radialSegments + radial;
            const b = axial * radialSegments + nextRadial;
            const c = (axial + 1) * radialSegments + radial;
            const d = (axial + 1) * radialSegments + nextRadial;
            indices.push(a, b, c, b, d, c);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    return geometry;
}

function updateContactMeniscusGeometry(geometry, radius, distance) {
    const positions = geometry.getAttribute("position");
    const radialSegments = 24;
    const axialSegments = 12;
    const attachmentAngle = 0.31;
    const attachmentZ = radius * Math.cos(attachmentAngle);
    const attachmentRadius = radius * Math.sin(attachmentAngle);
    const endZ = distance - attachmentZ;
    const length = Math.max(0.0001, endZ - attachmentZ);
    const tangent = -(
        Math.cos(attachmentAngle) / Math.sin(attachmentAngle)
    ) * length;
    let volume = 0;
    let previousRadius = attachmentRadius;

    for (let axial = 0; axial <= axialSegments; axial += 1) {
        const t = axial / axialSegments;
        const t2 = t * t;
        const t3 = t2 * t;
        const hermite = (2 * t3 - 3 * t2 + 1) * attachmentRadius
            + (t3 - 2 * t2 + t) * tangent
            + (-2 * t3 + 3 * t2) * attachmentRadius
            + (t3 - t2) * -tangent;
        const concavity = 16 * t2 * (1 - t) * (1 - t);
        const ringRadius = Math.max(
            0.001,
            hermite - attachmentRadius * 0.24 * concavity
        );
        const z = attachmentZ + length * t;

        for (let radial = 0; radial < radialSegments; radial += 1) {
            const angle = radial / radialSegments * Math.PI * 2;
            const index = axial * radialSegments + radial;
            positions.setXYZ(
                index,
                Math.cos(angle) * ringRadius,
                Math.sin(angle) * ringRadius,
                z
            );
        }

        if (axial > 0) {
            const step = length / axialSegments;
            volume += Math.PI * (
                previousRadius * previousRadius
                + ringRadius * ringRadius
            ) * 0.5 * step;
        }
        previousRadius = ringRadius;
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return volume;
}

function createDropletGeometry(radius) {
    let geometry = new THREE.IcosahedronGeometry(radius, 4);
    geometry.deleteAttribute("uv");
    geometry.deleteAttribute("normal");
    geometry = mergeVertices(geometry, 0.000001);
    const positions = geometry.getAttribute("position");
    let cuspIndex = 0;
    let cuspAlignment = -Infinity;

    for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        const alignment = z / Math.sqrt(x * x + y * y + z * z);
        if (alignment > cuspAlignment) {
            cuspAlignment = alignment;
            cuspIndex = index;
        }
    }

    // Every detached droplet shares one exact outward surface sample. Later M
    // operations can therefore pull a single sharp point out of an R plateau
    // instead of lifting a small, rounded polygon of nearby samples.
    const cuspRadius = Math.sqrt(
        positions.getX(cuspIndex) ** 2
            + positions.getY(cuspIndex) ** 2
            + positions.getZ(cuspIndex) ** 2
    );
    positions.setXYZ(cuspIndex, 0, 0, cuspRadius);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
}

function updateDropletGeometry(level, operations) {
    const positions = level.sphereGeometry.getAttribute("position");
    const nextCOperation = operations.find(operation => (
        operation.operationIndex > level.operationIndex
        && operation.letter === "C"
    ));
    const laterOperations = operations
        .filter(operation => (
            operation.operationIndex > level.operationIndex
            && (
                !nextCOperation
                || operation.operationIndex < nextCOperation.operationIndex
            )
        ))
        .map(operation => ({
            ...operation,
            recursiveDepth: operation.operationIndex
                - level.operationIndex
                - 1
        }));

    for (let index = 0; index < positions.count; index += 1) {
        const offset = index * 3;
        let x = level.sphereBasePositions[offset];
        let y = level.sphereBasePositions[offset + 1];
        let z = level.sphereBasePositions[offset + 2];
        let rIndentation = 0;

        laterOperations.forEach(operation => {
            let length = Math.sqrt(x * x + y * y + z * z);
            const alignment = z / length;
            const addressScale = recursiveLinearScale(
                operation.recursiveDepth
            );

            if (operation.letter === "M") {
                const pulledLength = length + mastDeformation(
                    alignment,
                    operation.recursiveDepth
                )
                    * operation.progress
                    * level.radius
                    * 1.8
                    * addressScale;
                const scale = pulledLength / length;
                x *= scale;
                y *= scale;
                z *= scale;
            } else if (operation.letter === "R") {
                rIndentation += level.radius
                    * 0.38
                    * addressScale
                    * operation.progress;
                const capDistance = level.radius * Math.max(
                    0.3,
                    1 - rIndentation / level.radius
                );
                const influence = recursiveOperationInfluence(
                    alignment,
                    operation.recursiveDepth
                ) * operation.progress;
                if (influence > 0 && z > capDistance) {
                    const excess = z - capDistance;
                    const flattenedZ = capDistance + excess * 0.075;
                    z = THREE.MathUtils.lerp(z, flattenedZ, influence);
                }
            } else if (operation.letter === "S") {
                length = Math.sqrt(x * x + y * y + z * z);
                const sunkLength = Math.max(
                    level.radius * 0.12,
                    length + level.radius
                        * sinkDeformation(
                            z / length,
                            operation.recursiveDepth,
                            operation.progress
                        )
                );
                const scale = sunkLength / length;
                x *= scale;
                y *= scale;
                z *= scale;
            }
        });
        positions.setXYZ(index, x, y, z);
    }

    positions.needsUpdate = true;
    level.sphereGeometry.computeVertexNormals();
    level.sphereGeometry.computeBoundingSphere();
    level.deformedVolume = geometryVolume(level.sphereGeometry);
}

function operationProgress(progress, operationIndex) {
    const start = operationIndex * 0.22;
    return smoother01((progress - start) / 0.34);
}

function smoothBand(position, centre, width) {
    const distance = Math.abs(position - centre) / width;
    return smoother01(1 - distance);
}

function sinkDeformation(alignment, depth, progress) {
    const influenceStart = recursiveInfluenceStart(depth);
    if (alignment <= influenceStart) return 0;

    const capPosition = THREE.MathUtils.clamp(
        (alignment - influenceStart) / (1 - influenceStart),
        0,
        1
    );
    const addressScale = recursiveLinearScale(depth);
    const inwardCup = -0.34 * smoother01(capPosition);
    const displacedShoulder = 0.115 * smoothBand(
        capPosition,
        0.3,
        0.27
    );

    return (inwardCup + displacedShoulder)
        * addressScale
        * progress;
}

function recursiveLinearScale(depth) {
    // A quarter-volume region has 4^(-1/3) of its parent's characteristic
    // length. Use that scale for the force amplitude at each deeper slot.
    return Math.pow(0.25, Math.max(0, depth) / 3);
}

function recursiveInfluenceStart(depth) {
    // Near a spherical tip, cap volume is approximately proportional to the
    // square of cap height. Halving the supported cap height therefore makes
    // each operation address roughly one quarter of its predecessor's mass.
    return 1 - (1 - 0.42) * Math.pow(0.5, Math.max(0, depth));
}

function recursiveOperationInfluence(alignment, depth) {
    const influenceStart = recursiveInfluenceStart(depth);
    return smoother01(
        (alignment - influenceStart) / (1 - influenceStart)
    );
}

function mastDeformation(alignment, depth = 0) {
    const influenceStart = recursiveInfluenceStart(depth);

    if (alignment <= influenceStart) {
        return 0;
    }

    // MAST: exactly one surface point is constrained and pulled outward.
    // The surrounding liquid follows the logarithmic response of a tensioned
    // membrane over geodesic distance from that point.
    const capAngle = Math.acos(influenceStart);
    const angle = Math.acos(THREE.MathUtils.clamp(alignment, -1, 1));
    const pointRegularisation = 0.012;
    const capChord = Math.sin(capAngle / 2);
    const angularChord = Math.sin(angle / 2);
    const maximumResponse = Math.log(
        (capChord + pointRegularisation) / pointRegularisation
    );
    const response = THREE.MathUtils.clamp(
        Math.log(
            (capChord + pointRegularisation)
            / (angularChord + pointRegularisation)
        ) / maximumResponse,
        0,
        1
    );
    const attachment = smoother01(Math.min(1, response / 0.12));
    return 1.04 * Math.pow(response, 1.55) * attachment;
}

function drawLabel(label, colour) {
    const { context, texture, name } = label;
    context.clearRect(0, 0, 512, 128);
    context.fillStyle = colour;
    context.font = "70px ProFont, monospace";
    context.textAlign = "center";
    context.fillText(name, 256, 82);
    texture.needsUpdate = true;
}

function createLabel(scene, name) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        opacity: 0
    });
    const mesh = new THREE.Sprite(material);
    mesh.scale.set(2.4, 0.6, 1);
    mesh.renderOrder = 4;
    scene.add(mesh);
    const label = {
        context: canvas.getContext("2d"),
        texture,
        material,
        mesh,
        name
    };
    drawLabel(label, "#ffffff");
    return label;
}

export class MarcusObject {
    constructor(scene, name, theme, { universe = "marcus" } = {}) {
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
        this.entropy = 0;
        this.formation = 0;
        this.identityColour = SILVER.clone();
        this.agedColour = new THREE.Color(theme.agedPath);
        this.letters = [name[0], name[2], name[3], name[5]];
        this.axes = Object.values(this.definition.vectors)
            .map(axis => axis.clone().normalize());

        // An evenly subdivided icosphere allocates comparable surface detail
        // to every tetrahedral direction. This is especially important at
        // C's tiny contact patch, where a latitude grid produced long,
        // triangular join artefacts.
        this.geometry = new THREE.IcosahedronGeometry(BASE_RADIUS, 4);
        this.geometry.deleteAttribute("uv");
        this.geometry.deleteAttribute("normal");
        this.geometry = mergeVertices(this.geometry, 0.000001);
        this.geometry.computeVertexNormals();
        this.constantVolume = geometryVolume(this.geometry);
        const positions = this.geometry.getAttribute("position");
        this.directions = new Float32Array(positions.count * 3);
        this.particleNeighbours = buildParticleNeighbours(this.geometry);
        this.particleTargets = new Float32Array(positions.count * 3);
        this.particlePositions = new Float32Array(positions.count * 3);
        this.particleNext = new Float32Array(positions.count * 3);
        this.particleConstraints = new Float32Array(positions.count);
        for (let index = 0; index < positions.count; index += 1) {
            const direction = new THREE.Vector3().fromBufferAttribute(positions, index).normalize();
            direction.toArray(this.directions, index * 3);
        }
        // A latitude/longitude sphere does not naturally place vertices on
        // the tetrahedral directions. Snap the nearest sample to each exact
        // axis so a point pull terminates at one vertex instead of a small
        // polygonal plateau.
        this.axes.forEach(axis => {
            let cuspIndex = 0;
            let closestAlignment = -Infinity;
            const candidate = new THREE.Vector3();

            for (let index = 0; index < positions.count; index += 1) {
                candidate.fromArray(this.directions, index * 3);
                const alignment = candidate.dot(axis);
                if (alignment > closestAlignment) {
                    closestAlignment = alignment;
                    cuspIndex = index;
                }
            }

            axis.toArray(this.directions, cuspIndex * 3);
        });

        this.material = new THREE.MeshPhysicalMaterial({
            color: SILVER,
            metalness: 1,
            roughness: 0.018,
            envMapIntensity: 2.45,
            clearcoat: 0
        });
        this.object = new THREE.Mesh(this.geometry, this.material);
        this.object.position.copy(positionFor(name, this.definition.vectors));
        this.object.userData.ronaldPath = this;
        // MARCUS orientation is deliberately untouched: every specimen shares
        // exactly the same world-space tetrahedral axes.

        const firstCOperationIndex = this.letters.indexOf("C");
        this.primaryCSeparatesRoot = firstCOperationIndex === 0;
        let cLevel = 0;
        this.cLevels = [];
        this.letters.forEach((letter, operationIndex) => {
            if (letter !== "C") return;
            // Every operation addresses one quarter of the material handled
            // by the previous slot. A C therefore separates 1/4 per arm in
            // slot one, 1/16 in slot two, 1/64 in slot three, and so on.
            const volumeFraction = Math.pow(0.25, operationIndex + 1);
            const targetVolume = this.constantVolume * volumeFraction;
            let radius = BASE_RADIUS * Math.cbrt(volumeFraction);
            const sphereGeometry = createDropletGeometry(radius);
            const geometryScale = Math.cbrt(
                targetVolume / geometryVolume(sphereGeometry)
            );
            sphereGeometry.scale(
                geometryScale,
                geometryScale,
                geometryScale
            );
            sphereGeometry.computeVertexNormals();
            sphereGeometry.computeBoundingSphere();
            radius *= geometryScale;
            const sphereBasePositions = new Float32Array(
                sphereGeometry.getAttribute("position").array
            );
            const components = this.axes.map(axis => {
                const sphere = new THREE.Mesh(
                    sphereGeometry,
                    this.material
                );
                sphere.userData.ronaldPath = this;
                sphere.scale.setScalar(0.001);
                sphere.position.copy(this.object.position)
                    .addScaledVector(axis, BASE_RADIUS);
                sphere.quaternion.setFromUnitVectors(
                    new THREE.Vector3(0, 0, 1),
                    axis
                );
                return { axis, sphere };
            });
            const contactMeniscusGeometry
                = createContactMeniscusGeometry();
            const contactMenisci = [];
            for (let first = 0; first < components.length; first += 1) {
                for (let second = first + 1;
                    second < components.length;
                    second += 1) {
                    const mesh = new THREE.Mesh(
                        contactMeniscusGeometry,
                        this.material
                    );
                    mesh.userData.ronaldPath = this;
                    mesh.visible = false;
                    contactMenisci.push({ first, second, mesh });
                }
            }
            this.cLevels.push({
                level: cLevel,
                operationIndex,
                radius,
                targetVolume,
                sphereGeometry,
                sphereBasePositions,
                contactMeniscusGeometry,
                contactMenisci,
                components
            });
            cLevel += 1;
        });
        this.cSpheres = this.cLevels.flatMap(level => level.components);
        this.cContactMenisci = this.cLevels.flatMap(
            level => level.contactMenisci
        );

        this.pickProxy = new THREE.Mesh(
            new THREE.SphereGeometry(PICK_RADIUS, 16, 12),
            new THREE.MeshBasicMaterial({
                colorWrite: false,
                transparent: true,
                opacity: 0,
                depthWrite: false
            })
        );
        this.pickProxy.position.copy(this.object.position);
        this.pickProxy.userData.ronaldPath = this;
        this.pickProxy.userData.gordonPickProxy = true;
        scene.add(
            this.object,
            this.pickProxy,
            ...this.cSpheres.map(component => component.sphere),
            ...this.cContactMenisci.map(contact => contact.mesh)
        );
        this.applyDeformations(0);
        this.updateAppearance();
    }

    applyDeformations(progress) {
        const positions = this.geometry.getAttribute("position");
        const direction = new THREE.Vector3();
        const targetDirection = new THREE.Vector3();
        const targetPosition = new THREE.Vector3();
        const operations = this.letters.map((letter, operationIndex) => ({
            letter,
            operationIndex,
            progress: operationProgress(progress, operationIndex)
        }));
        const firstCOperationIndex = this.cLevels[0]?.operationIndex
            ?? Infinity;
        const rootOperations = operations.filter(operation => (
            operation.operationIndex < firstCOperationIndex
        ));
        const rProgressTotal = rootOperations.reduce((total, operation) => (
            total + (operation.letter === "R" ? operation.progress : 0)
        ), 0);
        const rootRStages = new Map();
        let cumulativeRootRIndentation = 0;
        rootOperations.forEach(operation => {
            if (operation.letter !== "R") return;
            cumulativeRootRIndentation += BASE_RADIUS
                * 0.24
                * recursiveLinearScale(operation.operationIndex)
                * operation.progress;
            rootRStages.set(operation.operationIndex, {
                recursiveDepth: operation.operationIndex,
                planeDistance: Math.max(
                    BASE_RADIUS * 0.3,
                    BASE_RADIUS - cumulativeRootRIndentation
                )
            });
        });
        this.cLevels.forEach(level => {
            updateDropletGeometry(level, operations);
        });
        const primaryCProgress = this.cLevels.length > 0
            ? operationProgress(
                progress,
                this.cLevels[0].operationIndex
            )
            : 0;
        let externalCVolumePerArm = 0;
        this.cLevels.forEach((level, levelIndex) => {
            const levelProgress = operationProgress(
                progress,
                level.operationIndex
            );
            const nextLevel = this.cLevels[levelIndex + 1];
            const nextLevelProgress = nextLevel
                ? operationProgress(progress, nextLevel.operationIndex)
                : 0;
            const volumePassedToChild = nextLevel
                ? nextLevel.targetVolume * Math.pow(nextLevelProgress, 3)
                : 0;
            level.currentTargetVolume = Math.max(
                level.targetVolume * Math.pow(levelProgress, 3)
                    - volumePassedToChild,
                0
            );
            level.currentScale = Math.cbrt(
                level.currentTargetVolume / level.deformedVolume
            );
            externalCVolumePerArm += level.currentTargetVolume;
        });
        const externalCVolume = this.axes.length
            * externalCVolumePerArm;
        const relaxationTargetVolume = Math.max(
            this.constantVolume * 0.000001,
            this.constantVolume - externalCVolume
        );

        for (let index = 0; index < positions.count; index += 1) {
            direction.fromArray(this.directions, index * 3);
            targetPosition.copy(direction).multiplyScalar(BASE_RADIUS);
            let constraint = 0.055;

            rootOperations.forEach(operation => {
                const recursiveDepth = operation.operationIndex;
                const addressScale = recursiveLinearScale(recursiveDepth);

                if (operation.letter === "M") {
                    const length = targetPosition.length();
                    targetDirection.copy(targetPosition)
                        .multiplyScalar(1 / length);
                    let pull = 0;

                    this.axes.forEach(axis => {
                        const alignment = targetDirection.dot(axis);
                        const mast = mastDeformation(
                            alignment,
                            recursiveDepth
                        );
                        pull += mast
                            * operation.progress
                            * BASE_RADIUS
                            * 0.92
                            * addressScale;
                        if (mast > 0) {
                            const response = Math.max(0, mast / 1.04);
                            constraint = Math.max(
                                constraint,
                                0.12 + Math.pow(response, 0.65)
                                    * Math.min(
                                        0.84,
                                        operation.progress * 0.28
                                    )
                            );
                        }
                    });
                    targetPosition.multiplyScalar(
                        Math.max(0.035, length + pull) / length
                    );
                } else if (operation.letter === "R") {
                    const stage = rootRStages.get(
                        operation.operationIndex
                    );
                    targetDirection.copy(targetPosition).normalize();

                    this.axes.forEach(axis => {
                        const influence = recursiveOperationInfluence(
                            targetDirection.dot(axis),
                            stage.recursiveDepth
                        ) * operation.progress;
                        const projection = targetPosition.dot(axis);
                        if (influence <= 0
                            || projection <= stage.planeDistance) return;
                        targetPosition.addScaledVector(
                            axis,
                            -(projection - stage.planeDistance) * influence
                        );
                        constraint = Math.max(
                            constraint,
                            0.42 + influence * 0.53
                        );
                    });
                } else if (operation.letter === "S") {
                    const length = targetPosition.length();
                    targetDirection.copy(targetPosition)
                        .multiplyScalar(1 / length);
                    let radialDisplacement = 0;
                    let strongestSink = 0;

                    this.axes.forEach(axis => {
                        const displacement = sinkDeformation(
                            targetDirection.dot(axis),
                            recursiveDepth,
                            operation.progress
                        );
                        radialDisplacement += BASE_RADIUS * displacement;
                        strongestSink = Math.max(
                            strongestSink,
                            Math.abs(displacement) / 0.34
                        );
                    });
                    targetPosition.multiplyScalar(
                        Math.max(
                            0.035,
                            length + radialDisplacement
                        ) / length
                    );
                    constraint = Math.max(
                        constraint,
                        0.12 + strongestSink * 0.48
                    );
                }
            });

            const offset = index * 3;
            this.particleTargets[offset] = targetPosition.x;
            this.particleTargets[offset + 1] = targetPosition.y;
            this.particleTargets[offset + 2] = targetPosition.z;
            this.particlePositions[offset] = this.particleTargets[offset];
            this.particlePositions[offset + 1]
                = this.particleTargets[offset + 1];
            this.particlePositions[offset + 2]
                = this.particleTargets[offset + 2];
            this.particleConstraints[index] = constraint;
        }

        // Treat the connected surface samples as particles in a tensioned
        // liquid skin. Each force defines positional constraints, while the
        // remaining samples follow their neighbours. Starting from the same
        // targets on every frame keeps the relaxation fully deterministic.
        const relaxationSteps = RELAXATION_STEPS
            + (rProgressTotal > 0.001
                ? Math.ceil(rProgressTotal) * 2
                : 0);
        for (let iteration = 0; iteration < relaxationSteps; iteration += 1) {
            for (let index = 0; index < positions.count; index += 1) {
                const neighbours = this.particleNeighbours[index];
                let averageX = 0;
                let averageY = 0;
                let averageZ = 0;

                for (let neighbourIndex = 0;
                    neighbourIndex < neighbours.length;
                    neighbourIndex += 1) {
                    const neighbourOffset = neighbours[neighbourIndex] * 3;
                    averageX += this.particlePositions[neighbourOffset];
                    averageY += this.particlePositions[neighbourOffset + 1];
                    averageZ += this.particlePositions[neighbourOffset + 2];
                }

                const inverseCount = 1 / neighbours.length;
                const offset = index * 3;
                const constraint = this.particleConstraints[index];
                const tension = SURFACE_TENSION * (1 - constraint * 0.72);
                const constraintCorrection = rProgressTotal > 0.001
                    ? constraint * 0.72
                    : 0.12 + constraint * 0.68;
                const tensionX = THREE.MathUtils.lerp(
                    this.particlePositions[offset],
                    averageX * inverseCount,
                    tension
                );
                const tensionY = THREE.MathUtils.lerp(
                    this.particlePositions[offset + 1],
                    averageY * inverseCount,
                    tension
                );
                const tensionZ = THREE.MathUtils.lerp(
                    this.particlePositions[offset + 2],
                    averageZ * inverseCount,
                    tension
                );

                const nextX = THREE.MathUtils.lerp(
                    tensionX,
                    this.particleTargets[offset],
                    constraintCorrection
                );
                const nextY = THREE.MathUtils.lerp(
                    tensionY,
                    this.particleTargets[offset + 1],
                    constraintCorrection
                );
                const nextZ = THREE.MathUtils.lerp(
                    tensionZ,
                    this.particleTargets[offset + 2],
                    constraintCorrection
                );

                this.particleNext[offset] = nextX;
                this.particleNext[offset + 1] = nextY;
                this.particleNext[offset + 2] = nextZ;
            }

            const swap = this.particlePositions;
            this.particlePositions = this.particleNext;
            this.particleNext = swap;

            // Incompressibility acts while each cumulative operation is still
            // present, so later stages reshape material created by M rather
            // than replacing it with a disconnected target form.
            if (iteration < relaxationSteps - 1) {
                const relaxedVolume = particleArrayVolume(
                    this.particlePositions,
                    this.geometry.index
                );
                const incompressibilityScale = Math.cbrt(
                    relaxationTargetVolume / relaxedVolume
                );
                for (let particleIndex = 0;
                    particleIndex < positions.count;
                    particleIndex += 1) {
                    const particleOffset = particleIndex * 3;
                    this.particlePositions[particleOffset]
                        *= incompressibilityScale;
                    this.particlePositions[particleOffset + 1]
                        *= incompressibilityScale;
                    this.particlePositions[particleOffset + 2]
                        *= incompressibilityScale;
                }
            }
        }

        for (let index = 0; index < positions.count; index += 1) {
            const offset = index * 3;
            positions.setXYZ(
                index,
                this.particlePositions[offset],
                this.particlePositions[offset + 1],
                this.particlePositions[offset + 2]
            );
        }

        const deformedVolume = geometryVolume(this.geometry);
        const provisionalParentVolume = Math.max(
            this.constantVolume * 0.000001,
            this.constantVolume - externalCVolume
        );
        const layOutDropletLevels = () => {
            let previousCentre = 0;
            let previousRadius = 0;
            let rootTerminalDistance = BASE_RADIUS;

            if (!this.primaryCSeparatesRoot) {
                rootTerminalDistance = 0;
                const rootAxis = this.axes[0];
                for (let index = 0; index < positions.count; index += 1) {
                    rootTerminalDistance = Math.max(
                        rootTerminalDistance,
                        positions.getX(index) * rootAxis.x
                            + positions.getY(index) * rootAxis.y
                            + positions.getZ(index) * rootAxis.z
                    );
                }
            }

            this.cLevels.forEach(level => {
                const scale = level.currentScale ?? 0;
                const radius = (
                    level.sphereGeometry.boundingSphere?.radius
                        ?? level.radius
                ) * scale;
                const separation = 0.026 * Math.pow(0.62, level.level);
                const centreDistance = level.level === 0
                    ? this.primaryCSeparatesRoot
                        ? 0.43 * primaryCProgress
                        : rootTerminalDistance
                            + radius
                            + separation * primaryCProgress
                    : previousCentre + previousRadius + radius + separation;

                level.layout = {
                    progress: scale,
                    radius,
                    centreDistance
                };
                previousCentre = centreDistance;
                previousRadius = radius;
            });
        };

        const parentTargetVolume = Math.max(
            this.constantVolume * 0.000001,
            provisionalParentVolume
        );
        const volumeScale = Math.cbrt(parentTargetVolume / deformedVolume);
        for (let index = 0; index < positions.count; index += 1) {
            positions.setXYZ(
                index,
                positions.getX(index) * volumeScale,
                positions.getY(index) * volumeScale,
                positions.getZ(index) * volumeScale
            );
        }

        positions.needsUpdate = true;
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingSphere();

        layOutDropletLevels();
        this.cLevels.forEach(level => {
            if ((level.currentTargetVolume ?? 0) <= 0) return;
            const pairDistance = level.layout.centreDistance
                * Math.sqrt(8 / 3);
            const contactRadius = level.radius
                * level.layout.progress;
            if (pairDistance > contactRadius * 2 + 0.008) return;

            const singleMeniscusVolume = updateContactMeniscusGeometry(
                level.contactMeniscusGeometry,
                contactRadius,
                pairDistance
            );
            const levelTargetVolume = level.currentTargetVolume
                * this.axes.length;
            const sphereVolumeTarget = Math.max(
                levelTargetVolume
                    - singleMeniscusVolume
                        * level.contactMenisci.length,
                levelTargetVolume * 0.82
            );
            level.currentScale *= Math.cbrt(
                sphereVolumeTarget / levelTargetVolume
            );
        });
        layOutDropletLevels();
        this.cLevels.forEach(level => {
            level.components.forEach(({ axis, sphere }) => {
                sphere.scale.setScalar(Math.max(
                    0.001,
                    level.layout.progress
                ));
                sphere.position.copy(this.object.position).addScaledVector(
                    axis,
                    level.layout.centreDistance
                );
            });
            const firstContact = level.contactMenisci[0];
            const firstSphere = level.components[
                firstContact?.first ?? 0
            ]?.sphere;
            const secondSphere = level.components[
                firstContact?.second ?? 0
            ]?.sphere;
            const pairDistance = firstSphere && secondSphere
                ? firstSphere.position.distanceTo(secondSphere.position)
                : Infinity;
            const contactRadius = level.radius
                * level.layout.progress;
            const touching = level.layout.progress > 0.01
                && pairDistance <= contactRadius * 2 + 0.008;

            if (touching) {
                updateContactMeniscusGeometry(
                    level.contactMeniscusGeometry,
                    contactRadius,
                    pairDistance
                );
            }
            level.contactMenisci.forEach(contact => {
                const firstPosition = level.components[
                    contact.first
                ].sphere.position;
                const secondPosition = level.components[
                    contact.second
                ].sphere.position;
                const contactDirection = secondPosition.clone()
                    .sub(firstPosition)
                    .normalize();
                contact.mesh.position.copy(firstPosition);
                contact.mesh.quaternion.setFromUnitVectors(
                    new THREE.Vector3(0, 0, 1),
                    contactDirection
                );
                contact.mesh.visible = touching;
            });
        });
        this.object.visible = this.cLevels.length === 0
            || !this.primaryCSeparatesRoot
            || primaryCProgress < 0.999;
    }

    enableWordLabel() {
        if (!this.wordLabel) {
            this.wordLabel = createLabel(this.scene, this.name);
            this.updateWordLabel();
        }
    }

    setLabelSuppressed(suppressed) {
        this.labelSuppressed = suppressed;
        this.updateWordLabel();
    }

    setTheme(theme) {
        this.theme = theme;
        this.agedColour.set(theme.agedPath);
        this.updateAppearance();
    }

    increaseEntropy() {
        this.entropy = 1 - (1 - this.entropy) * (1 - ENTROPY_STEP);
        this.updateAppearance();
    }

    ageToMaximumEntropy() { this.entropy = 1; this.updateAppearance(); }
    recoverVitality() { this.entropy = 0; this.updateAppearance(); }
    setLocked(locked) {
        this.locked = locked;
        if (locked) {
            this.setSelected(false);
            this.setHovered(false);
        }
    }

    setUniverseVisible(active) {
        this.inactiveUniverse = !active;
        this.updateAppearance();
    }

    setSelected(selected) {
        this.selected = selected;
        this.updateAppearance();
    }

    setHovered(hovered) {
        this.hovered = hovered;
        this.updateAppearance();
    }

    updateAppearance() {
        const displayedEntropy = this.selected ? 0 : this.entropy;
        const colour = this.identityColour.clone().lerp(this.agedColour, displayedEntropy * 0.58);
        this.material.color.copy(colour);
        this.material.roughness = this.selected
            ? 0.006
            : this.hovered ? 0.012 : 0.018;
        this.material.envMapIntensity = this.selected
            ? 3
            : this.hovered ? 2.7 : 2.45;
        this.material.transparent = this.inactiveUniverse;
        this.material.opacity = this.inactiveUniverse ? INACTIVE_OPACITY : 1;
        this.material.depthWrite = !this.inactiveUniverse;
        this.updateWordLabel();
    }

    updateWordLabel() {
        if (!this.wordLabel) return;
        const visible = !this.inactiveUniverse
            && (this.selected || (this.hovered && !this.labelSuppressed));
        this.wordLabel.mesh.visible = visible;
        this.wordLabel.material.opacity = visible ? 0.94 : 0;
        this.wordLabel.mesh.position.copy(this.object.position).add(new THREE.Vector3(0, 1.05, 0));
        drawLabel(this.wordLabel, this.selected ? "#ffffff" : "#e2e6e9");
    }

    update(delta) {
        if (this.formation < 1) {
            this.formation = Math.min(1, this.formation + delta / FORMATION_SECONDS);
            this.applyDeformations(this.formation);
        }
        this.updateWordLabel();
    }

    getPickableObjects() {
        return this.locked || this.inactiveUniverse
            ? []
            : [
                this.object,
                ...this.cSpheres.map(component => component.sphere),
                ...this.cContactMenisci.map(contact => contact.mesh),
                this.pickProxy
            ];
    }

    getFocusTarget() { return this.object.position.clone(); }

    getFocusRadius() {
        const parentRadius = this.geometry.boundingSphere?.radius ?? PICK_RADIUS;
        const cRadius = this.cSpheres.reduce((maximum, { sphere }) => (
            Math.max(
                maximum,
                sphere.position.distanceTo(this.object.position)
                    + (sphere.geometry.boundingSphere?.radius ?? 0)
                        * sphere.scale.x
            )
        ), 0);
        return Math.max(1, parentRadius, cRadius);
    }

    getHistoryColour(highlighted = false) {
        const colour = highlighted
            ? WHITE
            : this.identityColour.clone().lerp(this.agedColour, this.entropy * 0.58);
        return `#${colour.getHexString()}`;
    }

    getIdentityColour() { return `#${this.identityColour.getHexString()}`; }

    dispose() {
        this.scene.remove(
            this.object,
            this.pickProxy,
            ...this.cSpheres.map(component => component.sphere),
            ...this.cContactMenisci.map(contact => contact.mesh)
        );
        this.geometry.dispose();
        this.cLevels.forEach(level => {
            level.sphereGeometry.dispose();
            level.contactMeniscusGeometry.dispose();
        });
        this.material.dispose();
        this.pickProxy.geometry.dispose();
        this.pickProxy.material.dispose();
        if (this.wordLabel) {
            this.scene.remove(this.wordLabel.mesh);
            this.wordLabel.texture.dispose();
            this.wordLabel.material.dispose();
        }
    }
}
