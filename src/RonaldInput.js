import { RONALD_PATTERN, RONALD_TEMPLATE } from "./constants.js";

const ENTRY_MODES = ["enter", "build", "random"];
const ENTRY_MODE_LABELS = {
    enter: "Enter a Ronald",
    build: "Build new Ronald",
    random: "Random Ronald"
};
const MODE_TRANSITION_DURATION = 420;

function normaliseRonald(value) {
    let name = "";

    for (const character of value.toUpperCase()) {
        if (name.length === 6) {
            break;
        }

        if (RONALD_TEMPLATE[name.length].includes(character)) {
            name += character;
        }
    }

    return name;
}

function validateRonaldPrefix(name) {
    for (let index = 0; index < name.length; index += 1) {
        if (!RONALD_TEMPLATE[index].includes(name[index])) {
            return {
                valid: false,
                message: `Position ${index + 1} must be ${RONALD_TEMPLATE[index]}`
            };
        }
    }

    if (name.length === 6) {
        return { valid: RONALD_PATTERN.test(name), complete: true, message: "Ready to draw" };
    }

    return {
        valid: true,
        complete: false,
        message: name.length === 0 ? "Type a Ronald" : `Next: ${RONALD_TEMPLATE[name.length]}`
    };
}

export class RonaldInput {
    constructor(onDraw, findExistingRonald) {
        this.onDraw = onDraw;
        this.findExistingRonald = findExistingRonald;
        this.typefaceReady = false;
        this.form = document.querySelector("#ronald-form");
        this.entry = document.querySelector("#ronald-entry");
        this.input = document.querySelector("#ronald-input");
        this.preview = document.querySelector("#ronald-preview");
        this.builder = document.querySelector("#ronald-builder");
        this.builderLetters = [...document.querySelectorAll("[data-builder-letter]")];
        this.builderIndices = [0, 2, 4, 5];
        this.random = document.querySelector("#ronald-random");
        this.randomPreview = document.querySelector("#ronald-random-preview");
        this.modeLabel = document.querySelector("#ronald-mode-label");
        this.previousMode = document.querySelector("#previous-entry-mode");
        this.nextMode = document.querySelector("#next-entry-mode");
        this.button = document.querySelector("#draw-ronald");
        this.mode = "enter";
        this.builderName = "RONALD";
        this.randomName = "";
        this.activeBuilderIndex = this.builderIndices[0];
        this.isRandomising = false;
        this.isModeTransitioning = false;
        this.modeTransitionTimeout = null;
        this.submitFlashTimeout = null;
        this.updateModeInteractivity();

        // Do not inherit a browser-restored value from a previous page visit.
        this.input.value = "";
        this.input.addEventListener("input", () => this.update());
        this.input.addEventListener("blur", () => {
            // The typed Ronald is the primary keyboard interaction. Restore
            // focus after canvas navigation or button clicks without blocking
            // their pointer behaviour.
            requestAnimationFrame(() => {
                if (this.mode === "enter") {
                    this.input.focus();
                }
            });
        });
        this.entry.addEventListener("pointerdown", () => {
            if (this.mode === "enter") {
                requestAnimationFrame(() => this.input.focus());
            }
        });
        this.previousMode.addEventListener("click", () => this.cycleMode(-1));
        this.nextMode.addEventListener("click", () => this.cycleMode(1));
        this.builder.addEventListener("click", event => this.changeBuilderLetter(event));
        this.builder.addEventListener("keydown", event => this.handleBuilderKeydown(event));
        this.button.addEventListener("pointerdown", event => event.preventDefault());
        this.form.addEventListener("submit", event => this.submit(event));
        this.updateBuilder();
        this.updateRandom();
        requestAnimationFrame(() => this.input.focus());
    }

    setTypefaceReady() {
        this.typefaceReady = true;
        if (this.mode === "build") {
            this.updateBuilder();
            return;
        }

        if (this.mode === "random") {
            this.updateRandom();
            return;
        }

        this.update();
    }

