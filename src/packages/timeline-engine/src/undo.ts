/**
 * Generic undo/redo stack for timeline engine commands.
 *
 * All mutations go through EditCommand or IrPatchProposal objects,
 * so this stack stores opaque command payloads of type T.
 */

export interface UndoStack<T> {
  /** Push a new command onto the stack, discarding any redo history. */
  pushCommand(command: T): void;
  /** Move backward one step and return the undone command, or null. */
  undo(): T | null;
  /** Move forward one step and return the redone command, or null. */
  redo(): T | null;
  /** Whether there is at least one undoable command. */
  canUndo(): boolean;
  /** Whether there is at least one redoable command. */
  canRedo(): boolean;
}

export function createUndoStack<T>(): UndoStack<T> {
  let history: T[] = [];
  let position = -1;

  function pushCommand(command: T): void {
    // Discard any commands after the current position (redo history).
    history = history.slice(0, position + 1);
    history.push(command);
    position = history.length - 1;
  }

  function undo(): T | null {
    if (position < 0) return null;
    const command = history[position]!;
    position -= 1;
    return command;
  }

  function redo(): T | null {
    if (position >= history.length - 1) return null;
    position += 1;
    return history[position]!;
  }

  function canUndo(): boolean {
    return position >= 0;
  }

  function canRedo(): boolean {
    return position < history.length - 1;
  }

  return { pushCommand, undo, redo, canUndo, canRedo };
}
