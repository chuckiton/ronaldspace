const LETTERS = ["F", "N", "L", "Y"];
const FORM_NAMES = ["faceted ring", "cross", "cleft", "staff"];
const ACTION_NAMES = ["truncate", "graft", "orientation", "bar"];
const MARK_NAMES = ["arc", "saltire", "wedge", "score"];
const CADENCE_NAMES = ["taut", "bowed", "counter-bowed", "inflected"];
const DIRECTION_NAMES = ["upper-right edge", "base edge", "upper-left edge"];
const VARIABLE_POSITIONS = [1, 3, 4, 6];
const DIRECTIONS = [[.9635, -.2676], [0, 1], [-.9635, -.2676]];
const GATES = [[310, 195], [220, 355], [130, 195]];
const TRIANGLE = [[220, 35], [400, 355], [40, 355]];
const PHASES = [[0, .34], [.34, .58], [.58, .76], [.76, 1]];
const STONE_FREQUENCY = 20;
const STONE_BEVEL_RADIUS = .18;
const STONE_BEVEL_BAND = .15;
const STONE_DISTRIBUTION_POWER = 2.25;
const DISTRIBUTION_POWER = 1.24;
const TETRA_POLES = [
	[0, 1, 0],
	[0, -1 / 3, 2 * Math.sqrt(2) / 3],
	[-Math.sqrt(6) / 3, -1 / 3, -Math.sqrt(2) / 3],
	[Math.sqrt(6) / 3, -1 / 3, -Math.sqrt(2) / 3]
].map(vector => {
	const length = Math.hypot(...vector);
	return vector.map(value => value / length);
});

function grayCode(length) {
	if (length === 0) return [[]];
	const previous = grayCode(length - 1);
	return LETTERS.flatMap((letter, index) => {
		const block = index % 2 ? [...previous].reverse() : previous;
		return block.map(suffix => [letter, ...suffix]);
	});
}

function normalise3(vector) {
	const length = Math.hypot(...vector);
	return vector.map(value => value / length);
}

function cross3(first, second) {
	return [
		first[1] * second[2] - first[2] * second[1],
		first[2] * second[0] - first[0] * second[2],
		first[0] * second[1] - first[1] * second[0]
	];
}

function dot3(first, second) {
	return first.reduce((sum, value, index) => sum + value * second[index], 0);
}

function tetrahedralMesh(frequency) {
	const roots = [[1, 2, 3], [0, 3, 2], [0, 1, 3], [0, 2, 1]];
	const vertexIndex = new Map();
	const vertices = [];
	const tetraVertices = [];
	const vertexWeights = [];
	const faces = [];
	const getVertex = weights => {
		const key = weights.join(",");
		if (vertexIndex.has(key)) return vertexIndex.get(key);
		const position = [0, 1, 2].map(axis =>
			weights.reduce((sum, weight, pole) => sum + weight * TETRA_POLES[pole][axis], 0) / frequency
		);
		const index = vertices.length;
		vertexIndex.set(key, index);
		vertices.push(normalise3(position));
		tetraVertices.push(position);
		vertexWeights.push([...weights]);
		return index;
	};
	const addFace = (indices, owner) => {
		const [first, second, third] = indices.map(index => vertices[index]);
		const ab = second.map((value, axis) => value - first[axis]);
		const ac = third.map((value, axis) => value - first[axis]);
		const normal = [
			ab[1] * ac[2] - ab[2] * ac[1],
			ab[2] * ac[0] - ab[0] * ac[2],
			ab[0] * ac[1] - ab[1] * ac[0]
		];
		const centre = first.map((value, axis) => value + second[axis] + third[axis]);
		if (normal.reduce((sum, value, axis) => sum + value * centre[axis], 0) < 0) {
			[indices[1], indices[2]] = [indices[2], indices[1]];
		}
		faces.push({ vertices: indices, owner, neighbours: [-1, -1, -1] });
	};

	roots.forEach((root, owner) => {
		const point = (first, second) => {
			const weights = [0, 0, 0, 0];
			weights[root[0]] = frequency - first - second;
			weights[root[1]] = first;
			weights[root[2]] = second;
			return getVertex(weights);
		};
		for (let first = 0; first < frequency; first += 1) {
			for (let second = 0; second < frequency - first; second += 1) {
				addFace([point(first, second), point(first + 1, second), point(first, second + 1)], owner);
			}
		}
		for (let first = 0; first < frequency - 1; first += 1) {
			for (let second = 0; second < frequency - 1 - first; second += 1) {
				addFace([point(first + 1, second), point(first + 1, second + 1), point(first, second + 1)], owner);
			}
		}
	});

	const edgeMap = new Map();
	const edges = [];
	const edgeFaces = [];
	faces.forEach((face, faceIndex) => {
		face.vertices.forEach((vertex, edgeIndex) => {
			const other = face.vertices[(edgeIndex + 1) % 3];
			const key = vertex < other ? `${vertex},${other}` : `${other},${vertex}`;
			if (!edgeMap.has(key)) {
				edgeMap.set(key, { faceIndex, edgeIndex, vertices: [vertex, other] });
				return;
			}
			const first = edgeMap.get(key);
			faces[faceIndex].neighbours[edgeIndex] = first.faceIndex;
			faces[first.faceIndex].neighbours[first.edgeIndex] = faceIndex;
			edges.push(first.vertices);
			edgeFaces.push([first.faceIndex, faceIndex]);
		});
	});
	const coarseEdges = edges
		.map((edge, edgeIndex) => ({ edge, faces: edgeFaces[edgeIndex] }))
		.filter(({ edge }) => {
			const poles = new Set();
			edge.forEach(vertex => {
				vertexWeights[vertex].forEach((weight, pole) => {
					if (weight > 0) poles.add(pole);
				});
			});
			return poles.size === 2;
		});
	return {
		frequency,
		vertices,
		tetraVertices,
		vertexWeights,
		faces,
		edges,
		edgeFaces,
		coarseEdges,
		roots
	};
}

const BASE_SAGA = grayCode(4);
const TETRA_MESH = tetrahedralMesh(8);
const STONE_MESH = tetrahedralMesh(STONE_FREQUENCY);
const FACE_CYCLE = [
	0,199,234,198,233,197,232,196,231,195,149,177,143,171,136,164,
	129,72,100,64,128,192,228,193,229,194,230,202,236,201,235,200,
	65,101,73,107,79,130,165,137,172,144,178,145,179,151,184,156,
	188,160,2,37,9,43,15,212,245,211,244,210,243,215,248,216,
	249,217,21,49,16,44,10,38,3,157,185,152,180,146,174,140,
	168,133,94,122,91,119,87,115,82,110,76,104,68,218,250,222,
	69,105,77,111,83,116,88,120,92,123,95,125,97,127,98,126,
	96,124,93,121,89,117,84,112,78,106,70,225,253,223,254,224,
	30,58,27,55,23,51,18,46,12,40,5,148,176,142,6,41,
	13,47,19,52,24,56,28,59,31,61,33,226,255,227,71,35,
	63,34,62,32,60,29,57,25,53,20,48,14,42,7,99,135,
	170,134,169,141,175,147,181,153,4,39,11,45,17,50,22,54,
	26,221,252,220,251,219,247,214,246,213,67,103,75,109,81,114,
	86,118,90,132,167,139,173,138,166,131,85,113,80,108,74,102,
	66,207,241,208,242,209,237,203,238,204,239,205,240,206,8,36,
	1,162,190,159,187,155,183,150,182,154,186,158,189,161,191,163
];
let SAGA = [];
let SAGA_INDEX = new Map();

function shuffled(values) {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const target = Math.floor(Math.random() * (index + 1));
		[result[index], result[target]] = [result[target], result[index]];
	}
	return result;
}

function randomiseSagaOrder() {
	const sourceSlots = shuffled([0, 1, 2, 3]);
	const letterMaps = sourceSlots.map(() => shuffled(LETTERS));
	const sourceSaga = Math.random() < .5 ? BASE_SAGA : [...BASE_SAGA].reverse();
	const offset = Math.floor(Math.random() * sourceSaga.length);
	SAGA = sourceSaga.map((unused, index) => {
		const source = sourceSaga[(index + offset) % sourceSaga.length];
		return sourceSlots.map((sourceSlot, targetSlot) =>
			letterMaps[targetSlot][LETTERS.indexOf(source[sourceSlot])]
		);
	});
	SAGA_INDEX = new Map(SAGA.map((value, index) => [value.join(""), index]));
}

randomiseSagaOrder();
const PARENT_FACE_CROSSINGS = FACE_CYCLE.reduce((total, faceIndex, index) => {
	const nextFaceIndex = FACE_CYCLE[(index + 1) % FACE_CYCLE.length];
	return total + Number(
		TETRA_MESH.faces[faceIndex].owner !== TETRA_MESH.faces[nextFaceIndex].owner
	);
}, 0);
const slots = [...document.querySelectorAll("[data-slot]")];
const stageLabels = [...document.querySelectorAll("[data-generation-stage]")];
const materialButtons = [...document.querySelectorAll("[data-material-choice]")];
const animations = new Map();
let animationFrame = null;
let glyphObserver;
let code = ["F", "N", "L", "Y"];
let materialMode = "ink";
document.documentElement.dataset.material = materialMode;

