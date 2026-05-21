import { describe, it, expect } from "vitest";
import { createUndoStack } from "./undo";
import type { UndoStack } from "./undo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A simple command type for testing the generi undo stack. */
interface TestCommand {
  id: string;
  type: string;
  data: unknown;
}

const cmd = (id: string, type = "test"): TestCommand => ({
  id,
  type,
  data: { id },
});

// ---------------------------------------------------------------------------
// createUndoStack
// ---------------------------------------------------------------------------

describe("createUndoStack", () => {
  it("returns an object implementing UndoStack interface", () => {
    const stack = createUndoStack<TestCommand>();
    expect(stack).toHaveProperty("pushCommand");
    expect(stack).toHaveProperty("undo");
    expect(stack).toHaveProperty("redo");
    expect(stack).toHaveProperty("canUndo");
    expect(stack).toHaveProperty("canRedo");
  });

  it("works with primitive types", () => {
    const stack = createUndoStack<string>();
    stack.pushCommand("a");
    stack.pushCommand("b");
    expect(stack.undo()).toBe("b");
    expect(stack.undo()).toBe("a");
  });

  it("works with number types", () => {
    const stack = createUndoStack<number>();
    stack.pushCommand(1);
    stack.pushCommand(42);
    expect(stack.undo()).toBe(42);
    expect(stack.undo()).toBe(1);
  });

  it("works with complex object types", () => {
    const stack = createUndoStack<{ name: string; value: number }>();
    stack.pushCommand({ name: "x", value: 100 });
    expect(stack.undo()?.name).toBe("x");
  });
});

// ---------------------------------------------------------------------------
// pushCommand
// ---------------------------------------------------------------------------

describe("pushCommand", () => {
  it("adds a command to the stack", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
  });

  it("accepts multiple pushes in sequence", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.pushCommand(cmd("C"));
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
  });

  it("discards redo history when pushed after undo", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.pushCommand(cmd("C"));

    // Go back to A
    expect(stack.undo()).toEqual(cmd("C"));
    expect(stack.undo()).toEqual(cmd("B"));

    // Push new command — this should discard C in redo history
    stack.pushCommand(cmd("X"));

    // Redo should be empty after push
    expect(stack.canRedo()).toBe(false);

    // History should now be [A, X]
    expect(stack.undo()).toEqual(cmd("X"));
    expect(stack.undo()).toEqual(cmd("A"));
    expect(stack.undo()).toBeNull();
  });

  it("discards entire redo history when pushing after any undo depth", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.pushCommand(cmd("C"));
    stack.pushCommand(cmd("D"));

    // Undo all to the beginning
    expect(stack.undo()).toEqual(cmd("D"));
    expect(stack.undo()).toEqual(cmd("C"));
    expect(stack.undo()).toEqual(cmd("B"));
    expect(stack.undo()).toEqual(cmd("A"));
    expect(stack.undo()).toBeNull();

    // Push new command
    stack.pushCommand(cmd("Z"));
    expect(stack.canRedo()).toBe(false);
    expect(stack.undo()).toEqual(cmd("Z"));
    expect(stack.undo()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// undo
// ---------------------------------------------------------------------------

describe("undo", () => {
  it("returns null on an empty stack", () => {
    const stack = createUndoStack<TestCommand>();
    expect(stack.undo()).toBeNull();
  });

  it("returns the most recently pushed command", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    expect(stack.undo()).toEqual(cmd("B"));
  });

  it("returns commands in LIFO order", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.pushCommand(cmd("C"));

    expect(stack.undo()).toEqual(cmd("C"));
    expect(stack.undo()).toEqual(cmd("B"));
    expect(stack.undo()).toEqual(cmd("A"));
  });

  it("returns null when all commands have been undone", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.undo();
    expect(stack.undo()).toBeNull();
    expect(stack.canUndo()).toBe(false);
  });

  it("returns null after repeated undo on empty stack", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.undo(); // returns A
    expect(stack.undo()).toBeNull();
    expect(stack.undo()).toBeNull(); // still null, no error
  });

  it("allows redo after undo", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));

    expect(stack.undo()).toEqual(cmd("B"));
    expect(stack.canRedo()).toBe(true);
    expect(stack.redo()).toEqual(cmd("B"));
  });

  it("preserves exact object references in returned commands", () => {
    const stack = createUndoStack<TestCommand>();
    const command = cmd("exact");
    stack.pushCommand(command);
    expect(stack.undo()).toBe(command);
  });
});

// ---------------------------------------------------------------------------
// redo
// ---------------------------------------------------------------------------

