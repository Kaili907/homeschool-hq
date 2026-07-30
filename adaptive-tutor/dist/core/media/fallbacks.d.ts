import type { MediaFallback, SpokenTurn } from "../contracts/index.js";
export declare const defaultMediaFallback: MediaFallback;
export interface VoiceCapability {
    available: boolean;
    reason: "available" | "missing-api" | "disabled" | "error";
}
export declare function getVoiceFallback(turn: SpokenTurn, capability: VoiceCapability): string;
//# sourceMappingURL=fallbacks.d.ts.map