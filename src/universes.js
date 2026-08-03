import * as THREE from "three";

import {
    COORDINATE_SCALE,
    GORDON_NAME,
    GORDON_PATTERN,
    GORDON_VECTORS,
    GORDON_THEME,
    GERALD_LOW_PASS_SWEEP_RATES,
    GERALD_FREQUENCIES,
    GERALD_NAME,
    GERALD_PATTERN,
    GERALD_THEME,
    GERALD_VECTORS,
    MARTIN_NAME,
    MARTIN_PATTERN,
    MARTIN_THEME,
    MARTIN_VECTORS,
    MARCUS_THEME,
    MARCUS_VECTORS,
    RODNEY_NAME,
    RODNEY_PATTERN,
    RODNEY_THEME,
    RODNEY_VECTORS,
    RONALD_PATTERN,
    RONALD_TEMPLATE,
    THEMES,
    VECTORS
} from "./constants.js";

const RODNEY_TEMPLATE = ["RNDY", "O", "RNDY", "RNDY", "E", "RNDY"];
const RODNEY_VARIATION_PATTERN = /^[RNDY]O[RNDY][RNDY]E[RNDY]$/;
const MARTIN_TEMPLATE = ["MRTN", "A", "MRTN", "MRTN", "I", "MRTN"];
const MARTIN_VARIATION_PATTERN = /^[MRTN]A[MRTN][MRTN]I[MRTN]$/;
const GORDON_TEMPLATE = ["GRDN", "O", "GRDN", "GRDN", "O", "GRDN"];
const GORDON_VARIATION_PATTERN = /^[GRDN]O[GRDN][GRDN]O[GRDN]$/;
const GERALD_TEMPLATE = ["GRLD", "E", "GRLD", "A", "GRLD", "GRLD"];
const GERALD_VARIATION_PATTERN = /^[GRLD]E[GRLD]A[GRLD][GRLD]$/;
const MARCUS_TEMPLATE = ["MRCS", "A", "MRCS", "MRCS", "U", "MRCS"];
const MARCUS_VARIATION_PATTERN = /^[MRCS]A[MRCS][MRCS]U[MRCS]$/;

function matchesTemplatePrefix(name, template) {
    return [...name].every((letter, index) => template[index]?.includes(letter));
}

function enumerateTemplate(template) {
    return template.reduce(
        (names, choices) => names.flatMap(name => [...choices].map(letter => `${name}${letter}`)),
        [""]
    );
}

function coloursForRodney(name, theme) {
    const lineage = [name[0], name[2], name[3], name[5]];
    const letterIndex = { R: 0, N: 1, Y: 2, D: 3 };
    const [origin, branch, turn, ending] = lineage.map(letter => letterIndex[letter]);
    const originHues = [0.0, 0.13, 0.56, 0.82];
    const branchOffsets = [-0.052, -0.017, 0.017, 0.052];
    const turnOffsets = [-0.025, -0.008, 0.008, 0.025];
    const endingOffsets = [-0.012, -0.004, 0.004, 0.012];
    const lineageCode = origin * 64 + branch * 16 + turn * 4 + ending;
    const hue = THREE.MathUtils.euclideanModulo(
        originHues[origin] + branchOffsets[branch] + turnOffsets[turn] + endingOffsets[ending],
        1
    );
    const saturation = 0.68 + ((lineageCode % 5) * 0.055);
    const lightness = THREE.MathUtils.clamp(
        theme.identityLightness - 0.12 + (Math.floor(lineageCode / 5) % 5) * 0.035,
        0.3,
        0.55
    );

    return new THREE.Color().setHSL(hue, saturation, lightness);
}

