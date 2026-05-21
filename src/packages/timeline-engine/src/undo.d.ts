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
export declare function createUndoStack<T>(): UndoStack<T>;
//# sourceMappingURL=undo.d.ts.map