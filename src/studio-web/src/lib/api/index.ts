export { ApiError, get, post, put, del, setBaseUrl, getBaseUrl } from "./client";
export { QueryProvider } from "./query-provider";
export {
  useProject,
  useProjectList,
  useCreateProject,
  useUpdateProjectIr,
  useSnapshots,
  useCreateSnapshot,
  useProjectEvents,
  usePreviewPatch,
  useApplyPatch,
  useAgentMessage,
  useAgentStream,
  useCapabilities,
} from "./hooks";
export type {
  MusicIr,
  Section,
  Track,
  Motif,
  Note,
  ProjectManifest,
  IrPatchProposal,
  AgentStreamEvent,
} from "./types";
