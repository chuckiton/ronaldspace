import { getUniverse } from "./universes.js";

export class RonaldHistory {
    constructor({ onSelect, onHoverChange }) {
        this.element = document.querySelector("#ronald-history");
        this.onSelect = onSelect;
        this.onHoverChange = onHoverChange;
        this.entries = new Map();
        this.hoveredRonald = null;
        this.selectedRonald = null;
        this.universe = "ronald";
        this.columns = new Map();
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
        entry.addEventListener("click", event => {
            this.onSelect(ronald, event);
        });

        this.entries.set(ronald, entry);
        const entries = this.ensureColumn(ronald.universe).querySelector(".ronald-history-column-entries");
        entries.prepend(entry);
        this.refresh();
    }

    ensureColumn(universe) {
        if (this.columns.has(universe)) return this.columns.get(universe);

        const column = document.createElement("section");
        column.className = "ronald-history-column";
        column.dataset.historyUniverse = universe;
        const heading = document.createElement("h2");
        heading.textContent = `${getUniverse(universe).plural} discovered`;
        const entries = document.createElement("div");
        entries.className = "ronald-history-column-entries";
        column.append(heading, entries);
        this.columns.set(universe, column);
        this.element.append(column);
        return column;
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
        this.setUniverses([universe], universe);
    }

    setUniverses(universes, primaryUniverse = universes.at(-1)) {
        const activeUniverses = new Set(universes);
        this.universe = primaryUniverse;
        universes.forEach(id => this.ensureColumn(id));
        this.columns.forEach((column, id) => {
            column.hidden = !activeUniverses.has(id);
            if (activeUniverses.has(id)) this.element.append(column);
        });
        this.entries.forEach((entry, ronald) => {
            const active = activeUniverses.has(ronald.universe);
            entry.hidden = !active;
            entry.disabled = !active || ronald.locked;
        });
        this.element.dataset.universe = primaryUniverse;
        this.element.dataset.columns = String(universes.length);
        this.element.setAttribute(
            "aria-label",
            `${universes.map(id => getUniverse(id).plural).join(" and ")} discovered`
        );
        this.refresh();
    }
}