const sphereCanvas = document.querySelector("#finlay-sphere");
const sphereCount = document.querySelector("#sphere-count");
const replaySphereButton = document.querySelector("#replay-sphere");
const shuffleSphereButton = document.querySelector("#shuffle-sphere");
const orbitSphereButton = document.querySelector("#orbit-sphere");
const sphereGlyphs = [];
const sphereScratchCanvas = document.createElement("canvas");
sphereScratchCanvas.dataset.compact = "true";
sphereScratchCanvas.dataset.materialOverride = "ink";
sphereScratchCanvas.dataset.strokeColor = "#000";
let sphereFrame = null;
let sphereStart = Number.POSITIVE_INFINITY;
let sphereLastFrame = performance.now();
let sphereYaw = -Math.PI / 3;
let spherePitch = .05;
let sphereOrbiting = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let sphereDragging = false;
let spherePointer = [0, 0];
let sphereHoverPoint = null;
let sphereHasBegun = false;
let sphereVisible = false;

function cyclicIndex(index) {
	return (index + SAGA.length) % SAGA.length;
}

function differingSlot(first, second) {
	return first.findIndex((letter, index) => letter !== second[index]);
}

function validateSaga() {
	const names = new Set(SAGA.map(value => value.join("")));
	const cells = new Set(FACE_CYCLE);
	if (
		SAGA.length !== 256
		|| names.size !== 256
		|| TETRA_MESH.vertices.length !== 130
		|| TETRA_MESH.tetraVertices.length !== 130
		|| TETRA_MESH.faces.length !== 256
		|| TETRA_MESH.edgeFaces.length !== 384
		|| TETRA_MESH.coarseEdges.length !== 48
		|| STONE_MESH.vertices.length !== 802
		|| STONE_MESH.faces.length !== 1600
		|| STONE_MESH.edges.length !== 2400
		|| STONE_MESH.coarseEdges.length !== 120
		|| FACE_CYCLE.length !== 256
		|| cells.size !== 256
		|| PARENT_FACE_CROSSINGS !== 32
		|| areaSpread() > 1.6
	) {
		throw new Error("FINLAY saga must contain 256 unique names and cells.");
	}
	for (let index = 0; index < SAGA.length; index += 1) {
		const next = cyclicIndex(index + 1);
		const nameDistance = SAGA[index].filter((letter, slot) => letter !== SAGA[next][slot]).length;
		const cellTouches = TETRA_MESH.faces[FACE_CYCLE[index]].neighbours.includes(FACE_CYCLE[next]);
		if (nameDistance !== 1 || !cellTouches) {
			throw new Error(`Broken saga join at cycle position ${index}.`);
		}
	}
}

function nameFrom(value) {
	return `${value[0]}I${value[1]}${value[2]}A${value[3]}`;
}

function topologyFor(value) {
	const index = SAGA_INDEX.get(value.join(""));
	const face = TETRA_MESH.faces[FACE_CYCLE[index]];
	const previousFace = FACE_CYCLE[cyclicIndex(index - 1)];
	const nextFace = FACE_CYCLE[cyclicIndex(index + 1)];
	return {
		index,
		entry: face.neighbours.indexOf(previousFace),
		exit: face.neighbours.indexOf(nextFace)
	};
}

function hash(text) {
	let value = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		value ^= text.charCodeAt(index);
		value = Math.imul(value, 16777619);
	}
	return value >>> 0;
}

function noise(seed, index) {
	const value = Math.sin((seed + index * 91.73) * 12.9898) * 43758.5453;
	return (value - Math.floor(value)) * 2 - 1;
}

function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}

function phaseProgress(progress, phase) {
	const [start, end] = PHASES[phase];
	const raw = clamp01((progress - start) / (end - start));
	return 1 - Math.pow(1 - raw, 3);
}

function visiblePolyline(points, progress) {
	if (progress <= 0) return [];
	const lengths = [];
	let total = 0;
	for (let index = 1; index < points.length; index += 1) {
		const length = Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
		lengths.push(length);
		total += length;
	}
	let remaining = total * Math.min(progress, 1);
	const visible = [points[0]];
	for (let index = 0; index < lengths.length && remaining > 0; index += 1) {
		const start = points[index];
		const end = points[index + 1];
		if (remaining >= lengths[index]) {
			visible.push(end);
			remaining -= lengths[index];
		} else {
			const amount = remaining / lengths[index];
			visible.push([
				start[0] + (end[0] - start[0]) * amount,
				start[1] + (end[1] - start[1]) * amount
			]);
			remaining = 0;
		}
	}
	return visible;
}

function roughen(points, seed) {
	const result = [];
	let sampleIndex = 0;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
		const count = Math.max(1, Math.ceil(distance / 17));
		for (let sample = index === 1 ? 0 : 1; sample <= count; sample += 1) {
			const amount = sample / count;
			const x = start[0] + (end[0] - start[0]) * amount;
			const y = start[1] + (end[1] - start[1]) * amount;
			const nx = -(end[1] - start[1]) / distance;
			const ny = (end[0] - start[0]) / distance;
			const edge = Math.sin(amount * Math.PI);
			const wobble = noise(seed, sampleIndex) * 2.6 * edge;
			result.push([x + nx * wobble, y + ny * wobble]);
			sampleIndex += 1;
		}
	}
	return result;
}

function trace(ctx, points) {
	ctx.beginPath();
	points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
	ctx.stroke();
}

function inkStroke(ctx, points, progress, seed, width) {
	const visible = visiblePolyline(roughen(points, seed), progress);
	if (visible.length < 2) return;

	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.globalAlpha *= .11;
	ctx.lineWidth = width * 1.38;
	trace(ctx, visible);
	ctx.restore();

	ctx.save();
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	for (let index = 1; index < visible.length; index += 1) {
		const start = visible[index - 1];
		const end = visible[index];
		const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
		const position = (index - .5) / (visible.length - 1);
		const pressure = .3 + .7 * Math.pow(Math.sin(position * Math.PI), .45);
		const nibAngle = .58 + .64 * Math.abs(Math.sin(angle + Math.PI * .28));
		const grain = 1 + noise(seed, index + 601) * .08;
		ctx.globalAlpha = .9 + noise(seed, index + 701) * .07;
		ctx.lineWidth = Math.max(1.8, width * pressure * nibAngle * grain);
		trace(ctx, [start, end]);
	}

	ctx.globalAlpha = .12;
	ctx.fillStyle = ctx.strokeStyle;
	visible.slice(1, -1).forEach((point, index) => {
		if (index % 3 !== 0) return;
		const pool = Math.max(1.4, width * (.13 + Math.max(0, noise(seed, index + 809)) * .08));
		ctx.beginPath();
		ctx.arc(point[0], point[1], pool, 0, Math.PI * 2);
		ctx.fill();
	});
	ctx.restore();
}

function craftedStroke(ctx, points, progress, seed, width = 15) {
	if ((ctx.__finlayMaterial || materialMode) === "ink") {
		inkStroke(ctx, points, progress, seed, width);
		return;
	}
	const visible = visiblePolyline(roughen(points, seed), progress);
	if (visible.length < 2) return;
	ctx.save();
	ctx.lineCap = "butt";
	ctx.lineJoin = "miter";
	ctx.translate(2.5, 3);
	ctx.globalAlpha *= .17;
	ctx.lineWidth = width + 5;
	trace(ctx, visible);
	ctx.restore();

	ctx.save();
	ctx.lineCap = "square";
	ctx.lineJoin = "miter";
	ctx.lineWidth = width + noise(seed, 42) * 1.8;
	trace(ctx, visible);
	ctx.globalAlpha *= .2;
	ctx.strokeStyle = "#fff8e8";
	ctx.translate(-2.2, -2);
	ctx.lineWidth = 2;
	trace(ctx, visible);
	ctx.restore();
}

function clearStrokeCounterspace(ctx, points, progress, seed, width) {
	const visible = visiblePolyline(roughen(points, seed), progress);
	if (visible.length < 2) return;
	ctx.save();
	ctx.globalCompositeOperation = "destination-out";
	ctx.globalAlpha = 1;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.lineWidth = width;
	trace(ctx, visible);
	ctx.restore();
}

