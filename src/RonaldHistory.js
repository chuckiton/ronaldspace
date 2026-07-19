export class RonaldHistory {
    constructor({ onSelect, onHoverChange }) {
        this.element = document.querySelector("#ronald-history");
        this.onSelect = onSelect;
        this.onHoverChange = onHoverChange;
        this.entries = new Map();
        this.hoveredRonald = null;
    }

    add(ronald) {
        const entry = document.createElement("button");
        entry.type = "button";
        entry.className = "ronald-history-entry";
        entry.textContent = ronald.name;
        entry.setAttribute("aria-label", `Select ${ronald.name}`);

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

    setHovered(ronald) {
        this.hoveredRonald = ronald;

        this.entries.forEach((entry, entryRonald) => {
            const highlighted = entryRonald === ronald;
            entry.classList.toggle("is-highlighted", highlighted);
            entry.style.color = entryRonald.getHistoryColour(highlighted);
        });
    }

    refresh() {
        this.setHovered(this.hoveredRonald);
    }
}
