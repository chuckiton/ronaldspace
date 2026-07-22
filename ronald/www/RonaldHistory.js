export class RonaldHistory {
    constructor({ onSelect, onHoverChange }) {
        this.element = document.querySelector("#ronald-history");
        this.onSelect = onSelect;
        this.onHoverChange = onHoverChange;
        this.entries = new Map();
        this.hoveredRonald = null;
        this.selectedRonald = null;
        this.universe = "ronald";
    }

    add(ronald) {
        const entry = document.createElement("button");
        entry.type = "button";
        entry.className = "ronald-history-entry";
        entry.textContent = ronald.name;
        entry.setAttribute("aria-label", `Select ${ronald.name}`);
        entry.dataset.universe = ronald.universe;

        entry.addEventListener("pointerenter", () => {
            this.onHoverChange(ronald);
        });
        entry.addEventListener("pointerleave", () => {
            this.onHoverChange(null, ronald);
        });
        entry.addEventListener("click", () => {
            this.onSelect(ronald);
        });

        this.entries.set(ronald, entry);
        this.element.prepend(entry);
        this.refresh();
    }

    remove(ronald) {
        const entry = this.entries.get(ronald);

        if (entry) {
            entry.remove();
            this.entries.delete(ronald);
        }

        if (this.hoveredRonald === ronald) {
            this.hoveredRonald = null;
        }
        if (this.selectedRonald === ronald) {
            this.selectedRonald = null;
        }
    }

    setHovered(ronald) {
        this.hoveredRonald = ronald;
        this.updateEntries();
    }

    setSelected(ronald) {
        this.selectedRonald = ronald;
        this.updateEntries();
    }

    updateEntries() {
        this.entries.forEach((entry, entryRonald) => {
            const highlighted = entryRonald === this.hoveredRonald;
            const selected = entryRonald === this.selectedRonald;
            entry.classList.toggle("is-highlighted", highlighted);
            entry.classList.toggle("is-selected", selected);
            entry.setAttribute("aria-current", selected ? "true" : "false");
            entry.style.color = entryRonald.getHistoryColour(highlighted || selected);
        });
    }

    refresh() {
        this.updateEntries();
    }

    setUniverse(universe) {
        this.universe = universe;
        this.entries.forEach((entry, ronald) => {
            const active = ronald.universe === universe;
            entry.hidden = !active;
            entry.disabled = !active || ronald.locked;
        });
        this.element.dataset.universe = universe;
        this.refresh();
    }
}