function chiselEnd(ctx, points, width, seed, atStart = false) {
	if ((ctx.__finlayMaterial || materialMode) === "ink") return;
	const working = atStart ? [...points].reverse() : points;
	if (working.length < 2) return;
	const end = working.at(-1);
	const previous = working.at(-2);
	const length = Math.hypot(end[0] - previous[0], end[1] - previous[1]);
	const ux = (end[0] - previous[0]) / length;
	const uy = (end[1] - previous[1]) / length;
	const nx = -uy;
	const ny = ux;
	const tilt = noise(seed, 521) > 0 ? 1 : -1;
	const half = width * .72;
	const bite = width * .24 * tilt;
	const edgeA = [end[0] + nx * half - ux * bite, end[1] + ny * half - uy * bite];
	const edgeB = [end[0] - nx * half + ux * bite, end[1] - ny * half + uy * bite];
	const far = width * 2.2;

	ctx.save();
	ctx.globalCompositeOperation = "destination-out";
	ctx.beginPath();
	ctx.moveTo(...edgeA);
	ctx.lineTo(...edgeB);
	ctx.lineTo(end[0] + ux * far - nx * far, end[1] + uy * far - ny * far);
	ctx.lineTo(end[0] + ux * far + nx * far, end[1] + uy * far + ny * far);
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = .24;
	ctx.strokeStyle = "#fff8e8";
	ctx.lineWidth = 1.6;
	ctx.lineCap = "butt";
	trace(ctx, [edgeA, edgeB]);
	ctx.restore();
}

function transformPoints(points, angle) {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return points.map(([x, y]) => {
		const dx = x - 220;
		const dy = y - 220;
		return [220 + dx * cos - dy * sin, 220 + dx * sin + dy * cos];
	});
}

function bodyStrokes(form) {
	if (form === 0) {
		const ring = [];
		for (let index = 0; index <= 12; index += 1) {
			const angle = -Math.PI / 2 + index / 12 * Math.PI * 2;
			const radius = index % 2 ? 84 : 79;
			ring.push([220 + Math.cos(angle) * radius, 220 + Math.sin(angle) * radius]);
		}
		return [ring];
	}
	if (form === 1) return [[[166, 166], [274, 274]], [[274, 166], [166, 274]]];
	if (form === 2) return [[[180, 155], [220, 290], [260, 155]]];
	return [[[220, 126], [220, 314]]];
}

function interpolatePoint(first, second, amount) {
	return [
		first[0] + (second[0] - first[0]) * amount,
		first[1] + (second[1] - first[1]) * amount
	];
}

function truncatedRing(amount) {
	const gap = amount * 1.12;
	const points = [];
	for (let index = 0; index <= 12; index += 1) {
		const angle = gap / 2 + index / 12 * (Math.PI * 2 - gap);
		const radius = index % 2 ? 84 : 79;
		points.push([220 + Math.cos(angle) * radius, 220 + Math.sin(angle) * radius]);
	}
	return points;
}

function drawBody(ctx, form, action, bodyProgress, actionProgress, routeProgress, turn, seed, topology, mark) {
	if (form === 1) {
		const baseEnds = [[166, 166], [274, 166], [274, 274], [166, 274]];
		const exitAttachment = crossAttachment(action, mark, topology.exit);
		baseEnds.forEach((baseEnd, index) => {
			const end = action === 2
				? transformPoints([baseEnd], mark * Math.PI / 2)[0]
				: baseEnd;
			const isTruncatedArm = action === 0 && index === 1;
			const endX = end[0] - 220;
			const endY = end[1] - 220;
			const attachmentX = exitAttachment[0] - 220;
			const attachmentY = exitAttachment[1] - 220;
			const alignment = (endX * attachmentX + endY * attachmentY)
				/ (Math.hypot(endX, endY) * Math.hypot(attachmentX, attachmentY));
			const isExitArm = alignment > .99;
			const survival = isTruncatedArm
				? 1 - actionProgress
				: isExitArm
				? 1 - routeProgress
				: 1;
			craftedStroke(ctx, [[220, 220], end], bodyProgress * survival, seed + index * 31, 16);
		});
		return;
	}

	if (action !== 0) {
		bodyStrokes(form).forEach((stroke, index) => {
			craftedStroke(ctx, transformPoints(stroke, turn), bodyProgress, seed + index * 31, 16);
		});
		return;
	}

	if (form === 0) {
		const ring = truncatedRing(actionProgress);
		craftedStroke(ctx, ring, bodyProgress, seed, 16);
		if (actionProgress > 0) {
			chiselEnd(ctx, ring, 16, seed + 17, true);
			chiselEnd(ctx, ring, 16, seed + 19);
		}
		return;
	}

	if (form === 2) {
		const remainingEnd = interpolatePoint([220, 290], [184, 176], actionProgress);
		const survivingStroke = [[180, 155], remainingEnd];
		const returningStroke = [[220, 290], [260, 155]];
		craftedStroke(ctx, survivingStroke, bodyProgress, seed, 16);
		craftedStroke(ctx, returningStroke, bodyProgress * (1 - actionProgress), seed + 31, 16);
		if (actionProgress > 0) chiselEnd(ctx, survivingStroke, 16, seed + 37);
		return;
	}

	const remainingEnd = interpolatePoint([220, 314], [220, 151], actionProgress);
	const staff = [[220, 126], remainingEnd];
	craftedStroke(ctx, staff, bodyProgress, seed, 16);
	if (actionProgress > 0) chiselEnd(ctx, staff, 16, seed + 41);
}

function baseAttachment(form, direction) {
	const attachments = [
		[[299, 198], [220, 302], [141, 198]],
		[[260, 180], [260, 260], [180, 180]],
		[[256, 170], [220, 290], [184, 170]],
		[[220, 220], [220, 314], [220, 220]]
	];
	return attachments[form][direction];
}

function crossAttachment(action, mark, direction) {
	const attachment = action === 0
		? [[260, 260], [260, 260], [180, 180]][direction]
		: baseAttachment(1, direction);
	return action === 2
		? transformPoints([attachment], mark * Math.PI / 2)[0]
		: attachment;
}

function attachmentFor(form, action, mark, cadence, direction) {
	// F interventions leave one connected surviving component. Both sentence
	// tails attach to that component instead of pointing into the erased area.
	if (action === 0) {
		if (form === 0 && direction === 0) return [272, 158];
		if (form === 1) return crossAttachment(action, mark, direction);
		if (form === 2) return [184, 176];
		if (form === 3) return [220, 145];
	}
	if (form === 1) return crossAttachment(action, mark, direction);

	const attachment = baseAttachment(form, direction);
	return action === 2
		? transformPoints([attachment], mark * Math.PI / 2)[0]
		: attachment;
}

function cubicPoint(start, controlA, controlB, end, amount) {
	const inverse = 1 - amount;
	return [
		inverse ** 3 * start[0]
			+ 3 * inverse ** 2 * amount * controlA[0]
			+ 3 * inverse * amount ** 2 * controlB[0]
			+ amount ** 3 * end[0],
		inverse ** 3 * start[1]
			+ 3 * inverse ** 2 * amount * controlA[1]
			+ 3 * inverse * amount ** 2 * controlB[1]
			+ amount ** 3 * end[1]
	];
}

function ductusCurve(start, controlA, controlB, end, cadence, seed, role, strength = 1) {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const distance = Math.hypot(dx, dy);
	const along = [dx / distance, dy / distance];
	const perpendicular = [-along[1], along[0]];
	const bow = [0, 17, -17, 0][cadence];
	const organicBias = noise(seed, role === "entry" ? 413 : 419) * 2.4;
	const points = [];

	for (let index = 0; index <= 16; index += 1) {
		const amount = index / 16;
		const point = cubicPoint(start, controlA, controlB, end, amount);
		const envelope = Math.sin(amount * Math.PI) ** 2;
		const inflection = cadence === 3
			? Math.sin(amount * Math.PI * 2) * envelope * 13
			: 0;
		const displacement = ((bow + organicBias) * envelope + inflection) * strength;
		points.push([
			point[0] + perpendicular[0] * displacement,
			point[1] + perpendicular[1] * displacement
		]);
	}
	return points;
}

function connectorPoints(gate, attachment, direction, cadence, seed, role) {
	const inward = [-DIRECTIONS[direction][0], -DIRECTIONS[direction][1]];
	const dx = attachment[0] - gate[0];
	const dy = attachment[1] - gate[1];
	const distance = Math.hypot(dx, dy);
	const along = [dx / distance, dy / distance];
	const controlA = [gate[0] + inward[0] * 68, gate[1] + inward[1] * 68];
	const controlB = [attachment[0] - along[0] * 48, attachment[1] - along[1] * 48];
	return ductusCurve(gate, controlA, controlB, attachment, cadence, seed, role);
}

