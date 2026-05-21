import { MusicIrSchema, type MusicIr } from "./schema";

export function migrateMusicIr(input: unknown): MusicIr {
  return MusicIrSchema.parse(input);
}
