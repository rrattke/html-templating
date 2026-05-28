import { Reactive, state, Styleable } from "@vanishing/framework/wc";
import { html } from "@vanishing/framework/template";
import styles from "./data-table.css?inline";

interface Person {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
}

type SortKey = keyof Person | null;
type SortDirection = "asc" | "desc";

export class DataTable extends Styleable(Reactive(HTMLElement)) {
  static styles = styles;

  @state
  accessor data: Person[] = [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "Developer", status: "active" },
    { id: 2, name: "Bob Smith", email: "bob@example.com", role: "Designer", status: "active" },
    { id: 3, name: "Carol Williams", email: "carol@example.com", role: "Manager", status: "inactive" },
    { id: 4, name: "David Brown", email: "david@example.com", role: "Developer", status: "active" },
    { id: 5, name: "Eve Davis", email: "eve@example.com", role: "Designer", status: "active" },
  ];

  @state
  accessor sortKey: SortKey = null;
  @state
  accessor sortDirection: SortDirection = "asc";

  get sortedData() {
    if (!this.sortKey) { return this.data; }

    return [...this.data].sort((a, b) => {
      const aVal = a[this.sortKey!];
      const bVal = b[this.sortKey!];

      if (aVal < bVal) { return this.sortDirection === "asc" ? -1 : 1; }
      if (aVal > bVal) { return this.sortDirection === "asc" ? 1 : -1; }
      return 0;
    });
  }

  handleSort(key: keyof Person) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = key;
      this.sortDirection = "asc";
    }
  }

  handleEdit(id: number) {
    const person = this.data.find((p) => p.id === id);
    if (person) {
      alert(`Edit ${person.name} (ID: ${id})`);
    }
  }

  handleDelete(id: number) {
    if (confirm("Are you sure you want to delete this person?")) {
      this.data = this.data.filter((p) => p.id !== id);
    }
  }

  toggleStatus(id: number) {
    this.data = this.data.map((person) =>
      person.id === id
        ? { ...person, status: person.status === "active" ? "inactive" : "active" as const }
        : person
    );
  }

  // Slot-based column definition
  renderHeader(label: string, key: keyof Person | null, sortable = true) {
    const isSorted = this.sortKey === key;
    const direction = this.sortDirection === "asc" ? "↑" : "↓";

    return html`
      <th 
        class="${sortable && key ? "sortable" : ""} ${isSorted ? "sorted" : ""}"
        @click=${sortable && key ? () => this.handleSort(key) : null}
      >
        ${label}
        ${sortable && key ? html`<span class="sort-indicator">${isSorted ? direction : "↕"}</span>` : ""}
      </th>
    `;
  }

  // Slot-based row rendering
  renderRow(person: Person) {
    return html`
      <tr>
        <td>${person.id}</td>
        <td>${person.name}</td>
        <td>${person.email}</td>
        <td>${person.role}</td>
        <td>
          <button @click=${() => this.toggleStatus(person.id)}>
            ${person.status}
          </button>
        </td>
        <td>
          <div class="actions">
            <button @click=${() => this.handleEdit(person.id)}>Edit</button>
            <button class="danger" @click=${() => this.handleDelete(person.id)}>Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  template() {
    return html`
      <header>Data Table with Slots Demo</header>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="sortable ${() => this.sortKey === "id" ? "sorted" : ""}" @click=${() => this.handleSort("id")}>
                ID
                <span class="sort-indicator">${() =>
      this.sortKey === "id" ? (this.sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
              </th>
              <th class="sortable ${() => this.sortKey === "name" ? "sorted" : ""}" @click=${() => this.handleSort("name")}>
                NAME
                <span class="sort-indicator">${() =>
      this.sortKey === "name" ? (this.sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
              </th>
              <th class="sortable ${() => this.sortKey === "email" ? "sorted" : ""}" @click=${() => this.handleSort("email")}>
                EMAIL
                <span class="sort-indicator">${() =>
      this.sortKey === "email" ? (this.sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
              </th>
              <th class="sortable ${() => this.sortKey === "role" ? "sorted" : ""}" @click=${() => this.handleSort("role")}>
                ROLE
                <span class="sort-indicator">${() =>
      this.sortKey === "role" ? (this.sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
              </th>
              <th class="sortable ${() => this.sortKey === "status" ? "sorted" : ""}" @click=${() => this.handleSort("status")}>
                STATUS
                <span class="sort-indicator">${() =>
      this.sortKey === "status" ? (this.sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
              </th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            ${() =>
      this.sortedData.map((person) =>
        html(person.id)`
              ${this.renderRow(person)}
            `
      )}
          </tbody>
        </table>
      </div>
    `;
  }
}

customElements.define("data-table", DataTable);