function exitPathFor(form, action, mark, cadence, topology, attachment, seed) {
	const gate = GATES[topology.exit];
	const outward = DIRECTIONS[topology.exit];
	const towardGate = [outward[0], outward[1]];

	if (form === 0) {
		const ringAttachment = action === 0
			? attachmentFor(form, action, mark, cadence, topology.exit)
			: baseAttachment(0, topology.exit);
		const tangent = [-towardGate[1], towardGate[0]];
		const inner = [
			ringAttachment[0] - towardGate[0] * 34 - tangent[0] * 13,
			ringAttachment[1] - towardGate[1] * 34 - tangent[1] * 13
		];
		const tail = ductusCurve(
			ringAttachment,
			[ringAttachment[0] + towardGate[0] * 52, ringAttachment[1] + towardGate[1] * 52],
			[gate[0] - towardGate[0] * 68, gate[1] - towardGate[1] * 68],
			gate,
			cadence,
			seed + 337,
			"exit",
			.62
		);
		return [inner, ...tail];
	}

	if (form === 1) {
		const armAttachment = crossAttachment(action, mark, topology.exit);
		const radialX = armAttachment[0] - 220;
		const radialY = armAttachment[1] - 220;
		const radialLength = Math.hypot(radialX, radialY) || 1;
		const curvedTail = ductusCurve(
			armAttachment,
			[
				armAttachment[0] + radialX / radialLength * 44,
				armAttachment[1] + radialY / radialLength * 44
			],
			[gate[0] - towardGate[0] * 68, gate[1] - towardGate[1] * 68],
			gate,
			cadence,
			seed + 347,
			"exit",
			.72
		);
		return [[220, 220], ...curvedTail];
	}

	if (form === 2) {
		const apex = action === 0
			? [184, 176]
			: action === 2
			? transformPoints([[220, 290]], mark * Math.PI / 2)[0]
			: [220, 290];
		const dx = gate[0] - apex[0];
		const dy = gate[1] - apex[1];
		const distance = Math.hypot(dx, dy);
		const along = [dx / distance, dy / distance];
		const perpendicular = [-along[1], along[0]];
		const controlA = [apex[0] + along[0] * 54, apex[1] + along[1] * 54];
		const controlB = [gate[0] - towardGate[0] * 68, gate[1] - towardGate[1] * 68];
		const side = noise(seed, 359) > 0 ? 1 : -1;
		const points = [];
		for (let index = 0; index <= 20; index += 1) {
			const amount = index / 20;
			const point = cubicPoint(apex, controlA, controlB, gate, amount);
			const envelope = Math.sin(amount * Math.PI) ** 2;
			const scallop = Math.sin(amount * Math.PI * 2) ** 2
				* envelope
				* (9 + cadence * 1.8)
				* side;
			points.push([
				point[0] + perpendicular[0] * scallop,
				point[1] + perpendicular[1] * scallop
			]);
		}
		return points;
	}

	return connectorPoints(
		gate,
		attachment,
		topology.exit,
		cadence,
		seed + 367,
		"exit"
	).reverse();
}

function witnessDirection(topology, mark, cadence) {
	return [0, 1, 2].find(direction => direction !== topology.entry && direction !== topology.exit);
}

function rotateAround(points, pivot, angle) {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return points.map(([x, y]) => {
		const dx = x - pivot[0];
		const dy = y - pivot[1];
		return [
			pivot[0] + dx * cos - dy * sin,
			pivot[1] + dx * sin + dy * cos
		];
	});
}

function strokeAngles(strokes) {
	const angles = [];
	strokes.forEach(points => {
		for (let index = 1; index < points.length; index += 1) {
			const dx = points[index][0] - points[index - 1][0];
			const dy = points[index][1] - points[index - 1][1];
			if (Math.hypot(dx, dy) > 8) angles.push(Math.atan2(dy, dx));
		}
	});
	return angles;
}

function angleSeparation(first, second) {
	let difference = Math.abs(first - second) % Math.PI;
	if (difference > Math.PI / 2) difference = Math.PI - difference;
	return difference;
}

function minimumSeparation(strokes, references) {
	const angles = strokeAngles(strokes);
	if (!angles.length || !references.length) return Math.PI / 2;
	return Math.min(...angles.flatMap(angle =>
		references.map(reference => angleSeparation(angle, reference))
	));
}

function resolveMinorStrokes(strokes, pivot, references, seed) {
	const threshold = Math.PI / 9;
	if (minimumSeparation(strokes, references) >= threshold) return strokes;
	const candidates = [0, 12, -12, 22, -22, 32, -32].map(degrees => degrees * Math.PI / 180);
	let best = strokes;
	let bestScore = -Infinity;
	candidates.forEach(rotation => {
		const rotated = strokes.map(points => rotateAround(points, pivot, rotation));
		const separation = minimumSeparation(rotated, references);
		const score = separation - Math.abs(rotation) * .045;
		if (score > bestScore) {
			best = rotated;
			bestScore = score;
		}
	});

	if (minimumSeparation(best, references) < Math.PI / 12 && best.length === 1 && best[0].length === 2) {
		const [start, end] = best[0];
		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const length = Math.hypot(dx, dy);
		const side = noise(seed, 887) > 0 ? 1 : -1;
		best = [[
			start,
			[
				(start[0] + end[0]) / 2 - dy / length * 9 * side,
				(start[1] + end[1]) / 2 + dx / length * 9 * side
			],
			end
		]];
	}
	return best;
}

function majorAngles(form, action, mark, topology, witnessVector) {
	const turn = action === 2 ? mark * Math.PI / 2 : 0;
	const references = [
		Math.atan2(DIRECTIONS[topology.entry][1], DIRECTIONS[topology.entry][0]),
		Math.atan2(DIRECTIONS[topology.exit][1], DIRECTIONS[topology.exit][0])
	];
	if (form === 0) {
		references.push(Math.atan2(witnessVector[1], witnessVector[0]) + Math.PI / 2);
	} else if (form === 1) {
		references.push(Math.PI / 4 + turn, -Math.PI / 4 + turn);
	} else if (form === 2) {
		references.push(
			Math.atan2(165, 85) + turn,
			Math.atan2(-165, 85) + turn
		);
	} else {
		references.push(Math.PI / 2 + turn);
	}
	return references;
}

const WITNESS_ANCHORS = [
	[[286, 224], [280, 248], [276, 198], [260, 220], [266, 258], [260, 180]],
	[[220, 318], [258, 300], [182, 300], [220, 274], [266, 276], [174, 276]],
	[[154, 224], [160, 248], [164, 198], [180, 220], [174, 258], [180, 180]]
];

function witnessGeometry(mark, anchor, witnessVector) {
	const [mx, my] = anchor;
	if (mark === 0) {
		const witness = [];
		for (let index = 0; index <= 5; index += 1) {
			const angle = Math.PI + index / 5 * Math.PI;
			witness.push([mx + Math.cos(angle) * 25, my + Math.sin(angle) * 25]);
		}
		return [witness];
	}
	if (mark === 1) {
		return [
			[[mx - 19, my - 19], [mx + 19, my + 19]],
			[[mx + 19, my - 19], [mx - 19, my + 19]]
		];
	}
	if (mark === 2) {
		return [[[mx - 22, my + 17], [mx, my - 21], [mx + 22, my + 17]]];
	}
	const tangent = [-witnessVector[1], witnessVector[0]];
	return [[
		[mx - tangent[0] * 25, my - tangent[1] * 25],
		[mx + tangent[0] * 25, my + tangent[1] * 25]
	]];
}

