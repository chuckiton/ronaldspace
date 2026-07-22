import { GODNEY_NAME } from "./constants.js?v=20260722-gerald-live-wave";
import { getUniverse } from "./universes.js?v=20260722-gerald-live-wave";

const ENTRY_MODES = ["random", "enter", "build"];
const ENTRY_MODE_LABELS = {
    enter: "Enter a RONALD",
    build: "Build new RONALD",
    random: "Random RONALD"
};
const MODE_TRANSITION_DURATION = 420;

function normaliseName(value, definition, godneyInvocationEnabled = false, universeNavigations = []) {
    let name = "";

    for (const character of value.toUpperCase()) {
        if (name.length === 6) {
            break;
        }

        const proposed = `${name}${character}`;
        if (
            definition.isValidPrefix(proposed)
            || (godneyInvocationEnabled && GODNEY_NAME.startsWith(proposed))
            || universeNavigations.some(navigation => navigation.name.startsWith(proposed))
        ) {
            name += character;
        }
    }

    return name;
}

function validateNamePrefix(name, definition, godneyInvocationEnabled = false, universeNavigations = []) {
    if (name.length === 6) {
        return {
            valid: definition.isValidName(name)
                || (godneyInvocationEnabled && name === GODNEY_NAME)
                || universeNavigations.some(navigation => navigation.name === name),
            complete: true
        };
    }

    return {
        valid: definition.isValidPrefix(name)
            || (godneyInvocationEnabled && GODNEY_NAME.startsWith(name))
            || universeNavigations.some(navigation => navigation.name.startsWith(name)),
        complete: false
    };
}

