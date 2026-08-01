import { Type, type Static } from "../schema/typebox.js";
import { LocaleSchema, StableIdSchema } from "./common.js";

export const CaptionCueSchema = Type.Object(
  {
    id: StableIdSchema,
    startMs: Type.Integer({ minimum: 0 }),
    endMs: Type.Integer({ minimum: 1 }),
    text: Type.String({ minLength: 1, maxLength: 1000 }),
    speaker: Type.Union([Type.Literal("jarvis"), Type.Literal("learner"), Type.Literal("narrator")]),
  },
  { additionalProperties: false },
);

export const TranscriptTurnSchema = Type.Object(
  {
    id: StableIdSchema,
    speaker: Type.Union([Type.Literal("jarvis"), Type.Literal("learner"), Type.Literal("system")]),
    text: Type.String({ minLength: 1, maxLength: 4000 }),
    visibleToLearner: Type.Boolean(),
    containsIdentifyingInformation: Type.Literal(false),
  },
  { additionalProperties: false },
);

export const NarrationTrackSchema = Type.Object(
  {
    id: StableIdSchema,
    locale: LocaleSchema,
    text: Type.String({ minLength: 1, maxLength: 10000 }),
    audioUri: Type.Union([Type.String({ minLength: 1, maxLength: 1000 }), Type.Null()]),
    captions: Type.Array(CaptionCueSchema, { minItems: 1, maxItems: 500 }),
    transcript: Type.Array(TranscriptTurnSchema, { minItems: 1, maxItems: 500 }),
    voiceRequired: Type.Literal(false),
    mediaRequired: Type.Literal(false),
  },
  { additionalProperties: false, $id: "NarrationCaptionTranscript" },
);

export const MediaFallbackSchema = Type.Object(
  {
    missingVisualText: Type.String({ minLength: 1, maxLength: 1600 }),
    missingAudioText: Type.String({ minLength: 1, maxLength: 1600 }),
    visualAlternativeCommandsAllowed: Type.Literal(true),
    captionsAlwaysVisible: Type.Literal(true),
    transcriptAlwaysAvailable: Type.Literal(true),
    lessonMayContinueWithoutMedia: Type.Literal(true),
  },
  { additionalProperties: false, $id: "MediaFallback" },
);

export type CaptionCue = Static<typeof CaptionCueSchema>;
export type TranscriptTurn = Static<typeof TranscriptTurnSchema>;
export type NarrationTrack = Static<typeof NarrationTrackSchema>;
export type MediaFallback = Static<typeof MediaFallbackSchema>;