function coloursForMartin(name, theme) {
    const lineage = [name[0], name[2], name[3], name[5]];
    const letterIndex = { M: 0, R: 1, T: 2, N: 3 };
    const [anchor, shape, planeX, planeY] = lineage.map(letter => letterIndex[letter]);
    // Martin lineages borrow their identity from astronomical bodies: gold
    // G-stars, red giants, blue-white dwarfs, and violet nebulae.
    const anchorHues = [0.13, 0.01, 0.59, 0.78];
    const anchorSaturations = [0.9, 0.78, 0.64, 0.76];
    const lineageCode = anchor * 64 + shape * 16 + planeX * 4 + planeY;
    const hue = THREE.MathUtils.euclideanModulo(
        anchorHues[anchor]
            + (shape - 1.5) * 0.032
            + (planeX - 1.5) * 0.019
            + (planeY - 1.5) * 0.011,
        1
    );
    const saturation = THREE.MathUtils.clamp(
        anchorSaturations[anchor] + ((lineageCode % 5) - 2) * 0.04,
        0.5,
        0.98
    );
    const lightness = THREE.MathUtils.clamp(
        theme.identityLightness - 0.12 + (Math.floor(lineageCode / 5) % 5) * 0.047,
        0.44,
        0.78
    );

    return new THREE.Color().setHSL(hue, saturation, lightness);
}

function colourForRonald(name, theme) {
    let hash = 0;

    for (const letter of name) {
        hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
    }

    return new THREE.Color().setHSL((hash % 360) / 360, 0.66, theme.identityLightness);
}

function createRonaldControlPoints(name, vectors) {
    const letters = [name[0], name[2], name[4], name[5]];
    const points = [new THREE.Vector3()];
    let current = new THREE.Vector3();

    letters.forEach(letter => {
        current = current.clone().add(vectors[letter].clone().multiplyScalar(COORDINATE_SCALE));
        points.push(current.clone());
    });

    return points;
}

function createRodneyControlPoints(name, vectors) {
    const letters = [name[0], name[2], name[3], name[5]];
    const radius = COORDINATE_SCALE * 4;
    const start = vectors[letters[0]].clone().multiplyScalar(radius);
    const centre = new THREE.Vector3();
    const points = [start.clone()];
    const stepLength = start.length() / 4;
    let current = start.clone();

    letters.forEach(letter => {
        // The first/origin letter is also a move towards centre. Every other
        // letter means "towards that letter's outer origin node".
        const target = letter === letters[0]
            ? centre
            : vectors[letter].clone().multiplyScalar(radius);
        const direction = target.sub(current);

        if (direction.lengthSq() > 0) {
            current = current.clone().add(direction.normalize().multiplyScalar(stepLength));
        }
        points.push(current.clone());
    });

    return points;
}

function createMartinControlPoints(name) {
    const letters = [name[0], name[2], name[3], name[5]];
    const letterIndex = { M: 0, R: 1, T: 2, N: 3 };
    const [, shapeIndex, planeXIndex, planeYIndex] = letters
        .map(letter => letterIndex[letter]);
    const planeXAngle = planeXIndex * (Math.PI / 3);
    const planeYAngle = planeYIndex * (Math.PI / 3);
    const endpoint = letters.reduce(
        (point, letter) => point.add(
            MARTIN_VECTORS[letter].clone().multiplyScalar(COORDINATE_SCALE)
        ),
        new THREE.Vector3()
    );
    const endpointIsOrigin = endpoint.lengthSq() < 0.000001;
    const semiMajorAxis = endpointIsOrigin
        ? COORDINATE_SCALE * 3
        : endpoint.length();
    const shapeRatio = [1, 0.88, 0.7, 0.52][shapeIndex];
    const semiMinorAxis = semiMajorAxis * (endpointIsOrigin ? 1 : shapeRatio);
    const radialBasis = endpointIsOrigin
        ? MARTIN_VECTORS[letters[0]].clone().normalize()
        : endpoint.normalize();
    const orientationSeed = new THREE.Vector3(0, 1, 0)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), planeXAngle)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), planeYAngle);
    let tangentBasis = orientationSeed.addScaledVector(
        radialBasis,
        -orientationSeed.dot(radialBasis)
    );

    if (tangentBasis.lengthSq() < 0.000001) {
        tangentBasis = new THREE.Vector3(0, 0, 1).addScaledVector(
            radialBasis,
            -radialBasis.z
        );
    }
    if (tangentBasis.lengthSq() < 0.000001) {
        tangentBasis = new THREE.Vector3(1, 0, 0).addScaledVector(
            radialBasis,
            -radialBasis.x
        );
    }
    tangentBasis.normalize();
    const sampleCount = 96;
    const points = [];

    for (let step = 0; step < sampleCount; step += 1) {
        const angle = (step / sampleCount) * Math.PI * 2;
        // A Martin's normal endpoint is its first orbital point. The origin
        // endpoint is the sole exception: it becomes a canonical circle
        // around the centre, since a non-zero ellipse cannot pass through its
        // own centre while orbiting it.
        const orbital = radialBasis.clone().multiplyScalar(
            semiMajorAxis * Math.cos(angle)
        ).addScaledVector(tangentBasis, semiMinorAxis * Math.sin(angle));
        points.push(orbital);
    }

    return points;
}

