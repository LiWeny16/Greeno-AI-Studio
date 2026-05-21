import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "./client";
import type {
  MusicIr,
  ProjectManifest,
  IrPatchProposal,
} from "./types";

// ---------------------------------------------------------------------------
// Project hooks
// ---------------------------------------------------------------------------

export function useProject(projectId: string) {
  return useQuery<MusicIr>({
    queryKey: ["project", projectId],
    queryFn: () => get<MusicIr>(`/projects/${encodeURIComponent(projectId)}`),
    enabled: !!projectId,
  });
}

export function useProjectList() {
  return useQuery<ProjectManifest[]>({
    queryKey: ["projects"],
    queryFn: () => get<ProjectManifest[]>("/projects"),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation<ProjectManifest, Error, Pick<ProjectManifest, "title">>({
    mutationFn: (input) => post<ProjectManifest>("/projects", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProjectIr(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<MusicIr, Error, MusicIr>({
    mutationFn: (ir) =>
      put<MusicIr>(`/projects/${encodeURIComponent(projectId)}/ir`, ir),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Snapshot hooks
// ---------------------------------------------------------------------------

interface SnapshotMeta {
  snapshotId: string;
  projectId: string;
  createdAt: string;
  label?: string;
}

export function useSnapshots(projectId: string) {
  return useQuery<SnapshotMeta[]>({
    queryKey: ["snapshots", projectId],
    queryFn: () =>
      get<SnapshotMeta[]>(
        `/projects/${encodeURIComponent(projectId)}/snapshots`,
      ),
    enabled: !!projectId,
  });
}

export function useCreateSnapshot(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<SnapshotMeta, Error, { label?: string } | void>({
    mutationFn: (input) =>
      post<SnapshotMeta>(
        `/projects/${encodeURIComponent(projectId)}/snapshots`,
        input ?? {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots", projectId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Event hooks
// ---------------------------------------------------------------------------

interface ProjectEvent {
  eventId: string;
  projectId: string;
  actor: { type: string };
  type: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export function useProjectEvents(projectId: string) {
  return useQuery<ProjectEvent[]>({
    queryKey: ["events", projectId],
    queryFn: () =>
      get<ProjectEvent[]>(
        `/projects/${encodeURIComponent(projectId)}/events`,
      ),
    enabled: !!projectId,
  });
}

// ---------------------------------------------------------------------------
// Patch hooks
// ---------------------------------------------------------------------------

export function usePreviewPatch(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<IrPatchProposal, Error, IrPatchProposal>({
    mutationFn: (patch) =>
      post<IrPatchProposal>(
        `/projects/${encodeURIComponent(projectId)}/patches/preview`,
        patch,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useApplyPatch(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<MusicIr, Error, { proposalId: string }>({
    mutationFn: (input) =>
      post<MusicIr>(
        `/projects/${encodeURIComponent(projectId)}/patches/apply`,
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["snapshots", projectId] });
      queryClient.invalidateQueries({ queryKey: ["events", projectId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Agent hooks
// ---------------------------------------------------------------------------

interface AgentMessageInput {
  agent: "mock" | "codex" | "claude";
  prompt: string;
  selection?: {
    barRange?: [number, number];
    sectionIds?: string[];
    trackIds?: string[];
  };
  snapshotId?: string;
  allowedActions?: string[];
}

interface AgentMessageResult {
  requestId: string;
  sessionId: string;
  status: "queued" | "running" | "completed" | "failed";
}

export function useAgentMessage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<AgentMessageResult, Error, AgentMessageInput>({
    mutationFn: (input) =>
      post<AgentMessageResult>(
        `/projects/${encodeURIComponent(projectId)}/agent/messages`,
        input,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useAgentStream(
  _projectId: string,
  _sessionId: string,
) {
  // WebSocket subscription placeholder.
  // Real implementation subscribes to ws:// bridge and updates query cache.
  // For MVP, return a stable reference so consumers can check for connectivity.
  return { ready: false, subscribe: () => () => {} };
}

// ---------------------------------------------------------------------------
// System hooks
// ---------------------------------------------------------------------------

interface Capabilities {
  midiImport: boolean;
  midiExport: boolean;
  agentMock: boolean;
  agentClaude: boolean;
  agentCodex: boolean;
  basicPitch: boolean;
  fluidSynth: boolean;
}

export function useCapabilities() {
  return useQuery<Capabilities>({
    queryKey: ["capabilities"],
    queryFn: () => get<Capabilities>("/system/capabilities"),
    staleTime: 60_000,
  });
}