    update() {
        const name = normaliseRonald(this.input.value);
        const result = validateRonaldPrefix(name);

        this.input.value = name;
        this.preview.textContent = name;
        this.form.dataset.valid = result.valid ? "true" : "false";
        this.updateDrawButton(result.complete);
        this.updateSubmitLabel(name);
    }

    cycleMode(direction) {
        if (this.isRandomising || this.isModeTransitioning) {
            return;
        }

        const currentIndex = ENTRY_MODES.indexOf(this.mode);
        const nextIndex = Math.max(
            0,
            Math.min(ENTRY_MODES.length - 1, currentIndex + direction)
        );

        if (nextIndex === currentIndex) {
            return;
        }

        this.setMode(ENTRY_MODES[nextIndex]);
    }

    setMode(mode) {
        this.mode = mode;
        this.isModeTransitioning = true;
        const entering = mode === "enter";

        this.updateModeInteractivity();
        this.modeLabel.textContent = ENTRY_MODE_LABELS[mode];

        if (entering) {
            this.update();
            requestAnimationFrame(() => this.input.focus());
        } else if (mode === "build") {
            this.updateBuilder();
            requestAnimationFrame(() => this.builder.focus());
        } else {
            this.randomName = "";
            this.updateRandom();
            requestAnimationFrame(() => this.button.focus());
        }

        window.clearTimeout(this.modeTransitionTimeout);
        this.modeTransitionTimeout = window.setTimeout(() => {
            this.isModeTransitioning = false;
            this.updateModeButtons();
        }, MODE_TRANSITION_DURATION);
    }

    updateModeInteractivity() {
        const entering = this.mode === "enter";
        const building = this.mode === "build";

        this.form.dataset.mode = this.mode;
        this.entry.inert = !entering;
        this.builder.inert = !building;
        this.random.inert = this.mode !== "random";
        this.entry.setAttribute("aria-hidden", String(!entering));
        this.builder.setAttribute("aria-hidden", String(!building));
        this.random.setAttribute("aria-hidden", String(this.mode !== "random"));
        this.updateModeButtons();
    }

    updateModeButtons() {
        const modeIndex = ENTRY_MODES.indexOf(this.mode);

        this.previousMode.disabled = this.isRandomising || this.isModeTransitioning || modeIndex === 0;
        this.nextMode.disabled = this.isRandomising || this.isModeTransitioning || modeIndex === ENTRY_MODES.length - 1;
    }

    changeBuilderLetter(event) {
        const control = event.target.closest("[data-builder-direction]");

        if (!control) {
            return;
        }

        const index = Number(control.dataset.builderIndex);
        const direction = Number(control.dataset.builderDirection);
        this.activeBuilderIndex = index;
        this.adjustBuilderLetter(index, direction);
    }

