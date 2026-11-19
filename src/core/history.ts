/** An action that can be undone and redone. */
export interface Command {
  label: string;
  undo(): void;
  redo(): void;
}

/**
 * Undo/redo stack. Actions are performed by the caller first,
 * then pushed here so they can be undone later.
 */
export class History {
  private done: Command[] = [];
  private undone: Command[] = [];
  private readonly limit: number;

  constructor(limit = 200) {
    this.limit = limit;
  }

  push(command: Command): void {
    this.done.push(command);
    if (this.done.length > this.limit) this.done.shift();
    this.undone = [];
  }

  /** The most recent command (used to merge quick repeated edits). */
  last(): Command | undefined {
    return this.done[this.done.length - 1];
  }

  undo(): Command | null {
    const command = this.done.pop();
    if (!command) return null;
    command.undo();
    this.undone.push(command);
    return command;
  }

  redo(): Command | null {
    const command = this.undone.pop();
    if (!command) return null;
    command.redo();
    this.done.push(command);
    return command;
  }

  clear(): void {
    this.done = [];
    this.undone = [];
  }
}
