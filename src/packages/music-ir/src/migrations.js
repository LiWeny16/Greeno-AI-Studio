import { MusicIrSchema } from "./schema";
export function migrateMusicIr(input) {
    return MusicIrSchema.parse(input);
}
