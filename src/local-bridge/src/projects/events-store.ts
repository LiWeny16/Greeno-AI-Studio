import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { ProjectEventSchema, type ProjectEvent } from "@cc-music/music-ir";
import type { BridgeConfig } from "../config";
import { projectLayout } from "./project-layout";
import { projectDir } from "./utils";
import { withWriteLock } from "./write-lock";

export async function appendEvent(
  config: BridgeConfig,
  projectId: string,
  event: ProjectEvent,
): Promise<void> {
  return withWriteLock(projectId, async () => {
    ProjectEventSchema.parse(event);

    if (event.projectId !== projectId) {
      throw Object.assign(new Error("Event projectId does not match target projectId"), {
        statusCode: 400,
      });
    }

    const dir = projectDir(config, projectId);
    const eventsPath = path.join(dir, projectLayout.events);
    await appendFile(eventsPath, JSON.stringify(event) + "\n", "utf-8");
  });
}

export async function readEvents(
  config: BridgeConfig,
  projectId: string,
): Promise<ProjectEvent[]> {
  const dir = projectDir(config, projectId);
  const eventsPath = path.join(dir, projectLayout.events);

  let raw: string;
  try {
    raw = await readFile(eventsPath, "utf-8");
  } catch {
    return [];
  }

  const events: ProjectEvent[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const parsed = ProjectEventSchema.parse(JSON.parse(trimmed));
      events.push(parsed);
    } catch {
      // skip unparseable lines
    }
  }

  return events;
}