    handleBuilderKeydown(event) {
        if (this.mode !== "build") {
            return;
        }

        if (event.key === "Enter" && event.target === this.builder) {
            this.submit();
            event.preventDefault();
            return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            const currentIndex = this.builderIndices.indexOf(this.activeBuilderIndex);
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const nextIndex = (currentIndex + direction + this.builderIndices.length) % this.builderIndices.length;

            this.activeBuilderIndex = this.builderIndices[nextIndex];
            this.updateBuilder();
            event.preventDefault();
            return;
        }

        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            const direction = event.key === "ArrowUp" ? 1 : -1;
            this.adjustBuilderLetter(this.activeBuilderIndex, direction);
            event.preventDefault();
        }
    }

    adjustBuilderLetter(index, direction) {
        const choices = RONALD_TEMPLATE[index];
        const currentIndex = choices.indexOf(this.builderName[index]);
        const nextIndex = (currentIndex + direction + choices.length) % choices.length;

        this.builderName = `${this.builderName.slice(0, index)}${choices[nextIndex]}${this.builderName.slice(index + 1)}`;
        this.updateBuilder();
    }

    updateBuilder() {
        this.builderLetters.forEach(letter => {
            const index = Number(letter.dataset.builderLetter);
            letter.textContent = this.builderName[index];
            letter.parentElement.classList.toggle(
                "is-active",
                index === this.activeBuilderIndex
            );
        });
        const existingRonald = this.findExistingRonald(this.builderName);

        this.builder.style.color = existingRonald
            ? existingRonald.getIdentityColour()
            : "";
        this.updateDrawButton(true);
        this.updateSubmitLabel(this.builderName);
    }

    updateRandom() {
        const existingRonald = this.findExistingRonald(this.randomName);

        this.randomPreview.textContent = this.randomName.padEnd(6, "█");
        this.random.style.color = existingRonald
            ? existingRonald.getIdentityColour()
            : "";
        this.updateDrawButton(!this.isRandomising);
        this.updateSubmitLabel(this.randomName);
    }

    refresh() {
        if (this.mode === "build") {
            this.updateBuilder();
            return;
        }

        if (this.mode === "random") {
            this.updateRandom();
            return;
        }

        this.update();
    }

    updateDrawButton(isComplete) {
        this.button.disabled = !isComplete || !this.typefaceReady;
    }

    updateSubmitLabel(name) {
        this.button.textContent = `Submit ${name.padEnd(6, "_")}`;
    }

    submit(event) {
        event?.preventDefault();

        if (this.mode === "random") {
            this.randomlyBuildRonald();
            return;
        }

        const name = this.mode === "enter"
            ? normaliseRonald(this.input.value)
            : this.builderName;

        if (!this.typefaceReady || !RONALD_PATTERN.test(name)) {
            return;
        }

        const submittedRonald = this.onDraw(name);
        this.flashSubmitButton(submittedRonald);
        if (this.mode === "enter") {
            this.input.value = "";
            this.update();
            this.input.focus();
            return;
        }

        this.updateBuilder();
    }

    randomlyBuildRonald() {
        if (this.isRandomising || !this.typefaceReady) {
            return;
        }

        this.isRandomising = true;
        this.randomName = "";
        this.updateModeButtons();
        this.updateRandom();

        let position = 0;

        const composeNextLetter = () => {
            if (position === RONALD_TEMPLATE.length) {
                this.isRandomising = false;
                const submittedRonald = this.onDraw(this.randomName);
                this.flashSubmitButton(submittedRonald);
                this.updateModeButtons();
                this.updateRandom();
                return;
            }

            const choices = RONALD_TEMPLATE[position];
            const cycles = choices.length === 1 ? 1 : 5 + Math.floor(Math.random() * 3);
            let cycle = 0;

            const cycleLetter = () => {
                const letter = choices[Math.floor(Math.random() * choices.length)];
                this.randomName = `${this.randomName.slice(0, position)}${letter}`;
                this.updateRandom();
                cycle += 1;

                if (cycle < cycles) {
                    window.setTimeout(cycleLetter, 55);
                    return;
                }

                position += 1;
                window.setTimeout(composeNextLetter, 75);
            };

            cycleLetter();
        };

        composeNextLetter();
    }

    flashSubmitButton(ronald) {
        if (!ronald) {
            return;
        }

        this.button.style.setProperty("--submit-flash", ronald.getIdentityColour());
        this.button.classList.remove("is-submitted");
        void this.button.offsetWidth;
        this.button.classList.add("is-submitted");

        window.clearTimeout(this.submitFlashTimeout);
        this.submitFlashTimeout = window.setTimeout(() => {
            this.button.classList.remove("is-submitted");
        }, 520);
    }

    playDemo(name, interval = 260, submitDelay = 600) {
        const letters = normaliseRonald(name);
        let index = 0;

        this.input.value = "";
        this.update();

        const typeNextLetter = () => {
            if (index < letters.length) {
                this.input.value += letters[index];
                index += 1;
                this.update();
                window.setTimeout(typeNextLetter, interval);
                return;
            }

            window.setTimeout(() => this.submit(), submitDelay);
        };

        typeNextLetter();
    }
}