describe("redo", () => {
  it("returns null on an empty stack", () => {
    const stack = createUndoStack<TestCommand>();
    expect(stack.redo()).toBeNull();
  });

  it("returns null when no undo has been performed", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    expect(stack.redo()).toBeNull();
    expect(stack.canRedo()).toBe(false);
  });

  it("returns the command after undo", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.undo(); // undo B
    expect(stack.redo()).toEqual(cmd("B"));
  });

  it("returns commands in the reverse undo order", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.pushCommand(cmd("C"));

    // Undo all three
    stack.undo(); // undoes C
    stack.undo(); // undoes B
    stack.undo(); // undoes A

    // Redo in reverse
    expect(stack.redo()).toEqual(cmd("A"));
    expect(stack.redo()).toEqual(cmd("B"));
    expect(stack.redo()).toEqual(cmd("C"));
  });

  it("returns null when all redos are exhausted", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.undo();
    stack.redo(); // consumes the only redo
    expect(stack.redo()).toBeNull();
    expect(stack.canRedo()).toBe(false);
  });

  it("returns null after repeated redo on exhausted stack", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.undo();
    stack.redo(); // returns B, position now at end
    expect(stack.redo()).toBeNull();
    expect(stack.redo()).toBeNull(); // still null
  });

  it("redoes exactly the same object reference", () => {
    const stack = createUndoStack<TestCommand>();
    const command = cmd("ref-test");
    stack.pushCommand(command);
    stack.undo();
    expect(stack.redo()).toBe(command);
  });
});

// ---------------------------------------------------------------------------
// canUndo / canRedo
// ---------------------------------------------------------------------------

describe("canUndo", () => {
  it("returns false on empty stack", () => {
    const stack = createUndoStack<TestCommand>();
    expect(stack.canUndo()).toBe(false);
  });

  it("returns true after pushCommand", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    expect(stack.canUndo()).toBe(true);
  });

  it("returns false after undoing all commands", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.undo();
    expect(stack.canUndo()).toBe(false);
  });

  it("returns true after redo restores a command", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.undo();
    stack.redo();
    expect(stack.canUndo()).toBe(true);
  });

  it("returns false after pushCommand clears redo history and full undo", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.undo(); // undo B
    stack.pushCommand(cmd("C")); // discards redo (B), push C
    stack.undo(); // undo C
    expect(stack.canUndo()).toBe(true); // A still there
    stack.undo(); // undo A
    expect(stack.canUndo()).toBe(false);
  });
});