function pointSegmentDistance(point, start, end) {
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const lengthSquared = dx * dx + dy * dy;
	if (!lengthSquared) return Math.hypot(point[0] - start[0], point[1] - start[1]);
	const amount = clamp01(
		((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared
	);
	return Math.hypot(
		point[0] - start[0] - dx * amount,
		point[1] - start[1] - dy * amount
	);
}

function segmentSide(first, second, point) {
	return (second[0] - first[0]) * (point[1] - first[1])
		- (second[1] - first[1]) * (point[0] - first[0]);
}

function segmentDistance(firstStart, firstEnd, secondStart, secondEnd) {
	const firstSides = [
		segmentSide(firstStart, firstEnd, secondStart),
		segmentSide(firstStart, firstEnd, secondEnd)
	];
	const secondSides = [
		segmentSide(secondStart, secondEnd, firstStart),
		segmentSide(secondStart, secondEnd, firstEnd)
	];
	const boundsOverlap = Math.max(
		Math.min(firstStart[0], firstEnd[0]),
		Math.min(secondStart[0], secondEnd[0])
	) <= Math.min(
		Math.max(firstStart[0], firstEnd[0]),
		Math.max(secondStart[0], secondEnd[0])
	) && Math.max(
		Math.min(firstStart[1], firstEnd[1]),
		Math.min(secondStart[1], secondEnd[1])
	) <= Math.min(
		Math.max(firstStart[1], firstEnd[1]),
		Math.max(secondStart[1], secondEnd[1])
	);
	if (
		boundsOverlap
		&& firstSides[0] * firstSides[1] <= 0
		&& secondSides[0] * secondSides[1] <= 0
	) {
		return 0;
	}
	return Math.min(
		pointSegmentDistance(firstStart, secondStart, secondEnd),
		pointSegmentDistance(firstEnd, secondStart, secondEnd),
		pointSegmentDistance(secondStart, firstStart, firstEnd),
		pointSegmentDistance(secondEnd, firstStart, firstEnd)
	);
}

function strokeClearance(firstStrokes, secondStrokes) {
	let clearance = Infinity;
	firstStrokes.forEach(first => {
		for (let firstIndex = 1; firstIndex < first.length; firstIndex += 1) {
			secondStrokes.forEach(second => {
				for (let secondIndex = 1; secondIndex < second.length; secondIndex += 1) {
					clearance = Math.min(clearance, segmentDistance(
						first[firstIndex - 1],
						first[firstIndex],
						second[secondIndex - 1],
						second[secondIndex]
					));
				}
			});
		}
	});
	return clearance;
}

function witnessBoundaryClearance(strokes) {
	let clearance = Infinity;
	for (const stroke of strokes) {
		for (const point of stroke) {
			if (!pointInTriangle(point, TRIANGLE)) return -Infinity;
			TRIANGLE.forEach((start, index) => {
				const end = TRIANGLE[(index + 1) % TRIANGLE.length];
				clearance = Math.min(clearance, pointSegmentDistance(point, start, end));
			});
		}
	}
	return clearance;
}

function bodyCollisionGeometry(form, action, mark) {
	if (action === 0) {
		if (form === 0) return [truncatedRing(1)];
		if (form === 2) return [[[180, 155], [184, 176]]];
		if (form === 3) return [[[220, 126], [220, 151]]];
	}
	const turn = action === 2 ? mark * Math.PI / 2 : 0;
	return bodyStrokes(form).map(stroke => transformPoints(stroke, turn));
}

function placeWitness(mark, witnessAt, references, obstacles, seed) {
	const witnessVector = DIRECTIONS[witnessAt];
	let bestStrokes = null;
	let bestClearance = -Infinity;
	WITNESS_ANCHORS[witnessAt].forEach((anchor, index) => {
		const strokes = resolveMinorStrokes(
			witnessGeometry(mark, anchor, witnessVector),
			anchor,
			references,
			seed + index * 17
		);
		const boundaryClearance = witnessBoundaryClearance(strokes);
		if (boundaryClearance < 9) return;
		const clearance = strokeClearance(strokes, obstacles);
		const score = clearance + Math.min(boundaryClearance, 24) * .08;
		if (score > bestClearance) {
			bestStrokes = strokes;
			bestClearance = score;
		}
	});
	return bestStrokes || witnessGeometry(mark, WITNESS_ANCHORS[witnessAt][3], witnessVector);
}

function drawGlyph(canvas, value, progress = 1, highlighted = false) {
	const size = 440;
	const ratio = canvas.dataset.compact === "true"
		? .34
		: Math.min(window.devicePixelRatio || 1, 1.6);
	if (canvas.width !== Math.round(size * ratio)) {
		canvas.width = Math.round(size * ratio);
		canvas.height = Math.round(size * ratio);
	}
	const ctx = canvas.getContext("2d");
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	ctx.clearRect(0, 0, size, size);
	ctx.__finlayMaterial = canvas.dataset.materialOverride || materialMode;
	ctx.strokeStyle = canvas.dataset.strokeColor
		|| (highlighted ? "#e9e0ce" : getComputedStyle(canvas).color);
	ctx.fillStyle = ctx.strokeStyle;
	if (canvas.dataset.boundsVisible === "true") {
		ctx.save();
		ctx.globalAlpha = .52;
		ctx.strokeStyle = highlighted ? "#e9e0ce" : "#903925";
		ctx.lineWidth = 1.4;
		ctx.lineCap = "butt";
		trace(ctx, [...TRIANGLE, TRIANGLE[0]]);
		ctx.restore();
	}
	ctx.save();
	ctx.beginPath();
	TRIANGLE.forEach(([x, y], index) => {
		if (index) ctx.lineTo(x, y);
		else ctx.moveTo(x, y);
	});
	ctx.closePath();
	ctx.clip();

	const [form, action, mark, cadence] = value.map(letter => LETTERS.indexOf(letter));
	const topology = topologyFor(value);
	const glyphSeed = hash(value.join(""));
	const bodyProgress = phaseProgress(progress, 0);
	const actionProgress = phaseProgress(progress, 1);
	const markProgress = phaseProgress(progress, 2);
	const routeProgress = phaseProgress(progress, 3);
	const turn = action === 2 ? mark * Math.PI / 2 : 0;
	const witnessAt = witnessDirection(topology, mark, cadence);
	const witnessVector = DIRECTIONS[witnessAt];
	const references = majorAngles(form, action, mark, topology, witnessVector);

	drawBody(ctx, form, action, bodyProgress, actionProgress, routeProgress, turn, glyphSeed, topology, mark);

	const secondaryStrokes = [];
	// F forms are drawn as surviving material. L orientation is already baked
	// into the body above; only graft and bar add secondary strokes here.
	if (action === 1) {
		const grafts = [
			[[220, 220], [220, 143], [252, 112]],
			[[220, 220], [286, 220], [298, 192]],
			[[220, 220], [220, 297], [188, 328]],
			[[220, 220], [143, 220], [112, 252]]
		];
		const resolvedGraft = resolveMinorStrokes(
			[grafts[cadence]],
			[220, 220],
			references,
			glyphSeed + 109
		)[0];
		craftedStroke(ctx, resolvedGraft, actionProgress, glyphSeed + 113, 13);
		secondaryStrokes.push(resolvedGraft);
		references.push(...strokeAngles([resolvedGraft]));
	} else if (action === 3) {
		const initialBar = cadence % 2
			? [[220, 132], [220, 308]]
			: [[132, 220], [308, 220]];
		const resolvedBar = resolveMinorStrokes(
			[initialBar],
			[220, 220],
			references,
			glyphSeed + 131
		)[0];
		craftedStroke(ctx, resolvedBar, actionProgress, glyphSeed + 139, 13);
		secondaryStrokes.push(resolvedBar);
		references.push(...strokeAngles([resolvedBar]));
	}

	const entryAttachment = attachmentFor(form, action, mark, cadence, topology.entry);
	const exitAttachment = attachmentFor(form, action, mark, cadence, topology.exit);
	const entryConnector = connectorPoints(
		GATES[topology.entry],
		entryAttachment,
		topology.entry,
		cadence,
		glyphSeed,
		"entry"
	);
	const exitConnector = exitPathFor(
		form,
		action,
		mark,
		cadence,
		topology,
		exitAttachment,
		glyphSeed
	);
	const resolvedWitness = placeWitness(
		mark,
		witnessAt,
		references,
		[
			...bodyCollisionGeometry(form, action, mark),
			...secondaryStrokes
		],
		glyphSeed + 197
	);

	const arrivalProgress = clamp01(routeProgress / .58);
	const departureProgress = clamp01((routeProgress - .42) / .58);
	craftedStroke(ctx, entryConnector, arrivalProgress, glyphSeed + 307, 11);
	craftedStroke(ctx, exitConnector, departureProgress, glyphSeed + 311, 11);
	// The diacritic owns a narrow counterspace. It is still generated in phase
	// three, but remains legible if the later sentence-line passes behind it.
	resolvedWitness.forEach((stroke, index) => {
		const seed = glyphSeed + 211 + index * 7;
		clearStrokeCounterspace(ctx, stroke, markProgress, seed, 21);
		craftedStroke(ctx, stroke, markProgress, seed, 9);
	});
	ctx.restore();
	canvas.dataset.drawProgress = String(progress);
}

function recipe(value) {
	const [form, action, mark, cadence] = value.map(letter => LETTERS.indexOf(letter));
	const topology = topologyFor(value);
	const truncations = [
		"The ring opens into a chisel-ended C.",
		"One arm withdraws from the cross, leaving a three-way junction.",
		"The cleft and returning arm withdraw, leaving one apostrophe stroke.",
		"The staff contracts into a short chisel score."
	];
	const intervention = action === 0
		? truncations[form]
		: action === 2
		? `The body is drawn directly in its ${["given", "quarter-turned", "half-turned", "three-quarter-turned"][mark]} orientation.`
		: `A ${ACTION_NAMES[action]} acts on the skeleton.`;
	const departures = [
		`A ${CADENCE_NAMES[cadence]} Q-tail carries the ring to the ${DIRECTION_NAMES[topology.exit]} gate.`,
		`The relevant cross-arm bends into a ${CADENCE_NAMES[cadence]} departure for the ${DIRECTION_NAMES[topology.exit]} gate.`,
		`A restrained scallop grows from the apex to the ${DIRECTION_NAMES[topology.exit]} gate.`,
		`The ${CADENCE_NAMES[cadence]} sentence-line leaves the staff for the ${DIRECTION_NAMES[topology.exit]} gate.`
	];
	return `${FORM_NAMES[form][0].toUpperCase() + FORM_NAMES[form].slice(1)} body. ${intervention} A ${MARK_NAMES[mark]} witnesses the cut. ${departures[form]}`;
}

function valueFromCanvas(canvas) {
	const name = canvas.dataset.finlay;
	return [name[0], name[2], name[3], name[5]];
}

function installBoundsHover(canvas) {
	if (canvas.dataset.boundsHoverInstalled === "true") return;
	canvas.dataset.boundsHoverInstalled = "true";
	const redraw = visible => {
		canvas.dataset.boundsVisible = String(visible);
		const highlighted = canvas.closest(".sibling")?.classList.contains("active") || false;
		const progress = Number(canvas.dataset.drawProgress ?? 1);
		drawGlyph(canvas, valueFromCanvas(canvas), progress, highlighted);
	};
	canvas.addEventListener("pointerenter", () => redraw(true));
	canvas.addEventListener("pointerleave", () => redraw(false));
}

function updateSequence(progress) {
	stageLabels.forEach((label, index) => {
		const [start, end] = PHASES[index];
		label.classList.toggle("is-active", progress >= start && progress < end);
		label.classList.toggle("is-complete", progress >= end);
	});
}

function paintAnimation(time) {
	animations.forEach((animation, canvas) => {
		if (!canvas.isConnected) {
			animations.delete(canvas);
			return;
		}
		const progress = clamp01((time - animation.start) / animation.duration);
		const highlighted = canvas.closest(".sibling")?.classList.contains("active") || false;
		drawGlyph(canvas, valueFromCanvas(canvas), progress, highlighted);
		if (canvas.id === "active-glyph") updateSequence(progress);
		if (progress >= 1) animations.delete(canvas);
	});
	animationFrame = animations.size ? requestAnimationFrame(paintAnimation) : null;
}

function animateGlyph(canvas, delay = 0) {
	animations.set(canvas, { start: performance.now() + delay, duration: 1750 });
	if (!animationFrame) animationFrame = requestAnimationFrame(paintAnimation);
}

function observeGlyphs() {
	glyphObserver?.disconnect();
	const glyphCanvases = [...document.querySelectorAll("canvas[data-finlay]")];
	glyphCanvases.forEach(installBoundsHover);
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		glyphCanvases.forEach(canvas => {
			const highlighted = canvas.closest(".sibling")?.classList.contains("active") || false;
			drawGlyph(canvas, valueFromCanvas(canvas), 1, highlighted);
		});
		updateSequence(1);
		return;
	}
	glyphObserver = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (!entry.isIntersecting || entry.target.dataset.animated === "true") return;
			entry.target.dataset.animated = "true";
			const relatives = [...(entry.target.parentElement.parentElement.querySelectorAll?.("canvas") || [])];
			const delay = Math.min(Math.max(relatives.indexOf(entry.target), 0) * 45, 360);
			animateGlyph(entry.target, delay);
			glyphObserver.unobserve(entry.target);
		});
	}, { threshold: .18 });
	glyphCanvases.forEach(canvas => {
		canvas.dataset.animated = "false";
		drawGlyph(canvas, valueFromCanvas(canvas), 0);
		glyphObserver.observe(canvas);
	});
	updateSequence(0);
}

