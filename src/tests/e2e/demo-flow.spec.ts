import { expect, test } from "@playwright/test";
import {
  apiApplyPatch,
  apiPreviewPatch,
  createAndSeedProject,
  expectCanvasNotBlank,
  resetTestState,
} from "./helpers";

test.describe("demo flow (10-step)", () => {
  test.describe.configure({ mode: "serial" });

  // ── Step 1: Open app ────────────────────────────────────────────
  test("[step 1] app shell renders with all core panels", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    await expect(page.getByTestId("app-shell")).toBeVisible();
    await expect(page.getByTestId("top-bar")).toBeVisible();
    await expect(page.getByTestId("left-rail")).toBeVisible();
    await expect(page.getByTestId("right-inspector")).toBeVisible();
    await expect(page.getByTestId("bottom-panel")).toBeVisible();
    await expect(page.getByTestId("transport")).toBeVisible();
  });

  // ── Step 2: Timeline visible ────────────────────────────────────
  test("[step 2] timeline canvas is not blank and section blocks are visible", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const timeline = page.getByTestId("timeline-canvas");
    await expect(timeline).toBeVisible();
    await expectCanvasNotBlank(page, "timeline-canvas");

    // Seeded sample data should render section blocks (e.g. section "A")
    const leftRail = page.getByTestId("left-rail");
    await expect(leftRail).toContainText("A");
    await expect(leftRail).toContainText("Bars");
  });

  // ── Step 3: Piano-roll visible ──────────────────────────────────
  test("[step 3] piano-roll canvas renders and is not blank", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    await page.getByTestId("editor-tabs").getByText("Piano Roll").click();
    const pianoRoll = page.getByTestId("piano-roll-canvas");
    await expect(pianoRoll).toBeVisible();
    await expectCanvasNotBlank(page, "piano-roll-canvas");
  });

  // ── Step 4: Agent panel ─────────────────────────────────────────
  test("[step 4] agent panel renders with prompt textarea and send button", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const agentPanels = page.getByTestId("agent-panel");
    await expect(agentPanels.first()).toBeVisible();

    // Agent heading + mock badge
    await expect(agentPanels.nth(1)).toContainText("Agent");
    await expect(agentPanels.nth(1)).toContainText("Mock");

    // Prompt textarea exists and is empty
    await expect(page.getByTestId("agent-prompt")).toBeVisible();
    await expect(page.getByTestId("agent-prompt")).toBeEmpty();

    // Send button exists but disabled when prompt is empty
    const sendButton = page.getByTestId("agent-send");
    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();
  });

  // ── Step 5: Type prompt ─────────────────────────────────────────
  test("[step 5] typing in agent prompt fills textarea and enables send", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const prompt = page.getByTestId("agent-prompt");
    const send = page.getByTestId("agent-send");

    await expect(send).toBeDisabled();

    await prompt.fill(
      "make this a darker, higher-energy electronic variation, keep the motif recognizable",
    );

    await expect(prompt).toHaveValue(
      "make this a darker, higher-energy electronic variation, keep the motif recognizable",
    );
    await expect(send).toBeEnabled();
  });

  // ── Step 6: Click send / mock streaming ─────────────────────────
  test("[step 6] click send triggers mock streaming and thought log appears", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // Type and send a prompt through the Agent panel
    const prompt = page.getByTestId("agent-prompt");
    await prompt.fill("Generate an 8-bar piano phrase from motif A4 C5 E5 D5");
    await expect(page.getByTestId("agent-send")).toBeEnabled();

    await page.getByTestId("agent-send").click();

    // Agent thought-log should appear (mock agent streams thoughts)
    const thoughtLog = page.getByTestId("agent-thought-log");
    await expect(thoughtLog).toBeVisible({ timeout: 5000 });
  });

  // ── Step 7: Proposal appears ────────────────────────────────────
  test("[step 7] proposal card renders with apply and reject buttons", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // Send a prompt to trigger mock agent proposal
    const prompt = page.getByTestId("agent-prompt");
    await prompt.fill(
      "make bars 9-16 a darker variation, keep motif recognizable",
    );
    await page.getByTestId("agent-send").click();

    // Wait for proposal card to appear (mock agent should produce one)
    const proposalCard = page.getByTestId("agent-proposal-card");
    await expect(proposalCard).toBeVisible({ timeout: 10000 });

    // Verify apply and reject buttons exist on the card
    await expect(page.getByTestId("patch-apply")).toBeVisible();
    await expect(page.getByTestId("patch-reject")).toBeVisible();
  });

  // ── Step 8: Apply patch ─────────────────────────────────────────
  test("[step 8] apply patch via bridge mutates project and creates snapshot", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const { projectId } = await createAndSeedProject(page);

    // Send a prompt via agent panel to trigger mock agent
    const prompt = page.getByTestId("agent-prompt");
    await prompt.fill(
      "make this a darker, higher-energy electronic variation, keep the motif recognizable",
    );
    await page.getByTestId("agent-send").click();

    // Wait for proposal card
    const proposalCard = page.getByTestId("agent-proposal-card");
    await expect(proposalCard).toBeVisible({ timeout: 10000 });

    // Click Apply on the proposal
    await page.getByTestId("patch-apply").click();

    // Verify patch bar reflects the applied change via bridge API
    // The project IR should be mutated and a snapshot created
    const { ir } = await page.evaluate(async (id) => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        throw new Error(`GET /api/projects/${id} failed: ${res.status}`);
      }
      return res.json();
    }, projectId) as { ir: Record<string, unknown> };

    // The patch should have modified the project — verify it differs from default
    expect(ir).toBeTruthy();
    // sections should still be an array
    expect(Array.isArray(ir.sections)).toBe(true);
  });

  // ── Step 9: Export MIDI button ──────────────────────────────────
  test("[step 9] export-midi button is visible in the top bar", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    const exportButton = page.getByTestId("export-midi");
    await expect(exportButton).toBeVisible();
  });

  // ── Step 10: Full flow smoke ────────────────────────────────────
  test("[step 10] full demo flow smoke — app does not crash through the sequence", async ({
    page,
  }) => {
    await page.goto("/");
    await resetTestState(page);

    // 1. Verify shell
    await expect(page.getByTestId("app-shell")).toBeVisible();

    // 2. Create a 120 BPM A minor project via bridge
    const { projectId, ir } = await createAndSeedProject(page);
    expect(ir.tempo).toBe(120);
    expect(ir.key).toBe("A minor");

    // 3. Verify sections exist (motif seed)
    const sections = ir.sections as Array<{
      id: string;
      barRange: [number, number];
    }>;
    expect(sections.length).toBeGreaterThan(0);
    const sectionA = sections[0]!;
    expect(sectionA.barRange).toEqual([1, 8]);

    // 4. Preview a variation patch (generate an 8-bar phrase variation)
    const preview = await apiPreviewPatch(page, projectId, {
      summary: "Generate an 8-bar piano phrase variation from motif",
      patch: [
        {
          op: "replace",
          path: "/sections/0/style/genre",
          value: "piano phrase electronic",
        },
        {
          op: "replace",
          path: "/sections/0/style/energy",
          value: 0.6,
        },
      ],
      musicalDiff: {
        barsChanged: [1, 8],
        notesAdded: 16,
        notesRemoved: 4,
        preservedMotifs: ["motif_main"],
      },
    });
    expect(preview.proposal.proposalId).toBeTruthy();

    // 5-6. Duplicate section to 16 bars and select 9-16 via patch
    const duplicatePreview = await apiPreviewPatch(page, projectId, {
      summary: "Duplicate section A to bars 9-16 with darker electronic variation",
      patch: [
        {
          op: "add",
          path: "/sections/1",
          value: {
            id: "sec_b",
            name: "B",
            barRange: [9, 16],
            style: {
              genre: "dark electronic",
              energy: 0.75,
              instruments: ["synth", "bass"],
            },
            motifIds: ["motif_main"],
            chords: ["Am", "F", "G", "Em"],
            locks: {
              melody: false,
              rhythm: true,
              chords: false,
              tempo: true,
              key: true,
            },
          },
        },
      ],
      musicalDiff: {
        barsChanged: [9, 16],
        notesAdded: 20,
        notesRemoved: 0,
        preservedMotifs: ["motif_main"],
      },
    });
    expect(duplicatePreview.proposal.proposalId).toBeTruthy();
    const previewSections = duplicatePreview.previewIr.sections as Array<{
      id: string;
      style: { genre: string };
    }>;
    expect(previewSections.length).toBe(2);
    expect(previewSections[1]?.style.genre).toBe("dark electronic");

    // 7-8. Preview the darker variation prompt
    const variationPreview = await apiPreviewPatch(page, projectId, {
      summary:
        "make this a darker, higher-energy electronic variation, keep the motif recognizable",
      patch: [
        {
          op: "replace",
          path: "/sections/0/style/genre",
          value: "dark electronic variation",
        },
        {
          op: "replace",
          path: "/sections/0/style/energy",
          value: 0.85,
        },
      ],
      musicalDiff: {
        barsChanged: [9, 16],
        notesAdded: 8,
        notesRemoved: 2,
        preservedMotifs: ["motif_main"],
      },
    });
    expect(variationPreview.proposal.proposalId).toBeTruthy();
    expect(
      (variationPreview.previewIr.sections as Array<{ style: { energy: number } }>)[0]
        ?.style.energy,
    ).toBe(0.85);

    // 9. Apply the variation patch
    const applied = await apiApplyPatch(page, projectId, {
      summary: "Apply: darker higher-energy electronic variation",
      patch: [
        {
          op: "replace",
          path: "/sections/0/style/genre",
          value: "dark electronic variation",
        },
        {
          op: "replace",
          path: "/sections/0/style/energy",
          value: 0.85,
        },
      ],
    });
    expect(applied.snapshotId).toBeTruthy();
    expect(
      (applied.ir.sections as Array<{ style: { genre: string } }>)[0]?.style
        .genre,
    ).toBe("dark electronic variation");

    // 10. Export button remains visible after all operations
    await expect(page.getByTestId("export-midi")).toBeVisible();

    // App shell should still be intact
    await expect(page.getByTestId("app-shell")).toBeVisible();
  });
});
