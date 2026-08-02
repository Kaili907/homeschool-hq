import type { MediaFallback, SpokenTurn } from "../contracts/index.js";

export const defaultMediaFallback: MediaFallback = {
  missingVisualText:
    "The teaching board will show a text-and-shape explanation. The learning step remains available without an image or video.",
  missingAudioText:
    "Audio is unavailable. Read the same words in the visible caption or transcript and continue at your own pace.",
  visualAlternativeCommandsAllowed: true,
  captionsAlwaysVisible: true,
  transcriptAlwaysAvailable: true,
  lessonMayContinueWithoutMedia: true,
};

export interface VoiceCapability {
  available: boolean;
  reason: "available" | "missing-api" | "disabled" | "error";
}

export function getVoiceFallback(turn: SpokenTurn, capability: VoiceCapability): string {
  return capability.available ? turn.text : `${turn.fallbackText} (${capability.reason})`;
}