function makeCard(value, className, prefix = "") {
	const button = document.createElement(className === "sibling" ? "button" : "div");
	button.className = className;
	if (button.tagName === "BUTTON") button.type = "button";
	const canvas = document.createElement("canvas");
	canvas.dataset.finlay = nameFrom(value);
	const label = document.createElement("span");
	label.textContent = prefix ? `${prefix} · ${nameFrom(value)}` : nameFrom(value);
	button.append(canvas, label);
	return button;
}

function drawSagaMap(activeIndex) {
	const canvas = document.querySelector("#saga-map");
	const size = 760;
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = size * ratio;
	canvas.height = size * ratio;
	const ctx = canvas.getContext("2d");
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	ctx.clearRect(0, 0, size, size);
	const ink = getComputedStyle(canvas).color;
	const panels = [[205, 205], [555, 205], [205, 555], [555, 555]];
	const panelCorners = panels.map(([x, y]) => [
		[x, y - 142],
		[x + 142, y + 108],
		[x - 142, y + 108]
	]);
	const pointForVertex = (vertex, owner) => {
		const root = TETRA_MESH.roots[owner];
		const weights = TETRA_MESH.vertexWeights[vertex];
		return [0, 1].map(axis =>
			root.reduce((sum, pole, corner) =>
				sum + weights[pole] / 8 * panelCorners[owner][corner][axis], 0
			)
		);
	};
	const facePoints = TETRA_MESH.faces.map(face =>
		face.vertices.map(vertex => pointForVertex(vertex, face.owner))
	);
	const faceCentres = facePoints.map(points => [
		points.reduce((sum, point) => sum + point[0], 0) / 3,
		points.reduce((sum, point) => sum + point[1], 0) / 3
	]);

	ctx.strokeStyle = ink;
	ctx.globalAlpha = .13;
	ctx.lineWidth = .85;
	facePoints.forEach(points => trace(ctx, [...points, points[0]]));

	ctx.globalAlpha = .48;
	ctx.lineWidth = 1.5;
	ctx.lineCap = "round";
	for (let index = 0; index < FACE_CYCLE.length; index += 1) {
		const currentFace = FACE_CYCLE[index];
		const nextFace = FACE_CYCLE[cyclicIndex(index + 1)];
		const crossesParentFace = TETRA_MESH.faces[currentFace].owner !== TETRA_MESH.faces[nextFace].owner;
		ctx.save();
		if (crossesParentFace) {
			ctx.strokeStyle = "#903925";
			ctx.globalAlpha = .28;
			ctx.setLineDash([3, 5]);
		}
		trace(ctx, [faceCentres[currentFace], faceCentres[nextFace]]);
		ctx.restore();
	}

	const before = faceCentres[FACE_CYCLE[cyclicIndex(activeIndex - 1)]];
	const active = faceCentres[FACE_CYCLE[activeIndex]];
	const after = faceCentres[FACE_CYCLE[cyclicIndex(activeIndex + 1)]];
	ctx.globalAlpha = 1;
	ctx.strokeStyle = "#903925";
	ctx.lineWidth = 5;
	trace(ctx, [before, active, after]);
	ctx.fillStyle = "#903925";
	ctx.beginPath();
	ctx.arc(active[0], active[1], 6, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = ink;
	ctx.lineWidth = 1;
	trace(ctx, [...facePoints[FACE_CYCLE[activeIndex]], facePoints[FACE_CYCLE[activeIndex]][0]]);

	ctx.globalAlpha = .62;
	ctx.fillStyle = ink;
	ctx.font = "11px ProFont, monospace";
	ctx.textAlign = "center";
	panels.forEach(([x, y], index) => ctx.fillText(`TETRA FACE ${String.fromCharCode(65 + index)}`, x, y + 136));
}

function rotateSphereVector(vector) {
	const cosYaw = Math.cos(sphereYaw);
	const sinYaw = Math.sin(sphereYaw);
	const cosPitch = Math.cos(spherePitch);
	const sinPitch = Math.sin(spherePitch);
	const x = vector[0] * cosYaw + vector[2] * sinYaw;
	const z = -vector[0] * sinYaw + vector[2] * cosYaw;
	return [
		x,
		vector[1] * cosPitch - z * sinPitch,
		vector[1] * sinPitch + z * cosPitch
	];
}

function smoothstep(start, end, value) {
	const amount = clamp01((value - start) / (end - start));
	return amount * amount * (3 - 2 * amount);
}

function roundedTetraPoint(mesh, vertexIndex, distributionPower = 1) {
	const sourceWeights = mesh.vertexWeights[vertexIndex].map(weight =>
		Math.pow(weight / mesh.frequency, distributionPower)
	);
	const weightTotal = sourceWeights.reduce((sum, weight) => sum + weight, 0);
	const weights = sourceWeights.map(weight => weight / weightTotal);
	const tetra = [0, 1, 2].map(axis =>
		weights.reduce(
			(sum, weight, pole) => sum + weight * TETRA_POLES[pole][axis],
			0
		)
	);
	const faceInfluence = weights.map(weight =>
		1 - smoothstep(0, STONE_BEVEL_BAND, weight)
	);
	const roundedNormal = normalise3([0, 1, 2].map(axis =>
		faceInfluence.reduce(
			(sum, influence, pole) => sum - influence * TETRA_POLES[pole][axis],
			0
		)
	));
	return tetra.map((value, axis) =>
		value * (1 - STONE_BEVEL_RADIUS) + roundedNormal[axis] * STONE_BEVEL_RADIUS
	);
}

function triangleArea3(points) {
	const first = points[1].map((value, axis) => value - points[0][axis]);
	const second = points[2].map((value, axis) => value - points[0][axis]);
	return Math.hypot(...cross3(first, second)) / 2;
}

// Reassign the fixed stone vertex budget from the planar face interiors to
// the bevel bands. The independent FINLAY mesh remains evenly distributed.
const STONE_VERTICES = STONE_MESH.vertices.map((unused, index) =>
	roundedTetraPoint(STONE_MESH, index, STONE_DISTRIBUTION_POWER)
);
const FINLAY_VERTICES = TETRA_MESH.vertices.map((unused, index) =>
	roundedTetraPoint(TETRA_MESH, index, DISTRIBUTION_POWER)
);

function areaSpread() {
	const areas = TETRA_MESH.faces.map(face =>
		triangleArea3(face.vertices.map(vertex => FINLAY_VERTICES[vertex]))
	);
	return Math.max(...areas) / Math.min(...areas);
}

function projectedSurface(mesh, sourceVertices, centreX, centreY, radius) {
	const vertices = sourceVertices.map(vertex =>
		rotateSphereVector(vertex)
	);
	const points2 = vertices.map(point => [
		centreX + point[0] * radius,
		centreY - point[1] * radius
	]);
	const light = normalise3([-.45, .68, .58]);
	const faces = mesh.faces.map((face, faceIndex) => {
		const points3 = face.vertices.map(vertex => vertices[vertex]);
		const first = points3[1].map((value, axis) => value - points3[0][axis]);
		const second = points3[2].map((value, axis) => value - points3[0][axis]);
		const normal = normalise3(cross3(first, second));
		const depth = points3.reduce((sum, point) => sum + point[2], 0) / 3;
		return {
			faceIndex,
			points3,
			points2: face.vertices.map(vertex => points2[vertex]),
			normal,
			depth,
			light: clamp01(.5 + dot3(normal, light) * .5),
			visible: normal[2] > .002
		};
	});
	return { mesh, vertices, points2, faces };
}

function drawStoneSurface(ctx, surface) {
	const visibleFaces = surface.faces
		.filter(face => face.visible)
		.sort((first, second) => first.depth - second.depth);

	ctx.save();
	ctx.lineJoin = "round";
	visibleFaces.forEach(face => {
		const stoneVariation = noise(face.faceIndex + 1703, 17) * .012;
		const tone = clamp01(.18 + face.light * .78 + stoneVariation);
		const dark = [126, 82, 47];
		const light = [238, 207, 153];
		const colour = dark.map((value, index) =>
			Math.round(value + (light[index] - value) * tone)
		);
		ctx.fillStyle = `rgb(${colour.join(",")})`;
		ctx.strokeStyle = ctx.fillStyle;
		ctx.lineWidth = 1.15;
		ctx.beginPath();
		face.points2.forEach(([x, y], index) =>
			index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
		);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();

		if (face.faceIndex % 3 !== 0) return;
		for (let pore = 0; pore < 2; pore += 1) {
			const weights = [0, 1, 2].map(axis =>
				.18 + (noise(face.faceIndex * 43 + pore * 11, axis + 71) + 1) * .5
			);
			const total = weights.reduce((sum, value) => sum + value, 0);
			const x = face.points2.reduce(
				(sum, point, index) => sum + point[0] * weights[index] / total,
				0
			);
			const y = face.points2.reduce(
				(sum, point, index) => sum + point[1] * weights[index] / total,
				0
			);
			ctx.fillStyle = `rgba(74, 43, 24, ${.055 + face.light * .025})`;
			ctx.beginPath();
			ctx.arc(
				x,
				y,
				.35 + (noise(face.faceIndex + 2053, pore + 89) + 1) * .34,
				0,
				Math.PI * 2
			);
			ctx.fill();
			if ((face.faceIndex + pore) % 2 === 0) {
				ctx.fillStyle = `rgba(255, 231, 188, ${.045 + face.light * .025})`;
				ctx.beginPath();
				ctx.arc(
					x + noise(face.faceIndex + 2213, pore + 101) * 1.5,
					y + noise(face.faceIndex + 2273, pore + 103) * 1.5,
					.25 + (noise(face.faceIndex + 2293, pore + 107) + 1) * .2,
					0,
					Math.PI * 2
				);
				ctx.fill();
			}
		}
	});
	ctx.restore();
}

function pointInTriangle(point, triangle) {
	const signs = triangle.map((first, index) => {
		const second = triangle[(index + 1) % triangle.length];
		return (point[0] - second[0]) * (first[1] - second[1])
			- (first[0] - second[0]) * (point[1] - second[1]);
	});
	return signs.every(value => value >= 0) || signs.every(value => value <= 0);
}

function hoveredDistributionFace(surface) {
	if (!sphereHoverPoint || sphereDragging) return null;
	return surface.faces
		.filter(face => face.visible && pointInTriangle(sphereHoverPoint, face.points2))
		.sort((first, second) => second.depth - first.depth)[0] || null;
}

function drawHoveredFinlayBounds(ctx, face) {
	if (!face) return;
	ctx.save();
	ctx.strokeStyle = "rgba(255, 229, 174, .9)";
	ctx.lineWidth = 1.4;
	ctx.lineJoin = "round";
	ctx.shadowColor = "rgba(255, 204, 108, .48)";
	ctx.shadowBlur = 5;
	ctx.beginPath();
	face.points2.forEach(([x, y], index) =>
		index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
	);
	ctx.closePath();
	ctx.stroke();
	ctx.restore();
}

function createSphereSource(value, colour) {
	const canvas = document.createElement("canvas");
	canvas.dataset.finlay = nameFrom(value);
	canvas.dataset.compact = "true";
	canvas.dataset.materialOverride = "ink";
	canvas.dataset.strokeColor = colour;
	drawGlyph(canvas, value, 0);
	return canvas;
}

function initialiseSphereGlyphs() {
	sphereGlyphs.splice(0, sphereGlyphs.length);
	SAGA.forEach((value, index) => {
		sphereGlyphs.push({
			value,
			faceIndex: FACE_CYCLE[index],
			ink: createSphereSource(value, "#17130f"),
			orange: createSphereSource(value, "#ee691f"),
			yellow: createSphereSource(value, "#ffe66f"),
			inkProgress: -1,
			timeline: -1
		});
	});
}

function drawGlyphWindow(canvas, value, start, end) {
	if (end - start < .001) {
		drawGlyph(canvas, value, 0);
		return;
	}
	drawGlyph(canvas, value, end);
	if (start <= 0) return;
	drawGlyph(sphereScratchCanvas, value, start);
	const ctx = canvas.getContext("2d");
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.globalCompositeOperation = "destination-out";
	ctx.drawImage(sphereScratchCanvas, 0, 0);
	ctx.drawImage(sphereScratchCanvas, 0, 0);
	ctx.restore();
}

function updateSphereSource(glyph, timeline) {
	const boundedTimeline = Math.max(0, Math.min(timeline, 1.24));
	if (Math.abs(boundedTimeline - glyph.timeline) < .014 && boundedTimeline < 1.24) return;
	if (glyph.timeline === 1.24 && boundedTimeline === 1.24) return;
	const inkProgress = clamp01(timeline);
	if (Math.abs(inkProgress - glyph.inkProgress) >= .012 || glyph.inkProgress < 0) {
		drawGlyph(glyph.ink, glyph.value, inkProgress);
		glyph.inkProgress = inkProgress;
	}
	const yellowEnd = clamp01(timeline);
	const yellowStart = clamp01(timeline - .07);
	const orangeEnd = yellowStart;
	const orangeStart = clamp01(timeline - .22);
	drawGlyphWindow(glyph.yellow, glyph.value, yellowStart, yellowEnd);
	drawGlyphWindow(glyph.orange, glyph.value, orangeStart, orangeEnd);
	glyph.timeline = boundedTimeline;
}

function drawProjectedGlyph(ctx, source, projection, alpha, heat = false) {
	ctx.save();
	ctx.globalAlpha = alpha;
	if (heat) {
		ctx.filter = "blur(5px)";
		ctx.globalCompositeOperation = "screen";
		ctx.shadowColor = "rgba(255, 224, 92, .88)";
		ctx.shadowBlur = 10;
	}
	ctx.transform(
		projection.east[0],
		projection.east[1],
		projection.south[0],
		projection.south[1],
		projection.x,
		projection.y
	);
	ctx.beginPath();
	TRIANGLE.forEach(([x, y], index) => {
		const localX = x - 220;
		const localY = y - 248.333;
		if (index) ctx.lineTo(localX, localY);
		else ctx.moveTo(localX, localY);
	});
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(
		source,
		0,
		0,
		source.width,
		source.height,
		-220,
		-248.333,
		440,
		440
	);
	ctx.restore();
}

function renderFinlaySphere(time) {
	if (!sphereVisible) {
		sphereLastFrame = time;
		sphereFrame = requestAnimationFrame(renderFinlaySphere);
		return;
	}
	const elapsed = Math.min(time - sphereLastFrame, 40);
	sphereLastFrame = time;
	if (sphereOrbiting && !sphereDragging) sphereYaw += elapsed * .000075;

	const bounds = sphereCanvas.getBoundingClientRect();
	const width = Math.max(320, bounds.width);
	const height = Math.max(420, bounds.height);
	const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.7);
	const targetWidth = Math.round(width * pixelRatio);
	const targetHeight = Math.round(height * pixelRatio);
	if (sphereCanvas.width !== targetWidth || sphereCanvas.height !== targetHeight) {
		sphereCanvas.width = targetWidth;
		sphereCanvas.height = targetHeight;
	}
	const ctx = sphereCanvas.getContext("2d");
	ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
	ctx.clearRect(0, 0, width, height);
	const radius = Math.min(width * .42, height * .43);
	const centreX = width / 2;
	const centreY = height / 2 + radius * .14;

	ctx.save();
	ctx.filter = "blur(18px)";
	ctx.fillStyle = "rgba(0, 0, 0, .28)";
	ctx.beginPath();
	ctx.ellipse(
		centreX + radius * .05,
		centreY + radius * .54,
		radius * .58,
		radius * .12,
		0,
		0,
		Math.PI * 2
	);
	ctx.fill();
	ctx.restore();

	const stoneSurface = projectedSurface(STONE_MESH, STONE_VERTICES, centreX, centreY, radius);
	drawStoneSurface(ctx, stoneSurface);
	const finlaySurface = projectedSurface(TETRA_MESH, FINLAY_VERTICES, centreX, centreY, radius);
	const hoveredFace = hoveredDistributionFace(finlaySurface);

	const etchInterval = 42;
	const etchDuration = 820;
	let started = 0;
	const visible = [];
	sphereGlyphs.forEach((glyph, index) => {
		const age = time - sphereStart - index * etchInterval;
		const timeline = age / etchDuration;
		if (age >= 0) started += 1;
		updateSphereSource(glyph, timeline);

		const face = finlaySurface.faces[glyph.faceIndex];
		if (!face.visible || age < 0) return;
		const [top, right, left] = face.points3;
		const position = [0, 1, 2].map(axis =>
			(top[axis] + right[axis] + left[axis]) / 3
		);
		const eastStep = right.map((value, axis) => (value - left[axis]) / 360);
		const baseMiddle = right.map((value, axis) => (value + left[axis]) / 2);
		const southStep = baseMiddle.map((value, axis) => (value - top[axis]) / 320);
		const depthFade = clamp01(face.normal[2] / .18);
		visible.push({
			glyph,
			age,
			depth: position[2],
			projection: {
				x: centreX + position[0] * radius,
				y: centreY - position[1] * radius,
				east: [
					eastStep[0] * radius,
					-eastStep[1] * radius
				],
				south: [
					southStep[0] * radius,
					-southStep[1] * radius
				]
			},
			depthFade
		});
	});

	visible.sort((first, second) => first.depth - second.depth);
	visible.forEach(item => {
		drawProjectedGlyph(ctx, item.glyph.ink, item.projection, .88 * item.depthFade);
		drawProjectedGlyph(ctx, item.glyph.orange, item.projection, .92 * item.depthFade);
		drawProjectedGlyph(ctx, item.glyph.yellow, item.projection, .9 * item.depthFade, true);
		drawProjectedGlyph(ctx, item.glyph.yellow, item.projection, .96 * item.depthFade);
	});
	drawHoveredFinlayBounds(ctx, hoveredFace);

	sphereCount.textContent = `${String(started).padStart(3, "0")} / 256 ETCHED`;
	sphereFrame = requestAnimationFrame(renderFinlaySphere);
}

