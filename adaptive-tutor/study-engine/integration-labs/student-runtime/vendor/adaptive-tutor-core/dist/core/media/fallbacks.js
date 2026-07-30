export const defaultMediaFallback = {
    missingVisualText: "The teaching board will show a text-and-shape explanation. The learning step remains available without an image or video.",
    missingAudioText: "Audio is unavailable. Read the same words in the visible caption or transcript and continue at your own pace.",
    visualAlternativeCommandsAllowed: true,
    captionsAlwaysVisible: true,
    transcriptAlwaysAvailable: true,
    lessonMayContinueWithoutMedia: true,
};
export function getVoiceFallback(turn, capability) {
    return capability.available ? turn.text : `${turn.fallbackText} (${capability.reason})`;
}
//# sourceMappingURL=fallbacks.js.map