describe("canRedo", () => {
  it("returns false on empty stack", () => {
    const stack = createUndoStack<TestCommand>();
    expect(stack.canRedo()).toBe(false);
  });

  it("returns false after pushCommand with no undo", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    expect(stack.canRedo()).toBe(false);
  });

  it("returns true after undo", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.undo();
    expect(stack.canRedo()).toBe(true);
  });

  it("returns false after redo exhausts history", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.undo();
    stack.redo();
    expect(stack.canRedo()).toBe(false);
  });

  it("returns false after pushCommand clears redo history", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.undo(); // undo B — now redo has B
    expect(stack.canRedo()).toBe(true);
    stack.pushCommand(cmd("C")); // pushes C, discards redo
    expect(stack.canRedo()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full undo/redo cycles
// ---------------------------------------------------------------------------

describe("undo/redo cycles", () => {
  it("handles multiple undo/redo cycles", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.pushCommand(cmd("C"));

    // Cycle 1
    expect(stack.undo()).toEqual(cmd("C"));
    expect(stack.redo()).toEqual(cmd("C"));

    // Cycle 2
    expect(stack.undo()).toEqual(cmd("C"));
    expect(stack.undo()).toEqual(cmd("B"));
    expect(stack.redo()).toEqual(cmd("B"));
    expect(stack.redo()).toEqual(cmd("C"));
  });

  it("handles interleaved undo/redo without data loss", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));

    stack.undo(); // back to A
    stack.redo(); // forward to B
    stack.undo(); // back to A
    stack.redo(); // forward to B

    // B should still be there
    expect(stack.undo()).toEqual(cmd("B"));
    expect(stack.undo()).toEqual(cmd("A"));
    expect(stack.undo()).toBeNull();
  });

  it("returns correct commands after deep undo + partial redo", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.pushCommand(cmd("C"));
    stack.pushCommand(cmd("D"));

    // Undo 3
    stack.undo(); // undo D
    stack.undo(); // undo C
    stack.undo(); // undo B (now at A, canRedo: B, C, D)

    // Redo 1
    expect(stack.redo()).toEqual(cmd("B"));
    expect(stack.canRedo()).toBe(true); // C and D still redoable
    expect(stack.undo()).toEqual(cmd("B"));
    expect(stack.undo()).toEqual(cmd("A"));
    expect(stack.undo()).toBeNull();
  });

  it("handles 100 pushes, undo all, redo all", () => {
    const stack = createUndoStack<TestCommand>();
    const count = 100;
    for (let i = 0; i < count; i++) {
      stack.pushCommand(cmd(`cmd-${i}`));
    }

    // Undo all
    for (let i = count - 1; i >= 0; i--) {
      expect(stack.undo()).toEqual(cmd(`cmd-${i}`));
    }
    expect(stack.undo()).toBeNull();
    expect(stack.canUndo()).toBe(false);

    // Redo all
    for (let i = 0; i < count; i++) {
      expect(stack.redo()).toEqual(cmd(`cmd-${i}`));
    }
    expect(stack.redo()).toBeNull();
    expect(stack.canRedo()).toBe(false);
  });

  it("push after partial undo discards redo history correctly", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    stack.pushCommand(cmd("B"));
    stack.pushCommand(cmd("C"));
    stack.pushCommand(cmd("D"));

    // Undo to B (position after B, which is 1)
    stack.undo(); // undo D, position at 2
    stack.undo(); // undo C, position at 1

    // Push new — should keep [A, B, X]
    stack.pushCommand(cmd("X"));

    expect(stack.canRedo()).toBe(false);
    expect(stack.undo()).toEqual(cmd("X"));
    expect(stack.undo()).toEqual(cmd("B"));
    expect(stack.undo()).toEqual(cmd("A"));
    expect(stack.undo()).toBeNull();
  });

  it("maintains type safety with the pushed command type", () => {
    interface RichCommand {
      id: string;
      timestamp: number;
      payload: { value: number };
    }

    const stack = createUndoStack<RichCommand>();
    const c: RichCommand = {
      id: "r1",
      timestamp: Date.now(),
      payload: { value: 42 },
    };
    stack.pushCommand(c);

    const undone = stack.undo();
    // TypeScript should know this is RichCommand
    expect(undone?.payload.value).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("undo stack edge cases", () => {
  it("handles pushCommand with no prior commands", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("only"));
    expect(stack.undo()).toEqual(cmd("only"));
    expect(stack.redo()).toEqual(cmd("only"));
    expect(stack.undo()).toEqual(cmd("only"));
    expect(stack.undo()).toBeNull();
  });

  it("undo then redo then undo is idempotent for the same command", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("X"));
    stack.pushCommand(cmd("Y"));

    const firstUndo = stack.undo();
    const firstRedo = stack.redo();
    const secondUndo = stack.undo();

    expect(firstUndo).toEqual(firstRedo);
    expect(firstUndo).toEqual(secondUndo);
    expect(firstUndo).toEqual(cmd("Y"));
  });

  it("canUndo and canRedo are never both true on an empty stack", () => {
    const stack = createUndoStack<TestCommand>();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it("canUndo and canRedo are never both false after first push", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("A"));
    expect(stack.canUndo() || stack.canRedo()).toBe(true);
  });

  it("returns the same result when undoing all, redoing all, then repeating", () => {
    const stack = createUndoStack<TestCommand>();
    stack.pushCommand(cmd("1"));
    stack.pushCommand(cmd("2"));
    stack.pushCommand(cmd("3"));

    // First full undo/redo
    const undone1: (TestCommand | null)[] = [
      stack.undo(),
      stack.undo(),
      stack.undo(),
    ];
    const redone1: (TestCommand | null)[] = [
      stack.redo(),
      stack.redo(),
      stack.redo(),
    ];

    // Second full undo/redo
    const undone2: (TestCommand | null)[] = [
      stack.undo(),
      stack.undo(),
      stack.undo(),
    ];
    const redone2: (TestCommand | null)[] = [
      stack.redo(),
      stack.redo(),
      stack.redo(),
    ];

    expect(undone1).toEqual(undone2);
    expect(redone1).toEqual(redone2);
  });

  it("handles null commands (if allowed by type system)", () => {
    const stack = createUndoStack<TestCommand | null>();
    stack.pushCommand(null);
    expect(stack.canUndo()).toBe(true);
    expect(stack.undo()).toBeNull();
    expect(stack.canRedo()).toBe(true);
    expect(stack.redo()).toBeNull();
  });

  it("handles undefined commands", () => {
    const stack = createUndoStack<TestCommand | undefined>();
    stack.pushCommand(undefined);
    expect(stack.canUndo()).toBe(true);
    expect(stack.undo()).toBeUndefined();
  });
});