function replaySphere() {
	sphereStart = performance.now() + 240;
	sphereGlyphs.forEach(glyph => {
		glyph.inkProgress = -1;
		glyph.timeline = -1;
		updateSphereSource(glyph, 0);
	});
	sphereCount.textContent = "000 / 256 ETCHED";
}

function updateSphereOrbitButton() {
	orbitSphereButton.setAttribute("aria-pressed", String(sphereOrbiting));
	orbitSphereButton.textContent = sphereOrbiting ? "PAUSE ORBIT" : "RESUME ORBIT";
}

function render() {
	const name = nameFrom(code);
	const activeIndex = SAGA_INDEX.get(code.join(""));
	const previous = SAGA[cyclicIndex(activeIndex - 1)];
	const next = SAGA[cyclicIndex(activeIndex + 1)];
	document.querySelector("#active-name").textContent = name;
	document.querySelector("#active-glyph").dataset.finlay = name;
	document.querySelector("#address").textContent = code.map(letter => String(LETTERS.indexOf(letter)).padStart(2, "0")).join(".");
	document.querySelector("#active-recipe").textContent = recipe(code);
	document.querySelector("#cycle-position").textContent = `${String(activeIndex).padStart(3, "0")} / 255`;
	document.querySelector("#cycle-neighbours").textContent = `${nameFrom(previous)} enters by changing position ${VARIABLE_POSITIONS[differingSlot(previous, code)]}. ${nameFrom(next)} continues the line by changing position ${VARIABLE_POSITIONS[differingSlot(code, next)]}.`;
	slots.forEach((slot, index) => slot.value = code[index]);

	const siblings = document.querySelector("#siblings");
	siblings.replaceChildren();
	[-2, -1, 0, 1, 2].forEach(offset => {
		const value = SAGA[cyclicIndex(activeIndex + offset)];
		const captions = ["−2", "PREVIOUS", "ACTIVE", "NEXT", "+2"];
		const card = makeCard(value, "sibling", captions[offset + 2]);
		card.classList.toggle("active", offset === 0);
		card.addEventListener("click", () => { code = [...value]; render(); });
		card.addEventListener("pointerenter", () => drawGlyph(card.querySelector("canvas"), value, 1, true));
		card.addEventListener("pointerleave", () => drawGlyph(card.querySelector("canvas"), value, 1, card.classList.contains("active")));
		siblings.append(card);
	});

	const field = document.querySelector("#field-grid");
	field.replaceChildren();
	for (let offset = -7; offset <= 8; offset += 1) {
		const index = cyclicIndex(activeIndex + offset);
		field.append(makeCard(SAGA[index], "field-cell", String(index).padStart(3, "0")));
	}
	drawSagaMap(activeIndex);
	observeGlyphs();
}

