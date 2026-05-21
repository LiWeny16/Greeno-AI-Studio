/**
 * Generic undo/redo stack for timeline engine commands.
 *
 * All mutations go through EditCommand or IrPatchProposal objects,
 * so this stack stores opaque command payloads of type T.
 */
export function createUndoStack() {
    let history = [];
    let position = -1;
    function pushCommand(command) {
        // Discard any commands after the current position (redo history).
        history = history.slice(0, position + 1);
        history.push(command);
        position = history.length - 1;
    }
    function undo() {
        if (position < 0)
            return null;
        const command = history[position];
        position -= 1;
        return command;
    }
    function redo() {
        if (position >= history.length - 1)
            return null;
        position += 1;
        return history[position];
    }
    function canUndo() {
        return position >= 0;
    }
    function canRedo() {
        return position < history.length - 1;
    }
    return { pushCommand, undo, redo, canUndo, canRedo };
}
