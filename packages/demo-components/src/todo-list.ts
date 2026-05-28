import { Reactive, state, Styleable } from "@vanishing/framework/wc";
import { html } from "@vanishing/framework/template";
import styles from "./todo-list.css?inline";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

type Filter = "all" | "active" | "completed";

export class TodoList extends Styleable(Reactive(HTMLElement)) {
  static styles = styles;

  @state
  accessor todos: Todo[] = [];
  @state
  accessor filter: Filter = "all";
  @state
  accessor inputValue = "";

  #nextId = 1;

  get filteredTodos() {
    switch (this.filter) {
      case "active":
        return this.todos.filter((todo) => !todo.completed);
      case "completed":
        return this.todos.filter((todo) => todo.completed);
      default:
        return this.todos;
    }
  }

  get activeCount() {
    return this.todos.filter((todo) => !todo.completed).length;
  }

  get completedCount() {
    return this.todos.filter((todo) => todo.completed).length;
  }

  addTodo() {
    const text = this.inputValue.trim();
    if (!text) { return; }

    this.todos = [...this.todos, {
      id: this.#nextId++,
      text,
      completed: false,
    }];
    this.inputValue = "";
  }

  toggleTodo(id: number) {
    this.todos = this.todos.map((todo) => todo.id === id ? { ...todo, completed: !todo.completed } : todo);
  }

  deleteTodo(id: number) {
    this.todos = this.todos.filter((todo) => todo.id !== id);
  }

  setFilter(filter: Filter) {
    this.filter = filter;
  }

  handleKeyPress(e: KeyboardEvent) {
    if (e.key === "Enter") {
      this.addTodo();
    }
  }

  template() {
    return html`
      <header>Todo List Demo</header>
      
      <div class="input-group">
        <input 
          type="text" 
          placeholder="What needs to be done?"
          .value=${() => this.inputValue}
          @input=${(e: Event) => {
      this.inputValue = (e.target as HTMLInputElement).value;
    }}
          @keypress=${(e: KeyboardEvent) => this.handleKeyPress(e)}
        />
        <button @click=${() => this.addTodo()}>Add</button>
      </div>
      
      <div class="filters">
        <button 
          class="${() => this.filter === "all" ? "filter-btn active" : "filter-btn"}"
          @click=${() => this.setFilter("all")}
        >
          All
        </button>
        <button 
          class="${() => this.filter === "active" ? "filter-btn active" : "filter-btn"}"
          @click=${() => this.setFilter("active")}
        >
          Active
        </button>
        <button 
          class="${() => this.filter === "completed" ? "filter-btn active" : "filter-btn"}"
          @click=${() => this.setFilter("completed")}
        >
          Completed
        </button>
      </div>
      
      ${() => {
      const filtered = this.filteredTodos;
      if (filtered.length === 0) {
        return html`
            <div class="empty-state">
              ${
          this.filter === "all"
            ? "No todos yet. Add one above!"
            : `No ${this.filter} todos.`
        }
            </div>
          `;
      }

      return html`
          <ul class="todo-list">
            ${
        filtered.map((todo) =>
          html(todo.id)`
              <li class="${todo.completed ? "todo-item completed" : "todo-item"}">
                <div 
                  class="${todo.completed ? "checkbox checked" : "checkbox"}"
                  @click=${() => this.toggleTodo(todo.id)}
                ></div>
                <span class="todo-text">${todo.text}</span>
                <button 
                  class="delete-btn"
                  @click=${() => this.deleteTodo(todo.id)}
                >
                  Delete
                </button>
              </li>
            `
        )
      }
          </ul>
        `;
    }}
      
      ${() =>
      this.todos.length > 0
        ? html`
        <div class="stats">
          <span>${this.activeCount} active</span>
          <span>${this.completedCount} completed</span>
          <span>${this.todos.length} total</span>
        </div>
      `
        : ""}
    `;
  }
}

customElements.define("todo-list", TodoList);