materialButtons.forEach(button => button.addEventListener("click", () => {
	const nextMaterial = button.dataset.materialChoice;
	if (nextMaterial === materialMode) return;
	materialMode = nextMaterial;
	document.documentElement.dataset.material = materialMode;
	materialButtons.forEach(choice => {
		choice.setAttribute("aria-pressed", String(choice.dataset.materialChoice === materialMode));
	});
	animations.clear();
	render();
}));

slots.forEach((slot, index) => slot.addEventListener("change", () => {
	code[index] = slot.value;
	render();
}));

document.querySelector("#replay").addEventListener("click", () => {
	const canvas = document.querySelector("#active-glyph");
	canvas.dataset.animated = "true";
	updateSequence(0);
	animateGlyph(canvas);
});

document.querySelector("#randomise").addEventListener("click", () => {
	code = SAGA[Math.floor(Math.random() * SAGA.length)].slice();
	render();
});

replaySphereButton.addEventListener("click", () => {
	sphereHasBegun = true;
	replaySphere();
});

shuffleSphereButton.addEventListener("click", () => {
	randomiseSagaOrder();
	validateSaga();
	initialiseSphereGlyphs();
	render();
	sphereHasBegun = true;
	replaySphere();
});

orbitSphereButton.addEventListener("click", () => {
	sphereOrbiting = !sphereOrbiting;
	updateSphereOrbitButton();
});

sphereCanvas.addEventListener("pointerdown", event => {
	sphereDragging = true;
	sphereHoverPoint = null;
	spherePointer = [event.clientX, event.clientY];
	sphereCanvas.setPointerCapture(event.pointerId);
});

sphereCanvas.addEventListener("pointermove", event => {
	if (!sphereDragging) {
		const bounds = sphereCanvas.getBoundingClientRect();
		sphereHoverPoint = [event.clientX - bounds.left, event.clientY - bounds.top];
		return;
	}
	const dx = event.clientX - spherePointer[0];
	const dy = event.clientY - spherePointer[1];
	sphereYaw += dx * .006;
	spherePitch = Math.max(-1.15, Math.min(1.15, spherePitch + dy * .005));
	spherePointer = [event.clientX, event.clientY];
});

sphereCanvas.addEventListener("pointerup", event => {
	sphereDragging = false;
	const bounds = sphereCanvas.getBoundingClientRect();
	sphereHoverPoint = [event.clientX - bounds.left, event.clientY - bounds.top];
	sphereCanvas.releasePointerCapture(event.pointerId);
});

sphereCanvas.addEventListener("pointercancel", () => {
	sphereDragging = false;
	sphereHoverPoint = null;
});

sphereCanvas.addEventListener("pointerleave", () => {
	if (!sphereDragging) sphereHoverPoint = null;
});

window.addEventListener("resize", () => {
	document.querySelectorAll("canvas[data-finlay]").forEach(canvas => {
		const highlighted = canvas.closest(".sibling")?.classList.contains("active") || false;
		drawGlyph(canvas, valueFromCanvas(canvas), 1, highlighted);
	});
	drawSagaMap(SAGA_INDEX.get(code.join("")));
});

validateSaga();
initialiseSphereGlyphs();
updateSphereOrbitButton();
new IntersectionObserver(entries => {
	sphereVisible = entries.some(entry => entry.isIntersecting);
	if (sphereHasBegun || !sphereVisible) return;
	sphereHasBegun = true;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		sphereStart = performance.now() - 256 * 42 - 1400;
		sphereGlyphs.forEach(glyph => updateSphereSource(glyph, 2));
	} else {
		replaySphere();
	}
}, { threshold: .18 }).observe(sphereCanvas);
sphereFrame = requestAnimationFrame(renderFinlaySphere);
render();