const GERALD_AXES = [
    GERALD_VECTORS.G.clone().normalize(),
    GERALD_VECTORS.R.clone().normalize(),
    GERALD_VECTORS.L.clone().normalize(),
    GERALD_VECTORS.D.clone().normalize()
];

export function geraldWaveValue(waveform, phase) {
    const wrapped = THREE.MathUtils.euclideanModulo(phase, 1);
    if (waveform === 0) return Math.sin(wrapped * Math.PI * 2);
    if (waveform === 1) return 2 * wrapped - 1;
    if (waveform === 2) return wrapped < 0.5 ? 1 : -1;
    return 1 - 4 * Math.abs(wrapped - 0.5);
}

function geraldCrownForName(name) {
    const parameters = [name[0], name[2], name[4], name[5]]
        .map(letter => "GRLD".indexOf(letter));
    const [axisIndex, noteIndex, radiusIndex, sweepIndex] = parameters;
    const axis = GERALD_AXES[axisIndex].clone();
    const waveform = axisIndex;
    const axialPositions = [2.4, 7.2, 12, 16.8];
    const displacement = axialPositions[noteIndex];
    // These are the four visible concentric sleeves for each Letter-axis.
    const radius = [1.5, 4.1, 6.7, 9.3][radiusIndex];
    // Integer lobe counts keep every recipe a complete loop while making the
    // final letter visibly distinct even when the first three slots overlap.
    const cycles = [3, 5, 7, 9][sweepIndex];
    const angularSignature = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2][sweepIndex];
    const centre = axis.clone().multiplyScalar(displacement);
    const reference = Math.abs(axis.y) < 0.88
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    const basisU = new THREE.Vector3().crossVectors(axis, reference).normalize();
    const basisV = new THREE.Vector3().crossVectors(axis, basisU).normalize();
    const points = [];
    const samples = 192;
    const amplitude = 1.26;

    // The resting crown is the Gerald's frozen recipe: one readable base
    // waveform, with its lobe/radius/axis choices providing the identity.
    // The time-varying chorus wave is applied only when attentive.
    for (let step = 0; step < samples; step += 1) {
        const progress = step / samples;
        const angle = progress * Math.PI * 2 + angularSignature;
        const waveDeflection = amplitude * geraldWaveValue(
            waveform,
            progress * cycles
        );
        points.push(
            centre.clone()
                .addScaledVector(basisU, Math.cos(angle) * radius)
                .addScaledVector(basisV, Math.sin(angle) * radius)
                .addScaledVector(axis, waveDeflection)
        );
    }

    return {
        axis,
        viewDirection: basisU,
        centre,
        radius,
        cycles,
        waveform,
        noteIndex,
        frequency: GERALD_FREQUENCIES[noteIndex],
        chorusNotes: 3 - radiusIndex,
        sweepRate: GERALD_LOW_PASS_SWEEP_RATES[sweepIndex],
        points
    };
}

function createGeraldControlPoints(name) {
    return geraldCrownForName(name).points;
}

function normaliseRonaldBuilder(name) {
    let nextName = name;

    if (nextName.slice(0, 4) !== "RODN") {
        nextName = `${nextName.slice(0, 3)}A${nextName[4] === "E" ? "L" : nextName[4]}${nextName[5] === "Y" ? "D" : nextName[5]}`;
    }
    if (nextName.slice(0, 5) !== "RODNE" && nextName[5] === "Y") {
        nextName = `${nextName.slice(0, 5)}D`;
    }

    return nextName;
}

function normaliseTemplateName(name, template) {
    return [...name].map((letter, index) => (
        template[index].includes(letter) ? letter : template[index][0]
    )).join("");
}

function normaliseRodneyBuilder(name) {
    if (name[0] !== "M") {
        return normaliseTemplateName(name, RODNEY_TEMPLATE);
    }

    // The I slot is a later discovery: it only exists after MART has been
    // assembled. Moving away from that prefix restores the Rodney vowel.
    return name.slice(0, 4) === "MART"
        ? name
        : `${name.slice(0, 4)}E${name.slice(5)}`;
}