export class RonaldInput {
    constructor(onDraw, findExistingRonald, onUniverseTransition) {
        this.onDraw = onDraw;
        this.findExistingRonald = findExistingRonald;
        this.onUniverseTransition = onUniverseTransition;
        this.typefaceReady = false;
        this.universe = "ronald";
        this.definition = getUniverse(this.universe);
        this.godneyInvocationEnabled = true;
        this.universeNavigations = [];
        this.form = document.querySelector("#ronald-form");
        this.entryStage = document.querySelector("#ronald-entry-stage");
        this.entry = document.querySelector("#ronald-entry");
        this.input = document.querySelector("#ronald-input");
        this.preview = document.querySelector("#ronald-preview");
        this.builder = document.querySelector("#ronald-builder");
        this.builderLetters = [...document.querySelectorAll("[data-builder-letter]")];
        this.builderControls = [...document.querySelectorAll("[data-builder-index]")];
        this.builderIndices = [0, 2, 3, 4, 5];
        this.random = document.querySelector("#ronald-random");
        this.randomPreview = document.querySelector("#ronald-random-preview");
        this.modeLabel = document.querySelector("#ronald-mode-label");
        this.previousMode = document.querySelector("#previous-entry-mode");
        this.nextMode = document.querySelector("#next-entry-mode");
        this.button = document.querySelector("#draw-ronald");
        this.mode = "enter";
        this.builderName = this.definition.initialBuilderName;
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
                    this.focusWithinEntryStage(this.input);
                }
            });
        });
        this.entry.addEventListener("pointerdown", () => {
            if (this.mode === "enter") {
                requestAnimationFrame(() => this.focusWithinEntryStage(this.input));
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
        requestAnimationFrame(() => this.focusWithinEntryStage(this.input));
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
        const name = normaliseName(
            this.input.value,
            this.definition,
            this.godneyInvocationEnabled,
            this.universeNavigations
        );
        const result = validateNamePrefix(
            name,
            this.definition,
            this.godneyInvocationEnabled,
            this.universeNavigations
        );

        this.input.value = name;
        this.preview.textContent = name;
        const existingRonald = this.findExistingRonald(name);
        this.preview.style.color = existingRonald
            ? existingRonald.getIdentityColour()
            : "";
        this.form.dataset.valid = result.valid ? "true" : "false";
        this.updateDrawButton(result.complete, name);
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

        this.entryStage.scrollLeft = 0;
        this.updateModeInteractivity();
        this.modeLabel.textContent = this.getModeLabel(mode);

        if (entering) {
            this.update();
            requestAnimationFrame(() => this.focusWithinEntryStage(this.input));
        } else if (mode === "build") {
            this.updateBuilder();
            requestAnimationFrame(() => this.focusWithinEntryStage(this.builder));
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

    focusWithinEntryStage(element) {
        try {
            element.focus({ preventScroll: true });
        } catch {
            element.focus();
        }

        this.entryStage.scrollLeft = 0;
    }

    getModeLabel(mode) {
        return ENTRY_MODE_LABELS[mode].replaceAll("RONALD", this.definition.noun);
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
        const choices = this.builderChoices(index);
        const currentIndex = choices.indexOf(this.builderName[index]);
        const nextIndex = (currentIndex + direction + choices.length) % choices.length;

        this.builderName = `${this.builderName.slice(0, index)}${choices[nextIndex]}${this.builderName.slice(index + 1)}`;
        this.updateBuilder();
    }

    builderChoices(index) {
        return this.definition.builder.choices(this.builderName, index);
    }

    updateBuilder() {
        this.builderName = this.definition.builder.normalise(this.builderName);
        [...new Set(this.builderControls.map(control => Number(control.dataset.builderIndex)))].forEach(index => {
            this.setBuilderControlVisibility(
                index,
                this.definition.builder.controlVisible(this.builderName, index)
            );
        });

        this.builderIndices = this.definition.builder.indices(this.builderName);
        if (!this.builderIndices.includes(this.activeBuilderIndex)) {
            this.activeBuilderIndex = 2;
        }

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
        this.updateDrawButton(this.definition.isValidName(this.builderName), this.builderName);
        this.updateSubmitLabel(this.builderName);
    }

    setBuilderControlVisibility(index, visible) {
        this.builderControls
            .filter(control => Number(control.dataset.builderIndex) === index)
            .forEach(control => {
                // Visibility, rather than display:none/hidden, keeps the
                // letter anchored in the middle grid row.
                control.hidden = false;
                control.disabled = !visible;
                control.classList.toggle("is-concealed", !visible);
            });
    }

    updateRandom() {
        const existingRonald = this.findExistingRonald(this.randomName);

        this.randomPreview.textContent = this.randomName.padEnd(6, "█");
        this.random.style.color = existingRonald
            ? existingRonald.getIdentityColour()
            : "";
        this.updateDrawButton(!this.isRandomising, this.randomName);
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
        if (this.findExistingRonald(name)) {
            this.button.textContent = `Select ${name}`;
            return;
        }

        this.button.textContent = `Submit ${name.padEnd(6, "_")}`;
    }

    submit(event) {
        event?.preventDefault();

        if (this.mode === "random") {
            this.randomlyBuildRonald();
            return;
        }

        const name = this.mode === "enter"
            ? normaliseName(
                this.input.value,
                this.definition,
                this.godneyInvocationEnabled,
                this.universeNavigations
            )
            : this.builderName;

        if (!this.typefaceReady) {
            return;
        }

        if (name === GODNEY_NAME) {
            this.onUniverseTransition?.({ id: "godney-invocation" });
            return;
        }

        const navigation = this.universeNavigations.find(candidate => candidate.name === name);
        if (navigation) {
            this.onUniverseTransition?.({ id: "universe-navigation", to: navigation.to });
            return;
        }

        if (!this.definition.isValidName(name)) {
            return;
        }

        if (this.definition.transition?.name === name) {
            this.onUniverseTransition?.(this.definition.transition);
            return;
        }

        const submittedRonald = this.onDraw(name, { audition: true });
        this.flashSubmitButton(submittedRonald);
        if (this.mode === "enter") {
            this.input.value = "";
            this.update();
            this.focusWithinEntryStage(this.input);
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

        const randomTarget = this.definition.transition && Math.random() < 0.035
            ? this.definition.transition.name
            : null;
        const randomTemplate = this.definition.template;
        let position = 0;

        const composeNextLetter = () => {
            if (position === randomTemplate.length) {
                this.isRandomising = false;
                if (this.definition.transition?.name === this.randomName) {
                    this.onUniverseTransition?.(this.definition.transition);
                    this.isRandomising = false;
                    this.updateModeButtons();
                    this.updateRandom();
                    return;
                }
                const submittedRonald = this.onDraw(this.randomName, { audition: true });
                this.flashSubmitButton(submittedRonald);
                this.updateModeButtons();
                this.updateRandom();
                return;
            }

            const choices = randomTarget ? randomTarget[position] : randomTemplate[position];
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
        const letters = normaliseName(
            name,
            this.definition,
            this.godneyInvocationEnabled,
            this.universeNavigations
        );
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

    setUniverse(universe) {
        this.universe = universe;
        this.definition = getUniverse(universe);
        this.builderIndices = this.definition.builder.indices(this.definition.initialBuilderName);
        this.activeBuilderIndex = this.builderIndices[0];
        this.builderName = this.definition.initialBuilderName;
        this.input.value = "";
        this.randomName = "";
        this.modeLabel.textContent = this.getModeLabel(this.mode);
        this.builder.setAttribute("aria-label", `Build new ${this.definition.noun}`);
        this.update();
        this.updateBuilder();
        this.updateRandom();
        this.refresh();

        if (this.mode === "build") {
            requestAnimationFrame(() => this.focusWithinEntryStage(this.builder));
        }
    }

    setGodneyInvocationEnabled(enabled) {
        this.godneyInvocationEnabled = enabled;
        this.refresh();
    }

    setUniverseNavigations(navigations) {
        this.universeNavigations = navigations;
        this.refresh();
    }

    clearEntry() {
        this.input.value = "";
        this.randomName = "";
        this.update();
        if (this.mode === "random") this.updateRandom();
        if (this.mode === "enter") this.focusWithinEntryStage(this.input);
    }
}
