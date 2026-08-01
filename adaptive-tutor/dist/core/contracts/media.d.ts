import { type Static } from "../schema/typebox.js";
export declare const CaptionCueSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    text: string;
    speaker: "jarvis" | "learner" | "narrator";
    startMs: number;
    endMs: number;
} & {}>;
export declare const TranscriptTurnSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    text: string;
    speaker: "jarvis" | "learner" | "system";
    containsIdentifyingInformation: false;
    visibleToLearner: boolean;
} & {}>;
export declare const NarrationTrackSchema: import("../schema/typebox.js").TSchema<{
    id: string;
    text: string;
    locale: string;
    audioUri: string | null;
    captions: ({
        id: string;
        text: string;
        speaker: "jarvis" | "learner" | "narrator";
        startMs: number;
        endMs: number;
    } & {})[];
    transcript: ({
        id: string;
        text: string;
        speaker: "jarvis" | "learner" | "system";
        containsIdentifyingInformation: false;
        visibleToLearner: boolean;
    } & {})[];
    voiceRequired: false;
    mediaRequired: false;
} & {}>;
export declare const MediaFallbackSchema: import("../schema/typebox.js").TSchema<{
    visualAlternativeCommandsAllowed: true;
    captionsAlwaysVisible: true;
    transcriptAlwaysAvailable: true;
    lessonMayContinueWithoutMedia: true;
    missingVisualText: string;
    missingAudioText: string;
} & {}>;
export type CaptionCue = Static<typeof CaptionCueSchema>;
export type TranscriptTurn = Static<typeof TranscriptTurnSchema>;
export type NarrationTrack = Static<typeof NarrationTrackSchema>;
export type MediaFallback = Static<typeof MediaFallbackSchema>;
//# sourceMappingURL=media.d.ts.map