function normaliseMartinBuilder(name) {
    if (name[0] !== "G") {
        return normaliseTemplateName(name, MARTIN_TEMPLATE);
    }

    // Likewise, the second GORDON vowel is only exposed once GORD exists.
    return name.slice(0, 4) === "GORD"
        ? name
        : `${name.slice(0, 4)}I${name.slice(5)}`;
}

function normaliseGordonBuilder(name) {
    if (name[1] !== "E") {
        return normaliseTemplateName(name, GORDON_TEMPLATE);
    }

    // GORDON and GERALD share their opening G and R, so the first sign of the
    // next universe is the normally fixed vowel. Once E is exposed, keep the
    // builder on the single progressive route GERDON → GERAON → GERALN →
    // GERALD while leaving each newly meaningful slot under viewer control.
    const fourth = name[3] === "A" ? "A" : "D";
    const fifth = fourth === "A" && name[4] === "L" ? "L" : "O";
    const sixth = "GRLD".includes(name[5]) ? name[5] : "N";
    return `GER${fourth}${fifth}${sixth}`;
}

export const UNIVERSES = {
    ronald: {
        id: "ronald",
        noun: "RONALD",
        plural: "RONALDS",
        layerLabel: "RONALD",
        revealLabel: "Unveil all RONALDS",
        vectors: VECTORS,
        allNames: enumerateTemplate(RONALD_TEMPLATE),
        template: RONALD_TEMPLATE,
        initialBuilderName: "RONALD",
        demoName: "RONALD",
        transition: { name: RODNEY_NAME, to: "rodney", id: "rodney-incursion" },
        isValidPrefix(name) {
            return RODNEY_NAME.startsWith(name) || matchesTemplatePrefix(name, RONALD_TEMPLATE);
        },
        isValidName(name) {
            return RONALD_PATTERN.test(name) || RODNEY_PATTERN.test(name);
        },
        isGeneratedName(name) {
            return RONALD_PATTERN.test(name);
        },
        builder: {
            normalise: normaliseRonaldBuilder,
            choices(name, index) {
                if (index === 3) return name.slice(0, 3) === "ROD" ? "AN" : "A";
                if (index === 4) return name.slice(0, 4) === "RODN" ? "LDE" : "RNLD";
                if (index === 5) return name.slice(0, 5) === "RODNE" ? "RNDLY" : "RNLD";
                return RONALD_TEMPLATE[index];
            },
            indices(name) {
                return name.slice(0, 3) === "ROD" ? [0, 2, 3, 4, 5] : [0, 2, 4, 5];
            },
            controlVisible(name, index) {
                if (index === 1) return false;
                return index !== 3 || name.slice(0, 3) === "ROD";
            }
        },
        themeFor(themeName) {
            return THEMES[themeName];
        },
        createControlPoints(name) {
            return createRonaldControlPoints(name, VECTORS);
        },
        colourForName: colourForRonald
    },
    rodney: {
        id: "rodney",
        noun: "RODNEY",
        plural: "RODNEYS",
        layerLabel: "RODNEY",
        revealLabel: "Reveal entire RODNEYverse",
        vectors: RODNEY_VECTORS,
        allNames: enumerateTemplate(RODNEY_TEMPLATE),
        template: RODNEY_TEMPLATE,
        initialBuilderName: "RODNEY",
        transition: { name: MARTIN_NAME, to: "martin", id: "martin-discovery" },
        isValidPrefix(name) {
            return MARTIN_NAME.startsWith(name) || matchesTemplatePrefix(name, RODNEY_TEMPLATE);
        },
        isValidName(name) {
            return RODNEY_VARIATION_PATTERN.test(name) || MARTIN_PATTERN.test(name);
        },
        isGeneratedName(name) {
            return RODNEY_VARIATION_PATTERN.test(name);
        },
        builder: {
            normalise(name) {
                return normaliseRodneyBuilder(name);
            },
            choices(name, index) {
                if (index === 1) return name[0] === "M" ? "OA" : "O";
                if (index === 4) return name[0] === "M" ? "EI" : "E";
                return [...new Set(`${RODNEY_TEMPLATE[index]}${MARTIN_NAME[index]}`)].join("");
            },
            indices(name) {
                return [0, 2, 3, 5].concat(
                    name[0] === "M" ? [1] : [],
                    name.slice(0, 4) === "MART" ? [4] : []
                ).sort((left, right) => left - right);
            },
            controlVisible(name, index) {
                if (index === 1) return name[0] === "M";
                if (index === 4) return name.slice(0, 4) === "MART";
                return true;
            }
        },
        themeFor() {
            return RODNEY_THEME;
        },
        createControlPoints(name) {
            return createRodneyControlPoints(name, RODNEY_VECTORS);
        },
        colourForName: coloursForRodney
    },
    martin: {
        id: "martin",
        noun: "MARTIN",
        plural: "MARTINs",
        layerLabel: "MARTIN",
        revealLabel: "Release all MARTINs",
        vectors: MARTIN_VECTORS,
        allNames: enumerateTemplate(MARTIN_TEMPLATE),
        template: MARTIN_TEMPLATE,
        initialBuilderName: "MARTIN",
        closedPath: true,
        transition: { name: GORDON_NAME, to: "gordon", id: "gordon-discovery" },
        isValidPrefix(name) {
            return GORDON_NAME.startsWith(name) || matchesTemplatePrefix(name, MARTIN_TEMPLATE);
        },
        isValidName(name) {
            return MARTIN_VARIATION_PATTERN.test(name) || GORDON_PATTERN.test(name);
        },
        isGeneratedName(name) {
            return MARTIN_VARIATION_PATTERN.test(name);
        },
        builder: {
            normalise(name) {
                return normaliseMartinBuilder(name);
            },
            choices(name, index) {
                if (index === 1) return name[0] === "G" ? "AO" : "A";
                if (index === 4) return name[0] === "G" ? "IO" : "I";
                return [...new Set(`${MARTIN_TEMPLATE[index]}${GORDON_NAME[index]}`)].join("");
            },
            indices(name) {
                return [0, 2, 3, 5].concat(
                    name[0] === "G" ? [1] : [],
                    name.slice(0, 4) === "GORD" ? [4] : []
                ).sort((left, right) => left - right);
            },
            controlVisible(name, index) {
                if (index === 1) return name[0] === "G";
                if (index === 4) return name.slice(0, 4) === "GORD";
                return true;
            }
        },
        themeFor() {
            return MARTIN_THEME;
        },
        createControlPoints(name) {
            return createMartinControlPoints(name);
        },
        colourForName: coloursForMartin
    },
    gordon: {
        id: "gordon",
        noun: "GORDON",
        plural: "GORDONs",
        layerLabel: "GORDON",
        revealLabel: "Materialise all GORDONs",
        vectors: GORDON_VECTORS,
        allNames: enumerateTemplate(GORDON_TEMPLATE),
        template: GORDON_TEMPLATE,
        initialBuilderName: "GORDON",
        objectGenerator: true,
        transition: { name: GERALD_NAME, to: "gerald", id: "gerald-discovery" },
        isValidPrefix(name) {
            return GERALD_NAME.startsWith(name)
                || matchesTemplatePrefix(name, GORDON_TEMPLATE);
        },
        isValidName(name) {
            return GORDON_VARIATION_PATTERN.test(name)
                || GERALD_PATTERN.test(name);
        },
        isGeneratedName(name) {
            return GORDON_VARIATION_PATTERN.test(name);
        },
        builder: {
            normalise: normaliseGordonBuilder,
            choices(name, index) {
                if (index === 0) return "G";
                if (index === 1) return "OE";
                if (index === 2) return name[1] === "E" ? "R" : GORDON_TEMPLATE[index];
                if (index === 3) return name.slice(0, 3) === "GER" ? "GRDNA" : GORDON_TEMPLATE[index];
                if (index === 4) return name.slice(0, 4) === "GERA" ? "OL" : "O";
                return name[1] === "E" ? "NGRLD" : GORDON_TEMPLATE[index];
            },
            indices(name) {
                return [0, 1, 2, 3, 5].concat(
                    name.slice(0, 4) === "GERA" ? [4] : []
                ).sort((left, right) => left - right);
            },
            controlVisible(name, index) {
                if (name[0] === "M") return index !== 1 && index !== 4;
                if (index === 1) return true;
                if (index === 4) return name.slice(0, 4) === "GERA";
                return true;
            }
        },
        themeFor() { return GORDON_THEME; },
        colourForName(name, theme) {
            const parameters = [name[0], name[2], name[3], name[5]]
                .map(letter => "GRDN".indexOf(letter));
            const code = parameters.reduce((value, parameter) => value * 4 + parameter, 0);
            const gemstones = [
                "#e6003b", "#ff1764", "#12d995", "#d4003f",
                "#146cff", "#7a27eb", "#ffac16", "#b9edff"
            ]
                .map(value => new THREE.Color(value));
            const colour = gemstones[code % gemstones.length].clone();

            // Keep the mineral hue clean and saturated. The four parameters
            // make a repeatable, small cut-to-cut shift without ever mixing
            // opposing gem colours into a pastel.
            const signedVariation = parameters.reduce(
                (total, parameter, index) => total + (parameter - 1.5) * (index + 1),
                0
            );
            return colour.offsetHSL(
                signedVariation * 0.0025,
                0.025,
                ((parameters[0] + parameters[3]) - 3) * 0.012
            );
        }
    },
    gerald: {
        id: "gerald",
        noun: "GERALD",
        plural: "GERALDs",
        layerLabel: "GERALD",
        revealLabel: "- Unleash GERALD",
        vectors: GERALD_VECTORS,
        allNames: enumerateTemplate(GERALD_TEMPLATE),
        template: GERALD_TEMPLATE,
        initialBuilderName: "GERALD",
        closedPath: true,
        isValidPrefix(name) { return matchesTemplatePrefix(name, GERALD_TEMPLATE); },
        isValidName(name) { return GERALD_VARIATION_PATTERN.test(name); },
        isGeneratedName(name) { return GERALD_VARIATION_PATTERN.test(name); },
        builder: {
            normalise(name) { return normaliseTemplateName(name, GERALD_TEMPLATE); },
            choices(name, index) { return GERALD_TEMPLATE[index]; },
            indices() { return [0, 2, 4, 5]; },
            controlVisible(name, index) { return index !== 1 && index !== 3; }
        },
        themeFor() { return GERALD_THEME; },
        crownForName: geraldCrownForName,
        createControlPoints: createGeraldControlPoints,
        colourForName(name) {
            const parameters = [name[0], name[2], name[4], name[5]]
                .map(letter => "GRLD".indexOf(letter));
            const code = parameters.reduce((value, parameter) => value * 4 + parameter, 0);
            const palette = [
                "#03050b", "#06122e", "#0a2e73", "#0000ff",
                "#2f67ff", "#6f9fff", "#b6d1ff", "#f1f7ff"
            ];
            return new THREE.Color(palette[code % palette.length]).offsetHSL(
                0,
                ((Math.floor(code / 17) % 5) - 2) * 0.018,
                ((Math.floor(code / 7) % 5) - 2) * 0.012
            );
        }
    },
    marcus: {
        id: "marcus",
        noun: "MARCUS",
        plural: "MARCUSes",
        layerLabel: "MARCUS",
        revealLabel: "- ennumerate MARCUSes",
        vectors: MARCUS_VECTORS,
        allNames: enumerateTemplate(MARCUS_TEMPLATE),
        template: MARCUS_TEMPLATE,
        initialBuilderName: "MARCUS",
        objectGenerator: "marcus",
        isValidPrefix(name) { return matchesTemplatePrefix(name, MARCUS_TEMPLATE); },
        isValidName(name) { return MARCUS_VARIATION_PATTERN.test(name); },
        isGeneratedName(name) { return MARCUS_VARIATION_PATTERN.test(name); },
        builder: {
            normalise(name) { return normaliseTemplateName(name, MARCUS_TEMPLATE); },
            choices(name, index) { return MARCUS_TEMPLATE[index]; },
            indices() { return [0, 2, 3, 5]; },
            controlVisible(name, index) { return index !== 1 && index !== 4; }
        },
        themeFor() { return MARCUS_THEME; },
        colourForName() { return new THREE.Color(0xd8dde2); }
    }
};

export function getUniverse(id) {
    const universe = UNIVERSES[id];

    if (!universe) {
        throw new Error(`Unknown universe: ${id}`);
    }

    return universe;
}
