import { ReactiveElement } from '@vanishing/framework/wc';
import { html } from '@vanishing/framework/template';
import { state } from '@vanishing/framework/wc';

const todoStyles = `
  :host {
    display: block;
    padding: 2rem;
    border-radius: 1.5rem;
    background: linear-gradient(135deg, #ffffff, #f6f7fb);
    color: #0f172a;
    font-family: 'Space Grotesk', 'Sora', system-ui, sans-serif;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.1);
    max-width: 600px;
    border: 1px solid rgba(99, 102, 241, 0.15);
  }
  
  header {
    text-transform: uppercase;
    letter-spacing: 0.15em;
    font-size: 0.8rem;
    color: #6366f1;
    margin-bottom: 1.5rem;
  }
  
  .input-group {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  
  input {
    flex: 1;
    border: 2px solid rgba(99, 102, 241, 0.2);
    border-radius: 0.85rem;
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
    font-family: inherit;
    background: rgba(255, 255, 255, 0.8);
    transition: border-color 120ms ease;
  }
  
  input:focus {
    outline: none;
    border-color: #6366f1;
  }
  
  button {
    border: none;
    border-radius: 0.85rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    background: rgba(99, 102, 241, 0.12);
    color: #0f172a;
    cursor: pointer;
    transition: transform 120ms ease, background 120ms ease;
    white-space: nowrap;
  }
  
  button:hover {
    transform: translateY(-1px);
    background: rgba(99, 102, 241, 0.2);
  }
  
  button:active {
    transform: translateY(0);
  }
  
  .filters {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding: 0.5rem;
    background: rgba(99, 102, 241, 0.05);
    border-radius: 0.85rem;
  }
  
  .filter-btn {
    flex: 1;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    background: transparent;
  }
  
  .filter-btn.active {
    background: rgba(99, 102, 241, 0.15);
    transform: none;
  }
  
  .filter-btn.active:hover {
    transform: none;
    background: rgba(99, 102, 241, 0.2);
  }
  
  .todo-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .todo-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    margin-bottom: 0.5rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 0.85rem;
    transition: transform 120ms ease, opacity 120ms ease;
  }
  
  .todo-item:hover {
    transform: translateX(4px);
  }
  
  .todo-item.completed {
    opacity: 0.6;
  }
  
  .todo-item.completed .todo-text {
    text-decoration: line-through;
    color: #64748b;
  }
  
  .checkbox {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(99, 102, 241, 0.3);
    border-radius: 0.35rem;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 120ms ease, border-color 120ms ease;
  }
  
  .checkbox:hover {
    border-color: #6366f1;
  }
  
  .checkbox.checked {
    background: #6366f1;
    border-color: #6366f1;
  }
  
  .checkbox.checked::after {
    content: '✓';
    color: white;
    font-size: 0.75rem;
  }
  
  .todo-text {
    flex: 1;
    font-size: 0.95rem;
  }
  
  .delete-btn {
    padding: 0.35rem 0.75rem;
    font-size: 0.8rem;
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  
  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #94a3b8;
    font-size: 0.95rem;
  }
  
  .stats {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(99, 102, 241, 0.1);
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #64748b;
  }
`;

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

type Filter = 'all' | 'active' | 'completed';

export class TodoList extends ReactiveElement {
  @state accessor todos: Todo[] = [];
  @state accessor filter: Filter = 'all';
  @state accessor inputValue = '';
  
  #nextId = 1;

  get filteredTodos() {
    switch (this.filter) {
      case 'active':
        return this.todos.filter(todo => !todo.completed);
      case 'completed':
        return this.todos.filter(todo => todo.completed);
      default:
        return this.todos;
    }
  }

  get activeCount() {
    return this.todos.filter(todo => !todo.completed).length;
  }

  get completedCount() {
    return this.todos.filter(todo => todo.completed).length;
  }

  addTodo() {
    const text = this.inputValue.trim();
    if (!text) return;
    
    this.todos = [...this.todos, {
      id: this.#nextId++,
      text,
      completed: false
    }];
    this.inputValue = '';
  }

  toggleTodo(id: number) {
    this.todos = this.todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
  }

  deleteTodo(id: number) {
    this.todos = this.todos.filter(todo => todo.id !== id);
  }

  setFilter(filter: Filter) {
    this.filter = filter;
  }

  handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.addTodo();
    }
  }

  override render() {
    return html`
      <style>${todoStyles}</style>
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
          class="${() => this.filter === 'all' ? 'filter-btn active' : 'filter-btn'}"
          @click=${() => this.setFilter('all')}
        >
          All
        </button>
        <button 
          class="${() => this.filter === 'active' ? 'filter-btn active' : 'filter-btn'}"
          @click=${() => this.setFilter('active')}
        >
          Active
        </button>
        <button 
          class="${() => this.filter === 'completed' ? 'filter-btn active' : 'filter-btn'}"
          @click=${() => this.setFilter('completed')}
        >
          Completed
        </button>
      </div>
      
      ${() => {
        const filtered = this.filteredTodos;
        if (filtered.length === 0) {
          return html`
            <div class="empty-state">
              ${this.filter === 'all' 
                ? 'No todos yet. Add one above!' 
                : `No ${this.filter} todos.`}
            </div>
          `;
        }
        
        return html`
          <ul class="todo-list">
            ${filtered.map(todo => html(todo.id)`
              <li class="${todo.completed ? 'todo-item completed' : 'todo-item'}">
                <div 
                  class="${todo.completed ? 'checkbox checked' : 'checkbox'}"
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
            `)}
          </ul>
        `;
      }}
      
      ${() => this.todos.length > 0 ? html`
        <div class="stats">
          <span>${this.activeCount} active</span>
          <span>${this.completedCount} completed</span>
          <span>${this.todos.length} total</span>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('todo-list', TodoList);
