window.ENGLISH_DEMO_DATA = {
  "coreContractVersion": "0.2.0",
  "generatedFromValidatedTypeScript": true,
  "reading": {
    "lessonId": "english-decoding-multisyllable-words",
    "completedModuleName": "Decoding unfamiliar multisyllable words",
    "category": "reading",
    "classification": "PASS_DIRECT_CORE_V0_2",
    "program": {
      "id": "english-decoding-multisyllable-words",
      "version": "0.2.0",
      "title": "Decode Unfamiliar Multisyllable Words",
      "subject": "english",
      "gradeBand": {
        "min": 4,
        "max": 7,
        "label": "Grades 4–7"
      },
      "locale": "en-US",
      "targetSkillId": "english-decode-multisyllable-words",
      "skillGraph": {
        "id": "english-decoding-multisyllable-words-skill-graph",
        "version": "0.2.0",
        "nodes": [
          {
            "id": "english-identify-vowel-sounds",
            "title": "Identify vowel sounds",
            "description": "Locate likely vowel sounds that can anchor spoken syllables.",
            "subject": "english",
            "gradeBand": {
              "min": 2,
              "max": 5,
              "label": "Grades 2–5"
            },
            "observableEvidence": [
              "Marks at least one likely vowel sound in a printed word."
            ]
          },
          {
            "id": "english-recognize-common-affixes",
            "title": "Recognize common affixes",
            "description": "Recognize common prefixes and suffixes as meaningful word parts.",
            "subject": "english",
            "gradeBand": {
              "min": 3,
              "max": 6,
              "label": "Grades 3–6"
            },
            "observableEvidence": [
              "Identifies a familiar prefix or suffix in a new word."
            ]
          },
          {
            "id": "english-decode-multisyllable-words",
            "title": "Decode unfamiliar multisyllable words",
            "description": "Use meaningful parts, vowel patterns, blending, and a meaning check to decode an unfamiliar long word.",
            "subject": "english",
            "gradeBand": {
              "min": 4,
              "max": 7,
              "label": "Grades 4–7"
            },
            "observableEvidence": [
              "Marks useful prefixes, suffixes, bases, or syllable chunks.",
              "Blends chunks and checks whether the pronunciation makes sense in context."
            ]
          }
        ],
        "edges": [
          {
            "prerequisiteSkillId": "english-identify-vowel-sounds",
            "dependentSkillId": "english-decode-multisyllable-words",
            "strength": "required",
            "rationale": "Identify vowel sounds supplies a smaller step used in Decode Unfamiliar Multisyllable Words."
          },
          {
            "prerequisiteSkillId": "english-recognize-common-affixes",
            "dependentSkillId": "english-decode-multisyllable-words",
            "strength": "required",
            "rationale": "Recognize common affixes supplies a smaller step used in Decode Unfamiliar Multisyllable Words."
          }
        ]
      },
      "diagnosticItems": [
        {
          "id": "english-decoding-diagnostic-one",
          "skillId": "english-decode-multisyllable-words",
          "purpose": "diagnostic",
          "subject": "english",
          "gradeBand": {
            "min": 4,
            "max": 7,
            "label": "Grades 4–7"
          },
          "locale": "en-US",
          "prompt": "You meet the word ‘unpredictable.’ Which first move gives you the most useful information?",
          "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
          "maxAttempts": 1,
          "estimatedSeconds": 60,
          "tags": [
            "english",
            "diagnostic"
          ],
          "noCameraRequired": true,
          "identifyingInformationRequested": false,
          "kind": "multiple-choice",
          "options": [
            {
              "id": "english-decoding-d1-chunks",
              "text": "Mark un-, predict, and -able, then blend the parts."
            },
            {
              "id": "english-decoding-d1-guess",
              "text": "Guess a word that begins with unpr-."
            },
            {
              "id": "english-decoding-d1-letters",
              "text": "Say every letter name without grouping them."
            }
          ],
          "correctOptionIds": [
            "english-decoding-d1-chunks"
          ],
          "allowMultiple": false,
          "shuffle": false
        },
        {
          "id": "english-decoding-diagnostic-two",
          "skillId": "english-decode-multisyllable-words",
          "purpose": "diagnostic",
          "subject": "english",
          "gradeBand": {
            "min": 4,
            "max": 7,
            "label": "Grades 4–7"
          },
          "locale": "en-US",
          "prompt": "Which chunking is most useful for reading ‘reconstruction’?",
          "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
          "maxAttempts": 1,
          "estimatedSeconds": 60,
          "tags": [
            "english",
            "diagnostic"
          ],
          "noCameraRequired": true,
          "identifyingInformationRequested": false,
          "kind": "multiple-choice",
          "options": [
            {
              "id": "english-decoding-d2-useful",
              "text": "re | construct | ion"
            },
            {
              "id": "english-decoding-d2-letters",
              "text": "r | e | c | o | n | s | t | r | u | c | t | i | o | n"
            },
            {
              "id": "english-decoding-d2-first",
              "text": "recon | then guess the rest"
            }
          ],
          "correctOptionIds": [
            "english-decoding-d2-useful"
          ],
          "allowMultiple": false,
          "shuffle": false
        }
      ],
      "misconceptions": [
        {
          "id": "english-decoding-first-part-guess",
          "skillId": "english-decode-multisyllable-words",
          "label": "Guesses from the first part",
          "learnerSafeDescription": "You may be starting from the first few letters before checking every chunk and the sentence meaning.",
          "distinguishingEvidence": [
            {
              "tag": "english-decoding-guesses-first-part",
              "direction": "supports",
              "weight": 1,
              "explanation": "The selected strategy uses only the beginning of the word."
            },
            {
              "tag": "english-decoding-checks-all-parts",
              "direction": "contradicts",
              "weight": 1,
              "explanation": "The learner checks all chunks and meaning."
            }
          ],
          "alternateExplanations": [
            "Cover-and-reveal chunks",
            "Meaningful word-part map"
          ],
          "minimumEvidenceCount": 1,
          "escalationAfterRepeatedCycles": 2
        },
        {
          "id": "english-decoding-letter-by-letter",
          "skillId": "english-decode-multisyllable-words",
          "label": "Reads a long word letter by letter",
          "learnerSafeDescription": "You may be holding too many separate letters instead of grouping them into pronounceable or meaningful chunks.",
          "distinguishingEvidence": [
            {
              "tag": "english-decoding-uses-single-letters",
              "direction": "supports",
              "weight": 1,
              "explanation": "The selected strategy separates every letter."
            },
            {
              "tag": "english-decoding-uses-chunks",
              "direction": "contradicts",
              "weight": 1,
              "explanation": "The learner groups the word into useful chunks."
            }
          ],
          "alternateExplanations": [
            "Tap one beat per spoken chunk",
            "Build from a familiar base"
          ],
          "minimumEvidenceCount": 1,
          "escalationAfterRepeatedCycles": 2
        }
      ],
      "teachingSequences": [
        {
          "misconceptionId": "english-decoding-first-part-guess",
          "turns": [
            {
              "id": "english-decoding-multisyllable-words-show-me",
              "phase": "teach-visually",
              "skillId": "english-decode-multisyllable-words",
              "learnerMessage": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
              "spokenTurn": {
                "id": "english-decoding-multisyllable-words-show-me-spoken",
                "text": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-decoding-show-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-decoding-show-title",
                  "kind": "set-title",
                  "text": "Find the meaningful chunks",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Find the meaningful chunks"
                },
                {
                  "id": "english-decoding-show-word",
                  "kind": "add-text",
                  "text": "un | predict | able",
                  "region": "center",
                  "emphasis": "strong",
                  "durationMs": 250,
                  "ariaLabel": "The word unpredictable split into un, predict, and able"
                },
                {
                  "id": "english-decoding-show-step",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Cover the prefix and suffix. Read the familiar base: predict.",
                  "durationMs": 300,
                  "ariaLabel": "Step one: cover un and able, then read predict"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            },
            {
              "id": "english-decoding-multisyllable-words-talk-through",
              "phase": "teach-visually",
              "skillId": "english-decode-multisyllable-words",
              "learnerMessage": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
              "spokenTurn": {
                "id": "english-decoding-multisyllable-words-talk-through-spoken",
                "text": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-decoding-talk-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-decoding-talk-title",
                  "kind": "set-title",
                  "text": "Chunk, blend, check",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Chunk, blend, check"
                },
                {
                  "id": "english-decoding-talk-steps",
                  "kind": "add-text",
                  "text": "1. Mark affixes  2. Find vowel sounds  3. Blend  4. Check meaning",
                  "region": "center",
                  "emphasis": "normal",
                  "durationMs": 300,
                  "ariaLabel": "Mark affixes, find vowel sounds, blend the chunks, and check the meaning"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            }
          ]
        },
        {
          "misconceptionId": "english-decoding-letter-by-letter",
          "turns": [
            {
              "id": "english-decoding-multisyllable-words-talk-through",
              "phase": "teach-visually",
              "skillId": "english-decode-multisyllable-words",
              "learnerMessage": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
              "spokenTurn": {
                "id": "english-decoding-multisyllable-words-talk-through-spoken",
                "text": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-decoding-talk-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-decoding-talk-title",
                  "kind": "set-title",
                  "text": "Chunk, blend, check",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Chunk, blend, check"
                },
                {
                  "id": "english-decoding-talk-steps",
                  "kind": "add-text",
                  "text": "1. Mark affixes  2. Find vowel sounds  3. Blend  4. Check meaning",
                  "region": "center",
                  "emphasis": "normal",
                  "durationMs": 300,
                  "ariaLabel": "Mark affixes, find vowel sounds, blend the chunks, and check the meaning"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            },
            {
              "id": "english-decoding-multisyllable-words-show-me",
              "phase": "teach-visually",
              "skillId": "english-decode-multisyllable-words",
              "learnerMessage": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
              "spokenTurn": {
                "id": "english-decoding-multisyllable-words-show-me-spoken",
                "text": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-decoding-show-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-decoding-show-title",
                  "kind": "set-title",
                  "text": "Find the meaningful chunks",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Find the meaningful chunks"
                },
                {
                  "id": "english-decoding-show-word",
                  "kind": "add-text",
                  "text": "un | predict | able",
                  "region": "center",
                  "emphasis": "strong",
                  "durationMs": 250,
                  "ariaLabel": "The word unpredictable split into un, predict, and able"
                },
                {
                  "id": "english-decoding-show-step",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Cover the prefix and suffix. Read the familiar base: predict.",
                  "durationMs": 300,
                  "ariaLabel": "Step one: cover un and able, then read predict"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            }
          ]
        },
        {
          "misconceptionId": "default",
          "turns": [
            {
              "id": "english-decoding-multisyllable-words-show-me",
              "phase": "teach-visually",
              "skillId": "english-decode-multisyllable-words",
              "learnerMessage": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
              "spokenTurn": {
                "id": "english-decoding-multisyllable-words-show-me-spoken",
                "text": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-decoding-show-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-decoding-show-title",
                  "kind": "set-title",
                  "text": "Find the meaningful chunks",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Find the meaningful chunks"
                },
                {
                  "id": "english-decoding-show-word",
                  "kind": "add-text",
                  "text": "un | predict | able",
                  "region": "center",
                  "emphasis": "strong",
                  "durationMs": 250,
                  "ariaLabel": "The word unpredictable split into un, predict, and able"
                },
                {
                  "id": "english-decoding-show-step",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Cover the prefix and suffix. Read the familiar base: predict.",
                  "durationMs": 300,
                  "ariaLabel": "Step one: cover un and able, then read predict"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            },
            {
              "id": "english-decoding-multisyllable-words-talk-through",
              "phase": "teach-visually",
              "skillId": "english-decode-multisyllable-words",
              "learnerMessage": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
              "spokenTurn": {
                "id": "english-decoding-multisyllable-words-talk-through-spoken",
                "text": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-decoding-talk-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-decoding-talk-title",
                  "kind": "set-title",
                  "text": "Chunk, blend, check",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Chunk, blend, check"
                },
                {
                  "id": "english-decoding-talk-steps",
                  "kind": "add-text",
                  "text": "1. Mark affixes  2. Find vowel sounds  3. Blend  4. Check meaning",
                  "region": "center",
                  "emphasis": "normal",
                  "durationMs": 300,
                  "ariaLabel": "Mark affixes, find vowel sounds, blend the chunks, and check the meaning"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            }
          ]
        },
        {
          "misconceptionId": "default",
          "turns": [
            {
              "id": "english-decoding-multisyllable-words-different-example",
              "phase": "teach-visually",
              "skillId": "english-decode-multisyllable-words",
              "learnerMessage": "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
              "spokenTurn": {
                "id": "english-decoding-multisyllable-words-different-example-spoken",
                "text": "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-decoding-different-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-decoding-different-title",
                  "kind": "set-title",
                  "text": "A fresh word",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: A fresh word"
                },
                {
                  "id": "english-decoding-different-word",
                  "kind": "add-text",
                  "text": "re | construct | ion",
                  "region": "center",
                  "emphasis": "strong",
                  "durationMs": 250,
                  "ariaLabel": "The word reconstruction split into re, construct, and ion"
                },
                {
                  "id": "english-decoding-different-step",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Start with the base construct; then add re and ion.",
                  "durationMs": 250,
                  "ariaLabel": "Start with construct, then add the prefix re and suffix ion"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            }
          ]
        }
      ],
      "guidedPractice": {
        "id": "english-decoding-multisyllable-words-guided-contract",
        "skillId": "english-decode-multisyllable-words",
        "items": [
          {
            "id": "english-decoding-guided-one",
            "skillId": "english-decode-multisyllable-words",
            "purpose": "guided-practice",
            "subject": "english",
            "gradeBand": {
              "min": 4,
              "max": 7,
              "label": "Grades 4–7"
            },
            "locale": "en-US",
            "prompt": "For ‘transportation,’ which part is the strongest familiar base to read first?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 3,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "guided-practice"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-decoding-g1-port",
                "text": "port"
              },
              {
                "id": "english-decoding-g1-t",
                "text": "the letter t"
              },
              {
                "id": "english-decoding-g1-transp",
                "text": "transp, then guess"
              }
            ],
            "correctOptionIds": [
              "english-decoding-g1-port"
            ],
            "allowMultiple": false,
            "shuffle": false
          },
          {
            "id": "english-decoding-guided-two",
            "skillId": "english-decode-multisyllable-words",
            "purpose": "guided-practice",
            "subject": "english",
            "gradeBand": {
              "min": 4,
              "max": 7,
              "label": "Grades 4–7"
            },
            "locale": "en-US",
            "prompt": "After blending ‘mis | under | stand | ing,’ what should you do next?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 3,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "guided-practice"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-decoding-g2-context",
                "text": "Check whether the word makes sense in the sentence."
              },
              {
                "id": "english-decoding-g2-stop",
                "text": "Stop after the first sound that seems possible."
              },
              {
                "id": "english-decoding-g2-spell",
                "text": "Restart by naming every letter."
              }
            ],
            "correctOptionIds": [
              "english-decoding-g2-context"
            ],
            "allowMultiple": false,
            "shuffle": false
          }
        ],
        "hintLadder": [
          {
            "level": 1,
            "prompt": "Use only the first step shown on the board, then pause and decide what you notice.",
            "revealsAnswer": false,
            "visualSupportCommandIds": [
              "english-decoding-show-clear",
              "english-decoding-show-title"
            ]
          },
          {
            "level": 2,
            "prompt": "Compare the two most likely choices and explain which one follows the taught strategy.",
            "revealsAnswer": false,
            "visualSupportCommandIds": [
              "english-decoding-show-clear",
              "english-decoding-show-title",
              "english-decoding-show-word",
              "english-decoding-show-step"
            ]
          }
        ],
        "maxSupportedAttemptsPerItem": 3,
        "askLearnerToExplain": true,
        "alternateExplanationAllowed": true,
        "feedbackPolicy": "immediate"
      },
      "independentMastery": {
        "id": "english-decoding-multisyllable-words-independent-contract",
        "skillId": "english-decode-multisyllable-words",
        "items": [
          {
            "id": "english-decoding-independent-one",
            "skillId": "english-decode-multisyllable-words",
            "purpose": "independent-mastery",
            "subject": "english",
            "gradeBand": {
              "min": 4,
              "max": 7,
              "label": "Grades 4–7"
            },
            "locale": "en-US",
            "prompt": "Which plan best supports decoding ‘disagreement’?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 1,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "independent-mastery"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-decoding-i1-plan",
                "text": "Read dis | agree | ment, blend, then check meaning."
              },
              {
                "id": "english-decoding-i1-guess",
                "text": "Read dis- and guess a familiar word."
              },
              {
                "id": "english-decoding-i1-letters",
                "text": "Use only separate letter names."
              }
            ],
            "correctOptionIds": [
              "english-decoding-i1-plan"
            ],
            "allowMultiple": false,
            "shuffle": false
          },
          {
            "id": "english-decoding-independent-two",
            "skillId": "english-decode-multisyllable-words",
            "purpose": "independent-mastery",
            "subject": "english",
            "gradeBand": {
              "min": 4,
              "max": 7,
              "label": "Grades 4–7"
            },
            "locale": "en-US",
            "prompt": "Which split keeps the meaningful parts of ‘prepayment’ visible?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 1,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "independent-mastery"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-decoding-i2-parts",
                "text": "pre | pay | ment"
              },
              {
                "id": "english-decoding-i2-random",
                "text": "prep | ay | ment"
              },
              {
                "id": "english-decoding-i2-guess",
                "text": "prepa | guess"
              }
            ],
            "correctOptionIds": [
              "english-decoding-i2-parts"
            ],
            "allowMultiple": false,
            "shuffle": false
          },
          {
            "id": "english-decoding-independent-three",
            "skillId": "english-decode-multisyllable-words",
            "purpose": "independent-mastery",
            "subject": "english",
            "gradeBand": {
              "min": 4,
              "max": 7,
              "label": "Grades 4–7"
            },
            "locale": "en-US",
            "prompt": "You blended ‘care | less | ness.’ Which check is most useful?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 1,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "independent-mastery"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-decoding-i3-meaning",
                "text": "Ask whether carelessness fits the sentence meaning."
              },
              {
                "id": "english-decoding-i3-first",
                "text": "Use only the sound of care and ignore the ending."
              },
              {
                "id": "english-decoding-i3-letters",
                "text": "Replace the chunks with separate letter names."
              }
            ],
            "correctOptionIds": [
              "english-decoding-i3-meaning"
            ],
            "allowMultiple": false,
            "shuffle": false
          }
        ],
        "minimumEvidenceCount": 4,
        "minimumDistinctContexts": 3,
        "minimumMeanScore": 0.8,
        "maximumUncertainty": 0.4,
        "reassessmentRequired": true,
        "singleAnswerCanEstablishMastery": false,
        "supportsTeacherOverride": true,
        "placementDecisionAllowed": false
      },
      "reassessmentItems": [
        {
          "id": "english-decoding-reassessment-one",
          "skillId": "english-decode-multisyllable-words",
          "purpose": "reassessment",
          "subject": "english",
          "gradeBand": {
            "min": 4,
            "max": 7,
            "label": "Grades 4–7"
          },
          "locale": "en-US",
          "prompt": "Which first step is most useful for ‘international’?",
          "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
          "maxAttempts": 1,
          "estimatedSeconds": 60,
          "tags": [
            "english",
            "reassessment"
          ],
          "noCameraRequired": true,
          "identifyingInformationRequested": false,
          "kind": "multiple-choice",
          "options": [
            {
              "id": "english-decoding-r1-parts",
              "text": "Mark inter | nation | al."
            },
            {
              "id": "english-decoding-r1-guess",
              "text": "Guess after reading int-."
            },
            {
              "id": "english-decoding-r1-letters",
              "text": "Name every letter only."
            }
          ],
          "correctOptionIds": [
            "english-decoding-r1-parts"
          ],
          "allowMultiple": false,
          "shuffle": false
        },
        {
          "id": "english-decoding-reassessment-two",
          "skillId": "english-decode-multisyllable-words",
          "purpose": "reassessment",
          "subject": "english",
          "gradeBand": {
            "min": 4,
            "max": 7,
            "label": "Grades 4–7"
          },
          "locale": "en-US",
          "prompt": "What completes a strong decoding routine after chunks have been blended?",
          "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
          "maxAttempts": 1,
          "estimatedSeconds": 60,
          "tags": [
            "english",
            "reassessment"
          ],
          "noCameraRequired": true,
          "identifyingInformationRequested": false,
          "kind": "multiple-choice",
          "options": [
            {
              "id": "english-decoding-r2-check",
              "text": "Reread the sentence and check meaning."
            },
            {
              "id": "english-decoding-r2-hide",
              "text": "Ignore the sentence around the word."
            },
            {
              "id": "english-decoding-r2-restart",
              "text": "Always restart letter by letter."
            }
          ],
          "correctOptionIds": [
            "english-decoding-r2-check"
          ],
          "allowMultiple": false,
          "shuffle": false
        }
      ],
      "mediaFallback": {
        "missingVisualText": "Use the visible words, separators, labels, and numbered steps. The English lesson does not depend on an image or video.",
        "missingAudioText": "Audio is optional. Read the always-visible captions or open the complete transcript, then continue at your own pace.",
        "visualAlternativeCommandsAllowed": true,
        "captionsAlwaysVisible": true,
        "transcriptAlwaysAvailable": true,
        "lessonMayContinueWithoutMedia": true
      },
      "persistentDifficultyCycleLimit": 2
    },
    "extension": {
      "adapterId": "english-decoding-multisyllable-words-core-v02-adapter",
      "adapterVersion": "0.2.0",
      "coreContractVersion": "0.2.0",
      "lessonId": "english-decoding-multisyllable-words",
      "modeResponses": {
        "show-me": {
          "id": "english-decoding-multisyllable-words-show-me",
          "phase": "teach-visually",
          "skillId": "english-decode-multisyllable-words",
          "learnerMessage": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
          "spokenTurn": {
            "id": "english-decoding-multisyllable-words-show-me-spoken",
            "text": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
            "locale": "en-US",
            "pace": "slow",
            "emphasisTokens": [],
            "canInterrupt": true,
            "requireLearnerResponse": false,
            "fallbackText": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
            "captionsRequired": true,
            "transcriptRequired": true,
            "claimsHumanIdentity": false
          },
          "boardCommands": [
            {
              "id": "english-decoding-show-clear",
              "kind": "clear-board",
              "durationMs": 0,
              "ariaLabel": "Clear the English teaching board"
            },
            {
              "id": "english-decoding-show-title",
              "kind": "set-title",
              "text": "Find the meaningful chunks",
              "durationMs": 0,
              "ariaLabel": "Teaching board title: Find the meaningful chunks"
            },
            {
              "id": "english-decoding-show-word",
              "kind": "add-text",
              "text": "un | predict | able",
              "region": "center",
              "emphasis": "strong",
              "durationMs": 250,
              "ariaLabel": "The word unpredictable split into un, predict, and able"
            },
            {
              "id": "english-decoding-show-step",
              "kind": "reveal-step",
              "stepNumber": 1,
              "text": "Cover the prefix and suffix. Read the familiar base: predict.",
              "durationMs": 300,
              "ariaLabel": "Step one: cover un and able, then read predict"
            }
          ],
          "assessmentItem": null,
          "expectedInput": "continue",
          "oneUsefulStepOnly": true,
          "givesFinalGradedAnswer": false,
          "asksLearnerToParticipate": true,
          "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
          "confidence": null,
          "alternateExplanationAvailable": true,
          "escalationReason": null,
          "jarvisClaimsHumanIdentity": false
        },
        "talk-me-through-it": {
          "id": "english-decoding-multisyllable-words-talk-through",
          "phase": "teach-visually",
          "skillId": "english-decode-multisyllable-words",
          "learnerMessage": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
          "spokenTurn": {
            "id": "english-decoding-multisyllable-words-talk-through-spoken",
            "text": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
            "locale": "en-US",
            "pace": "slow",
            "emphasisTokens": [],
            "canInterrupt": true,
            "requireLearnerResponse": false,
            "fallbackText": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
            "captionsRequired": true,
            "transcriptRequired": true,
            "claimsHumanIdentity": false
          },
          "boardCommands": [
            {
              "id": "english-decoding-talk-clear",
              "kind": "clear-board",
              "durationMs": 0,
              "ariaLabel": "Clear the English teaching board"
            },
            {
              "id": "english-decoding-talk-title",
              "kind": "set-title",
              "text": "Chunk, blend, check",
              "durationMs": 0,
              "ariaLabel": "Teaching board title: Chunk, blend, check"
            },
            {
              "id": "english-decoding-talk-steps",
              "kind": "add-text",
              "text": "1. Mark affixes  2. Find vowel sounds  3. Blend  4. Check meaning",
              "region": "center",
              "emphasis": "normal",
              "durationMs": 300,
              "ariaLabel": "Mark affixes, find vowel sounds, blend the chunks, and check the meaning"
            }
          ],
          "assessmentItem": null,
          "expectedInput": "continue",
          "oneUsefulStepOnly": true,
          "givesFinalGradedAnswer": false,
          "asksLearnerToParticipate": true,
          "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
          "confidence": null,
          "alternateExplanationAvailable": true,
          "escalationReason": null,
          "jarvisClaimsHumanIdentity": false
        },
        "lets-do-one-together": {
          "id": "english-decoding-multisyllable-words-together",
          "phase": "guided-practice",
          "skillId": "english-decode-multisyllable-words",
          "learnerMessage": "Let’s do one together. For ‘transportation,’ which part is the strongest familiar base to read first?",
          "spokenTurn": {
            "id": "english-decoding-multisyllable-words-together-spoken",
            "text": "Let’s do one together. For ‘transportation,’ which part is the strongest familiar base to read first?",
            "locale": "en-US",
            "pace": "slow",
            "emphasisTokens": [],
            "canInterrupt": true,
            "requireLearnerResponse": true,
            "fallbackText": "Let’s do one together. For ‘transportation,’ which part is the strongest familiar base to read first?",
            "captionsRequired": true,
            "transcriptRequired": true,
            "claimsHumanIdentity": false
          },
          "boardCommands": [
            {
              "id": "english-decoding-multisyllable-words-together-step",
              "kind": "reveal-step",
              "stepNumber": 1,
              "text": "Try only the first useful step, then choose your answer.",
              "durationMs": 250,
              "ariaLabel": "Guided step one: try only the first useful step"
            }
          ],
          "assessmentItem": {
            "id": "english-decoding-guided-one",
            "skillId": "english-decode-multisyllable-words",
            "purpose": "guided-practice",
            "subject": "english",
            "gradeBand": {
              "min": 4,
              "max": 7,
              "label": "Grades 4–7"
            },
            "locale": "en-US",
            "prompt": "For ‘transportation,’ which part is the strongest familiar base to read first?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 3,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "guided-practice"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-decoding-g1-port",
                "text": "port"
              },
              {
                "id": "english-decoding-g1-t",
                "text": "the letter t"
              },
              {
                "id": "english-decoding-g1-transp",
                "text": "transp, then guess"
              }
            ],
            "correctOptionIds": [
              "english-decoding-g1-port"
            ],
            "allowMultiple": false,
            "shuffle": false
          },
          "expectedInput": "answer",
          "oneUsefulStepOnly": true,
          "givesFinalGradedAnswer": false,
          "asksLearnerToParticipate": true,
          "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
          "confidence": null,
          "alternateExplanationAvailable": true,
          "escalationReason": null,
          "jarvisClaimsHumanIdentity": false
        },
        "different-example": {
          "id": "english-decoding-multisyllable-words-different-example",
          "phase": "teach-visually",
          "skillId": "english-decode-multisyllable-words",
          "learnerMessage": "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
          "spokenTurn": {
            "id": "english-decoding-multisyllable-words-different-example-spoken",
            "text": "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
            "locale": "en-US",
            "pace": "slow",
            "emphasisTokens": [],
            "canInterrupt": true,
            "requireLearnerResponse": false,
            "fallbackText": "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
            "captionsRequired": true,
            "transcriptRequired": true,
            "claimsHumanIdentity": false
          },
          "boardCommands": [
            {
              "id": "english-decoding-different-clear",
              "kind": "clear-board",
              "durationMs": 0,
              "ariaLabel": "Clear the English teaching board"
            },
            {
              "id": "english-decoding-different-title",
              "kind": "set-title",
              "text": "A fresh word",
              "durationMs": 0,
              "ariaLabel": "Teaching board title: A fresh word"
            },
            {
              "id": "english-decoding-different-word",
              "kind": "add-text",
              "text": "re | construct | ion",
              "region": "center",
              "emphasis": "strong",
              "durationMs": 250,
              "ariaLabel": "The word reconstruction split into re, construct, and ion"
            },
            {
              "id": "english-decoding-different-step",
              "kind": "reveal-step",
              "stepNumber": 1,
              "text": "Start with the base construct; then add re and ion.",
              "durationMs": 250,
              "ariaLabel": "Start with construct, then add the prefix re and suffix ion"
            }
          ],
          "assessmentItem": null,
          "expectedInput": "continue",
          "oneUsefulStepOnly": true,
          "givesFinalGradedAnswer": false,
          "asksLearnerToParticipate": true,
          "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
          "confidence": null,
          "alternateExplanationAvailable": true,
          "escalationReason": null,
          "jarvisClaimsHumanIdentity": false
        }
      },
      "distinguishingProbes": [
        {
          "misconceptionId": "english-decoding-first-part-guess",
          "assessmentItemIds": [
            "english-decoding-diagnostic-one",
            "english-decoding-diagnostic-two"
          ],
          "evidenceTags": [
            "english-decoding-guesses-first-part",
            "english-decoding-checks-all-parts"
          ],
          "interpretation": "Contrast a first-letter guess with a full chunk-and-context routine."
        },
        {
          "misconceptionId": "english-decoding-letter-by-letter",
          "assessmentItemIds": [
            "english-decoding-diagnostic-one",
            "english-decoding-diagnostic-two"
          ],
          "evidenceTags": [
            "english-decoding-uses-single-letters",
            "english-decoding-uses-chunks"
          ],
          "interpretation": "Check whether the learner groups letters into manageable spoken or meaningful parts."
        }
      ],
      "visualExplanationPlan": {
        "purpose": "Make an unfamiliar long word visually smaller while keeping meaningful parts intact.",
        "boardCommandIds": [
          "english-decoding-show-clear",
          "english-decoding-show-title",
          "english-decoding-show-word",
          "english-decoding-show-step"
        ],
        "revealOrder": [
          "Display the whole word",
          "Separate affixes and base",
          "Read the base",
          "Blend and check meaning"
        ],
        "noVisualFallback": "Read the separators aloud: un, predict, able. Ask the learner to repeat and blend the three chunks."
      },
      "narration": {
        "id": "english-decoding-multisyllable-words-narration",
        "locale": "en-US",
        "text": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read. Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning. Let’s do one together. For ‘transportation,’ which part is the strongest familiar base to read first? Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
        "audioUri": null,
        "captions": [
          {
            "id": "english-decoding-multisyllable-words-narration-caption-1",
            "startMs": 0,
            "endMs": 7590,
            "text": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
            "speaker": "jarvis"
          },
          {
            "id": "english-decoding-multisyllable-words-narration-caption-2",
            "startMs": 7590,
            "endMs": 15895,
            "text": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
            "speaker": "jarvis"
          },
          {
            "id": "english-decoding-multisyllable-words-narration-caption-3",
            "startMs": 15895,
            "endMs": 21450,
            "text": "Let’s do one together. For ‘transportation,’ which part is the strongest familiar base to read first?",
            "speaker": "jarvis"
          },
          {
            "id": "english-decoding-multisyllable-words-narration-caption-4",
            "startMs": 21450,
            "endMs": 29810,
            "text": "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
            "speaker": "jarvis"
          }
        ],
        "transcript": [
          {
            "id": "english-decoding-multisyllable-words-narration-transcript-1",
            "speaker": "jarvis",
            "text": "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
            "visibleToLearner": true,
            "containsIdentifyingInformation": false
          },
          {
            "id": "english-decoding-multisyllable-words-narration-transcript-2",
            "speaker": "jarvis",
            "text": "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
            "visibleToLearner": true,
            "containsIdentifyingInformation": false
          },
          {
            "id": "english-decoding-multisyllable-words-narration-transcript-3",
            "speaker": "jarvis",
            "text": "Let’s do one together. For ‘transportation,’ which part is the strongest familiar base to read first?",
            "visibleToLearner": true,
            "containsIdentifyingInformation": false
          },
          {
            "id": "english-decoding-multisyllable-words-narration-transcript-4",
            "speaker": "jarvis",
            "text": "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
            "visibleToLearner": true,
            "containsIdentifyingInformation": false
          }
        ],
        "voiceRequired": false,
        "mediaRequired": false
      },
      "webVtt": "WEBVTT\n\nenglish-decoding-multisyllable-words-narration-caption-1\n00:00:00.000 --> 00:00:07.590\nShow me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.\n\nenglish-decoding-multisyllable-words-narration-caption-2\n00:00:07.590 --> 00:00:15.895\nTalk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.\n\nenglish-decoding-multisyllable-words-narration-caption-3\n00:00:15.895 --> 00:00:21.450\nLet’s do one together. For ‘transportation,’ which part is the strongest familiar base to read first?\n\nenglish-decoding-multisyllable-words-narration-caption-4\n00:00:21.450 --> 00:00:29.810\nDifferent example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.\n",
      "prerequisiteRemediation": [
        {
          "prerequisiteSkillId": "english-identify-vowel-sounds",
          "trigger": "The learner cannot locate a likely vowel sound in a short base word.",
          "learnerPrompt": "Before the long word, mark the vowel sound in the short word ‘play.’",
          "completionEvidence": [
            "Marks ay as the vowel team",
            "Reads play as one spoken beat"
          ],
          "returnsToTargetSkill": true
        },
        {
          "prerequisiteSkillId": "english-recognize-common-affixes",
          "trigger": "The learner does not recognize a common prefix or suffix in two probes.",
          "learnerPrompt": "Compare happy, unhappy, and replay. Point to un- and re- and tell what each part changes.",
          "completionEvidence": [
            "Locates a common affix",
            "Explains that the affix changes meaning"
          ],
          "returnsToTargetSkill": true
        }
      ],
      "parentTeacherNotes": {
        "lookFor": [
          "Uses chunks without over-segmenting",
          "Blends the whole word",
          "Checks the sentence meaning"
        ],
        "supportiveLanguage": [
          "Let’s make the word smaller.",
          "Which part already looks familiar?"
        ],
        "avoid": [
          "Calling the word easy",
          "Naming a reading level as a judgment",
          "Suggesting a disability diagnosis"
        ],
        "masteryReminder": "Require accurate decoding across several unfamiliar words and contexts; one correct word is not mastery."
      },
      "answerReasoning": [
        {
          "itemId": "english-decoding-diagnostic-one",
          "reasoning": "Useful chunks reduce memory load and expose the familiar base predict plus meaningful affixes.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-decoding-diagnostic-two",
          "reasoning": "The split keeps the familiar base construct intact and separates two meaningful affixes.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-decoding-guided-one",
          "reasoning": "Port is a familiar meaningful base within trans-port-a-tion and supports accurate blending.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-decoding-guided-two",
          "reasoning": "A meaning check catches a blend that is pronounceable but does not fit the sentence.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-decoding-independent-one",
          "reasoning": "The plan uses a prefix, base, and suffix, then verifies the result in context.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-decoding-independent-two",
          "reasoning": "Pre-, pay, and -ment are recognizable parts that support both pronunciation and meaning.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-decoding-independent-three",
          "reasoning": "Checking the complete word against context confirms both the blend and the suffixes.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-decoding-reassessment-one",
          "reasoning": "The meaningful chunks support pronunciation and connect the word to nation.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-decoding-reassessment-two",
          "reasoning": "Context provides a final accuracy check after word-part decoding.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        }
      ],
      "learnerAuthorshipPrompt": "Say the word using your own voice, explain which chunk helped, and make the final pronunciation choice after checking the sentence.",
      "gradedAssignmentBoundary": "I can teach the strategy with a fresh example, but I will not complete graded work for you."
    }
  },
  "writing": {
    "lessonId": "english-organize-revise-clear-paragraph",
    "completedModuleName": "Organizing and revising a clear paragraph",
    "category": "writing",
    "classification": "PASS_PROVISIONAL_ADAPTER",
    "program": {
      "id": "english-organize-revise-clear-paragraph",
      "version": "0.2.0",
      "title": "Organize and Revise a Clear Paragraph",
      "subject": "english",
      "gradeBand": {
        "min": 5,
        "max": 8,
        "label": "Grades 5–8"
      },
      "locale": "en-US",
      "targetSkillId": "english-organize-revise-paragraph",
      "skillGraph": {
        "id": "english-organize-revise-clear-paragraph-skill-graph",
        "version": "0.2.0",
        "nodes": [
          {
            "id": "english-write-complete-sentences",
            "title": "Write complete sentences",
            "description": "Express a complete subject-predicate thought with fitting punctuation.",
            "subject": "english",
            "gradeBand": {
              "min": 3,
              "max": 6,
              "label": "Grades 3–6"
            },
            "observableEvidence": [
              "Writes a complete sentence that can stand alone."
            ]
          },
          {
            "id": "english-state-paragraph-point",
            "title": "State a paragraph point",
            "description": "Write a sentence that tells the reader the paragraph’s central point.",
            "subject": "english",
            "gradeBand": {
              "min": 4,
              "max": 7,
              "label": "Grades 4–7"
            },
            "observableEvidence": [
              "Identifies or drafts a focused point sentence."
            ]
          },
          {
            "id": "english-organize-revise-paragraph",
            "title": "Organize and revise a clear paragraph",
            "description": "Clarify a paragraph’s point, order connected details, and make focused revisions while preserving the writer’s voice.",
            "subject": "english",
            "gradeBand": {
              "min": 5,
              "max": 8,
              "label": "Grades 5–8"
            },
            "observableEvidence": [
              "Orders sentences around one controlling point.",
              "Makes a focused revision and explains how it helps the reader."
            ]
          }
        ],
        "edges": [
          {
            "prerequisiteSkillId": "english-write-complete-sentences",
            "dependentSkillId": "english-organize-revise-paragraph",
            "strength": "required",
            "rationale": "Write complete sentences supplies a smaller step used in Organize and Revise a Clear Paragraph."
          },
          {
            "prerequisiteSkillId": "english-state-paragraph-point",
            "dependentSkillId": "english-organize-revise-paragraph",
            "strength": "required",
            "rationale": "State a paragraph point supplies a smaller step used in Organize and Revise a Clear Paragraph."
          }
        ]
      },
      "diagnosticItems": [
        {
          "id": "english-paragraph-diagnostic-one",
          "skillId": "english-organize-revise-paragraph",
          "purpose": "diagnostic",
          "subject": "english",
          "gradeBand": {
            "min": 5,
            "max": 8,
            "label": "Grades 5–8"
          },
          "locale": "en-US",
          "prompt": "Draft: ‘The trail had steep hills. Hiking with my aunt taught me to keep trying. At the top, we celebrated.’ Which revision should come first?",
          "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
          "maxAttempts": 1,
          "estimatedSeconds": 60,
          "tags": [
            "english",
            "diagnostic"
          ],
          "noCameraRequired": true,
          "identifyingInformationRequested": false,
          "kind": "multiple-choice",
          "options": [
            {
              "id": "english-paragraph-d1-move",
              "text": "Move the point about perseverance before the supporting details."
            },
            {
              "id": "english-paragraph-d1-comma",
              "text": "Change one comma even though the order stays unclear."
            },
            {
              "id": "english-paragraph-d1-rewrite",
              "text": "Replace every sentence with the tutor’s wording."
            }
          ],
          "correctOptionIds": [
            "english-paragraph-d1-move"
          ],
          "allowMultiple": false,
          "shuffle": false
        },
        {
          "id": "english-paragraph-diagnostic-two",
          "skillId": "english-organize-revise-paragraph",
          "purpose": "diagnostic",
          "subject": "english",
          "gradeBand": {
            "min": 5,
            "max": 8,
            "label": "Grades 5–8"
          },
          "locale": "en-US",
          "prompt": "A paragraph explains why a student values a neighborhood garden, but one sentence describes a video game. What is the most focused revision?",
          "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
          "maxAttempts": 1,
          "estimatedSeconds": 60,
          "tags": [
            "english",
            "diagnostic"
          ],
          "noCameraRequired": true,
          "identifyingInformationRequested": false,
          "kind": "multiple-choice",
          "options": [
            {
              "id": "english-paragraph-d2-remove",
              "text": "Remove or replace the unrelated sentence after the writer decides what fits."
            },
            {
              "id": "english-paragraph-d2-spell",
              "text": "Correct spelling only and keep every idea."
            },
            {
              "id": "english-paragraph-d2-rewrite",
              "text": "Ask the tutor to write a new paragraph."
            }
          ],
          "correctOptionIds": [
            "english-paragraph-d2-remove"
          ],
          "allowMultiple": false,
          "shuffle": false
        }
      ],
      "misconceptions": [
        {
          "id": "english-paragraph-surface-only",
          "skillId": "english-organize-revise-paragraph",
          "label": "Revises only spelling or punctuation",
          "learnerSafeDescription": "You may be proofreading individual words before checking whether the paragraph’s ideas follow a clear path.",
          "distinguishingEvidence": [
            {
              "tag": "english-paragraph-selects-surface-edit",
              "direction": "supports",
              "weight": 1,
              "explanation": "The learner chooses a surface correction when organization is the larger need."
            },
            {
              "tag": "english-paragraph-revises-organization",
              "direction": "contradicts",
              "weight": 1,
              "explanation": "The learner changes the order or connection of ideas."
            }
          ],
          "alternateExplanations": [
            "Paragraph path map",
            "Reader-first question"
          ],
          "minimumEvidenceCount": 1,
          "escalationAfterRepeatedCycles": 2
        },
        {
          "id": "english-paragraph-rewrite-erases-voice",
          "skillId": "english-organize-revise-paragraph",
          "label": "Replaces the writer’s voice instead of making a focused revision",
          "learnerSafeDescription": "You may be changing every sentence when moving, adding, or clarifying one part would keep the writer’s ideas and voice.",
          "distinguishingEvidence": [
            {
              "tag": "english-paragraph-selects-full-rewrite",
              "direction": "supports",
              "weight": 1,
              "explanation": "The response replaces the paragraph rather than targeting its need."
            },
            {
              "tag": "english-paragraph-preserves-voice",
              "direction": "contradicts",
              "weight": 1,
              "explanation": "The response keeps original ideas and wording where they already work."
            }
          ],
          "alternateExplanations": [
            "Keep-move-add checklist",
            "One-change challenge"
          ],
          "minimumEvidenceCount": 1,
          "escalationAfterRepeatedCycles": 2
        }
      ],
      "teachingSequences": [
        {
          "misconceptionId": "english-paragraph-surface-only",
          "turns": [
            {
              "id": "english-organize-revise-clear-paragraph-show-me",
              "phase": "teach-visually",
              "skillId": "english-organize-revise-paragraph",
              "learnerMessage": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
              "spokenTurn": {
                "id": "english-organize-revise-clear-paragraph-show-me-spoken",
                "text": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-paragraph-show-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-paragraph-show-title",
                  "kind": "set-title",
                  "text": "Keep the voice; clarify the path",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Keep the voice; clarify the path"
                },
                {
                  "id": "english-paragraph-show-map",
                  "kind": "add-text",
                  "text": "Point → connected detail → explanation → closing",
                  "region": "center",
                  "emphasis": "strong",
                  "durationMs": 250,
                  "ariaLabel": "A clear paragraph moves from point to connected detail to explanation to closing"
                },
                {
                  "id": "english-paragraph-show-step",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Underline the sentence that states your point. Do not rewrite the paragraph yet.",
                  "durationMs": 300,
                  "ariaLabel": "First underline the sentence that states your point without rewriting yet"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            },
            {
              "id": "english-organize-revise-clear-paragraph-talk-through",
              "phase": "teach-visually",
              "skillId": "english-organize-revise-paragraph",
              "learnerMessage": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
              "spokenTurn": {
                "id": "english-organize-revise-clear-paragraph-talk-through-spoken",
                "text": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-paragraph-talk-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-paragraph-talk-title",
                  "kind": "set-title",
                  "text": "One revision decision",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: One revision decision"
                },
                {
                  "id": "english-paragraph-talk-question",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Ask: What do I want my reader to understand first?",
                  "durationMs": 250,
                  "ariaLabel": "Ask what the reader should understand first"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            }
          ]
        },
        {
          "misconceptionId": "english-paragraph-rewrite-erases-voice",
          "turns": [
            {
              "id": "english-organize-revise-clear-paragraph-talk-through",
              "phase": "teach-visually",
              "skillId": "english-organize-revise-paragraph",
              "learnerMessage": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
              "spokenTurn": {
                "id": "english-organize-revise-clear-paragraph-talk-through-spoken",
                "text": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-paragraph-talk-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-paragraph-talk-title",
                  "kind": "set-title",
                  "text": "One revision decision",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: One revision decision"
                },
                {
                  "id": "english-paragraph-talk-question",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Ask: What do I want my reader to understand first?",
                  "durationMs": 250,
                  "ariaLabel": "Ask what the reader should understand first"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            },
            {
              "id": "english-organize-revise-clear-paragraph-show-me",
              "phase": "teach-visually",
              "skillId": "english-organize-revise-paragraph",
              "learnerMessage": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
              "spokenTurn": {
                "id": "english-organize-revise-clear-paragraph-show-me-spoken",
                "text": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-paragraph-show-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-paragraph-show-title",
                  "kind": "set-title",
                  "text": "Keep the voice; clarify the path",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Keep the voice; clarify the path"
                },
                {
                  "id": "english-paragraph-show-map",
                  "kind": "add-text",
                  "text": "Point → connected detail → explanation → closing",
                  "region": "center",
                  "emphasis": "strong",
                  "durationMs": 250,
                  "ariaLabel": "A clear paragraph moves from point to connected detail to explanation to closing"
                },
                {
                  "id": "english-paragraph-show-step",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Underline the sentence that states your point. Do not rewrite the paragraph yet.",
                  "durationMs": 300,
                  "ariaLabel": "First underline the sentence that states your point without rewriting yet"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            }
          ]
        },
        {
          "misconceptionId": "default",
          "turns": [
            {
              "id": "english-organize-revise-clear-paragraph-show-me",
              "phase": "teach-visually",
              "skillId": "english-organize-revise-paragraph",
              "learnerMessage": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
              "spokenTurn": {
                "id": "english-organize-revise-clear-paragraph-show-me-spoken",
                "text": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-paragraph-show-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-paragraph-show-title",
                  "kind": "set-title",
                  "text": "Keep the voice; clarify the path",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Keep the voice; clarify the path"
                },
                {
                  "id": "english-paragraph-show-map",
                  "kind": "add-text",
                  "text": "Point → connected detail → explanation → closing",
                  "region": "center",
                  "emphasis": "strong",
                  "durationMs": 250,
                  "ariaLabel": "A clear paragraph moves from point to connected detail to explanation to closing"
                },
                {
                  "id": "english-paragraph-show-step",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Underline the sentence that states your point. Do not rewrite the paragraph yet.",
                  "durationMs": 300,
                  "ariaLabel": "First underline the sentence that states your point without rewriting yet"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            },
            {
              "id": "english-organize-revise-clear-paragraph-talk-through",
              "phase": "teach-visually",
              "skillId": "english-organize-revise-paragraph",
              "learnerMessage": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
              "spokenTurn": {
                "id": "english-organize-revise-clear-paragraph-talk-through-spoken",
                "text": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-paragraph-talk-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-paragraph-talk-title",
                  "kind": "set-title",
                  "text": "One revision decision",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: One revision decision"
                },
                {
                  "id": "english-paragraph-talk-question",
                  "kind": "reveal-step",
                  "stepNumber": 1,
                  "text": "Ask: What do I want my reader to understand first?",
                  "durationMs": 250,
                  "ariaLabel": "Ask what the reader should understand first"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            }
          ]
        },
        {
          "misconceptionId": "default",
          "turns": [
            {
              "id": "english-organize-revise-clear-paragraph-different-example",
              "phase": "teach-visually",
              "skillId": "english-organize-revise-paragraph",
              "learnerMessage": "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
              "spokenTurn": {
                "id": "english-organize-revise-clear-paragraph-different-example-spoken",
                "text": "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
                "locale": "en-US",
                "pace": "slow",
                "emphasisTokens": [],
                "canInterrupt": true,
                "requireLearnerResponse": false,
                "fallbackText": "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
                "captionsRequired": true,
                "transcriptRequired": true,
                "claimsHumanIdentity": false
              },
              "boardCommands": [
                {
                  "id": "english-paragraph-different-clear",
                  "kind": "clear-board",
                  "durationMs": 0,
                  "ariaLabel": "Clear the English teaching board"
                },
                {
                  "id": "english-paragraph-different-title",
                  "kind": "set-title",
                  "text": "Move before rewriting",
                  "durationMs": 0,
                  "ariaLabel": "Teaching board title: Move before rewriting"
                },
                {
                  "id": "english-paragraph-different-order",
                  "kind": "add-text",
                  "text": "Draft order: detail, closing, point → Try: point, detail, closing",
                  "region": "center",
                  "emphasis": "strong",
                  "durationMs": 300,
                  "ariaLabel": "Move the point before the detail and closing instead of replacing the writer's words"
                }
              ],
              "assessmentItem": null,
              "expectedInput": "continue",
              "oneUsefulStepOnly": true,
              "givesFinalGradedAnswer": false,
              "asksLearnerToParticipate": true,
              "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
              "confidence": null,
              "alternateExplanationAvailable": true,
              "escalationReason": null,
              "jarvisClaimsHumanIdentity": false
            }
          ]
        }
      ],
      "guidedPractice": {
        "id": "english-organize-revise-clear-paragraph-guided-contract",
        "skillId": "english-organize-revise-paragraph",
        "items": [
          {
            "id": "english-paragraph-guided-one",
            "skillId": "english-organize-revise-paragraph",
            "purpose": "guided-practice",
            "subject": "english",
            "gradeBand": {
              "min": 5,
              "max": 8,
              "label": "Grades 5–8"
            },
            "locale": "en-US",
            "prompt": "A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 3,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "guided-practice"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-paragraph-g1-move",
                "text": "Try moving the point before the examples, then reread."
              },
              {
                "id": "english-paragraph-g1-spell",
                "text": "Change a correctly spelled word."
              },
              {
                "id": "english-paragraph-g1-rewrite",
                "text": "Replace all of the student’s sentences."
              }
            ],
            "correctOptionIds": [
              "english-paragraph-g1-move"
            ],
            "allowMultiple": false,
            "shuffle": false
          },
          {
            "id": "english-paragraph-guided-two",
            "skillId": "english-organize-revise-paragraph",
            "purpose": "guided-practice",
            "subject": "english",
            "gradeBand": {
              "min": 5,
              "max": 8,
              "label": "Grades 5–8"
            },
            "locale": "en-US",
            "prompt": "Which question best checks whether a detail belongs in a paragraph?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 3,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "guided-practice"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-paragraph-g2-connect",
                "text": "How does this detail help explain my main point?"
              },
              {
                "id": "english-paragraph-g2-long",
                "text": "Is this the longest sentence?"
              },
              {
                "id": "english-paragraph-g2-tutor",
                "text": "Would a tutor write it differently?"
              }
            ],
            "correctOptionIds": [
              "english-paragraph-g2-connect"
            ],
            "allowMultiple": false,
            "shuffle": false
          }
        ],
        "hintLadder": [
          {
            "level": 1,
            "prompt": "Use only the first step shown on the board, then pause and decide what you notice.",
            "revealsAnswer": false,
            "visualSupportCommandIds": [
              "english-paragraph-show-clear",
              "english-paragraph-show-title"
            ]
          },
          {
            "level": 2,
            "prompt": "Compare the two most likely choices and explain which one follows the taught strategy.",
            "revealsAnswer": false,
            "visualSupportCommandIds": [
              "english-paragraph-show-clear",
              "english-paragraph-show-title",
              "english-paragraph-show-map",
              "english-paragraph-show-step"
            ]
          }
        ],
        "maxSupportedAttemptsPerItem": 3,
        "askLearnerToExplain": true,
        "alternateExplanationAllowed": true,
        "feedbackPolicy": "immediate"
      },
      "independentMastery": {
        "id": "english-organize-revise-clear-paragraph-independent-contract",
        "skillId": "english-organize-revise-paragraph",
        "items": [
          {
            "id": "english-paragraph-independent-one",
            "skillId": "english-organize-revise-paragraph",
            "purpose": "independent-mastery",
            "subject": "english",
            "gradeBand": {
              "min": 5,
              "max": 8,
              "label": "Grades 5–8"
            },
            "locale": "en-US",
            "prompt": "Order these roles for a clear explanatory paragraph: closing, supporting detail, point sentence. Which order is strongest?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 1,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "independent-mastery"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-paragraph-i1-order",
                "text": "Point sentence → supporting detail → closing"
              },
              {
                "id": "english-paragraph-i1-random",
                "text": "Closing → point sentence → supporting detail"
              },
              {
                "id": "english-paragraph-i1-surface",
                "text": "The order does not matter if spelling is correct."
              }
            ],
            "correctOptionIds": [
              "english-paragraph-i1-order"
            ],
            "allowMultiple": false,
            "shuffle": false
          },
          {
            "id": "english-paragraph-independent-two",
            "skillId": "english-organize-revise-paragraph",
            "purpose": "independent-mastery",
            "subject": "english",
            "gradeBand": {
              "min": 5,
              "max": 8,
              "label": "Grades 5–8"
            },
            "locale": "en-US",
            "prompt": "A writer’s paragraph is clear except for one vague transition. Which response preserves the writer’s voice?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 1,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "independent-mastery"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-paragraph-i2-choice",
                "text": "Offer transition choices and ask the writer to select or create the final wording."
              },
              {
                "id": "english-paragraph-i2-rewrite",
                "text": "Replace the entire paragraph without asking."
              },
              {
                "id": "english-paragraph-i2-ignore",
                "text": "Correct punctuation only and ignore the connection."
              }
            ],
            "correctOptionIds": [
              "english-paragraph-i2-choice"
            ],
            "allowMultiple": false,
            "shuffle": false
          },
          {
            "id": "english-paragraph-independent-three",
            "skillId": "english-organize-revise-paragraph",
            "purpose": "independent-mastery",
            "subject": "english",
            "gradeBand": {
              "min": 5,
              "max": 8,
              "label": "Grades 5–8"
            },
            "locale": "en-US",
            "prompt": "Which revision note teaches instead of rewriting?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 1,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "independent-mastery"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-paragraph-i3-teach",
                "text": "Your second detail shifts topics. Decide whether to connect it to your point or remove it."
              },
              {
                "id": "english-paragraph-i3-replace",
                "text": "Here is a completely new paragraph to submit."
              },
              {
                "id": "english-paragraph-i3-mark",
                "text": "Only fix one capital letter."
              }
            ],
            "correctOptionIds": [
              "english-paragraph-i3-teach"
            ],
            "allowMultiple": false,
            "shuffle": false
          }
        ],
        "minimumEvidenceCount": 4,
        "minimumDistinctContexts": 3,
        "minimumMeanScore": 0.8,
        "maximumUncertainty": 0.4,
        "reassessmentRequired": true,
        "singleAnswerCanEstablishMastery": false,
        "supportsTeacherOverride": true,
        "placementDecisionAllowed": false
      },
      "reassessmentItems": [
        {
          "id": "english-paragraph-reassessment-one",
          "skillId": "english-organize-revise-paragraph",
          "purpose": "reassessment",
          "subject": "english",
          "gradeBand": {
            "min": 5,
            "max": 8,
            "label": "Grades 5–8"
          },
          "locale": "en-US",
          "prompt": "A paragraph’s examples are relevant, but the main point is missing. What should the writer do?",
          "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
          "maxAttempts": 1,
          "estimatedSeconds": 60,
          "tags": [
            "english",
            "reassessment"
          ],
          "noCameraRequired": true,
          "identifyingInformationRequested": false,
          "kind": "multiple-choice",
          "options": [
            {
              "id": "english-paragraph-r1-draft",
              "text": "Draft a point sentence in their own voice, then check each example against it."
            },
            {
              "id": "english-paragraph-r1-proof",
              "text": "Proofread commas only."
            },
            {
              "id": "english-paragraph-r1-copy",
              "text": "Copy a complete paragraph from the tutor."
            }
          ],
          "correctOptionIds": [
            "english-paragraph-r1-draft"
          ],
          "allowMultiple": false,
          "shuffle": false
        },
        {
          "id": "english-paragraph-reassessment-two",
          "skillId": "english-organize-revise-paragraph",
          "purpose": "reassessment",
          "subject": "english",
          "gradeBand": {
            "min": 5,
            "max": 8,
            "label": "Grades 5–8"
          },
          "locale": "en-US",
          "prompt": "After moving one sentence, what is the most useful next step?",
          "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
          "maxAttempts": 1,
          "estimatedSeconds": 60,
          "tags": [
            "english",
            "reassessment"
          ],
          "noCameraRequired": true,
          "identifyingInformationRequested": false,
          "kind": "multiple-choice",
          "options": [
            {
              "id": "english-paragraph-r2-reread",
              "text": "Reread and decide whether the ideas now connect clearly."
            },
            {
              "id": "english-paragraph-r2-replace",
              "text": "Replace every remaining sentence."
            },
            {
              "id": "english-paragraph-r2-master",
              "text": "Declare mastery from that one change."
            }
          ],
          "correctOptionIds": [
            "english-paragraph-r2-reread"
          ],
          "allowMultiple": false,
          "shuffle": false
        }
      ],
      "mediaFallback": {
        "missingVisualText": "Use the visible words, separators, labels, and numbered steps. The English lesson does not depend on an image or video.",
        "missingAudioText": "Audio is optional. Read the always-visible captions or open the complete transcript, then continue at your own pace.",
        "visualAlternativeCommandsAllowed": true,
        "captionsAlwaysVisible": true,
        "transcriptAlwaysAvailable": true,
        "lessonMayContinueWithoutMedia": true
      },
      "persistentDifficultyCycleLimit": 2
    },
    "extension": {
      "adapterId": "english-organize-revise-clear-paragraph-core-v02-adapter",
      "adapterVersion": "0.2.0",
      "coreContractVersion": "0.2.0",
      "lessonId": "english-organize-revise-clear-paragraph",
      "modeResponses": {
        "show-me": {
          "id": "english-organize-revise-clear-paragraph-show-me",
          "phase": "teach-visually",
          "skillId": "english-organize-revise-paragraph",
          "learnerMessage": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
          "spokenTurn": {
            "id": "english-organize-revise-clear-paragraph-show-me-spoken",
            "text": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
            "locale": "en-US",
            "pace": "slow",
            "emphasisTokens": [],
            "canInterrupt": true,
            "requireLearnerResponse": false,
            "fallbackText": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
            "captionsRequired": true,
            "transcriptRequired": true,
            "claimsHumanIdentity": false
          },
          "boardCommands": [
            {
              "id": "english-paragraph-show-clear",
              "kind": "clear-board",
              "durationMs": 0,
              "ariaLabel": "Clear the English teaching board"
            },
            {
              "id": "english-paragraph-show-title",
              "kind": "set-title",
              "text": "Keep the voice; clarify the path",
              "durationMs": 0,
              "ariaLabel": "Teaching board title: Keep the voice; clarify the path"
            },
            {
              "id": "english-paragraph-show-map",
              "kind": "add-text",
              "text": "Point → connected detail → explanation → closing",
              "region": "center",
              "emphasis": "strong",
              "durationMs": 250,
              "ariaLabel": "A clear paragraph moves from point to connected detail to explanation to closing"
            },
            {
              "id": "english-paragraph-show-step",
              "kind": "reveal-step",
              "stepNumber": 1,
              "text": "Underline the sentence that states your point. Do not rewrite the paragraph yet.",
              "durationMs": 300,
              "ariaLabel": "First underline the sentence that states your point without rewriting yet"
            }
          ],
          "assessmentItem": null,
          "expectedInput": "continue",
          "oneUsefulStepOnly": true,
          "givesFinalGradedAnswer": false,
          "asksLearnerToParticipate": true,
          "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
          "confidence": null,
          "alternateExplanationAvailable": true,
          "escalationReason": null,
          "jarvisClaimsHumanIdentity": false
        },
        "talk-me-through-it": {
          "id": "english-organize-revise-clear-paragraph-talk-through",
          "phase": "teach-visually",
          "skillId": "english-organize-revise-paragraph",
          "learnerMessage": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
          "spokenTurn": {
            "id": "english-organize-revise-clear-paragraph-talk-through-spoken",
            "text": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
            "locale": "en-US",
            "pace": "slow",
            "emphasisTokens": [],
            "canInterrupt": true,
            "requireLearnerResponse": false,
            "fallbackText": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
            "captionsRequired": true,
            "transcriptRequired": true,
            "claimsHumanIdentity": false
          },
          "boardCommands": [
            {
              "id": "english-paragraph-talk-clear",
              "kind": "clear-board",
              "durationMs": 0,
              "ariaLabel": "Clear the English teaching board"
            },
            {
              "id": "english-paragraph-talk-title",
              "kind": "set-title",
              "text": "One revision decision",
              "durationMs": 0,
              "ariaLabel": "Teaching board title: One revision decision"
            },
            {
              "id": "english-paragraph-talk-question",
              "kind": "reveal-step",
              "stepNumber": 1,
              "text": "Ask: What do I want my reader to understand first?",
              "durationMs": 250,
              "ariaLabel": "Ask what the reader should understand first"
            }
          ],
          "assessmentItem": null,
          "expectedInput": "continue",
          "oneUsefulStepOnly": true,
          "givesFinalGradedAnswer": false,
          "asksLearnerToParticipate": true,
          "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
          "confidence": null,
          "alternateExplanationAvailable": true,
          "escalationReason": null,
          "jarvisClaimsHumanIdentity": false
        },
        "lets-do-one-together": {
          "id": "english-organize-revise-clear-paragraph-together",
          "phase": "guided-practice",
          "skillId": "english-organize-revise-paragraph",
          "learnerMessage": "Let’s do one together. A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?",
          "spokenTurn": {
            "id": "english-organize-revise-clear-paragraph-together-spoken",
            "text": "Let’s do one together. A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?",
            "locale": "en-US",
            "pace": "slow",
            "emphasisTokens": [],
            "canInterrupt": true,
            "requireLearnerResponse": true,
            "fallbackText": "Let’s do one together. A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?",
            "captionsRequired": true,
            "transcriptRequired": true,
            "claimsHumanIdentity": false
          },
          "boardCommands": [
            {
              "id": "english-organize-revise-clear-paragraph-together-step",
              "kind": "reveal-step",
              "stepNumber": 1,
              "text": "Try only the first useful step, then choose your answer.",
              "durationMs": 250,
              "ariaLabel": "Guided step one: try only the first useful step"
            }
          ],
          "assessmentItem": {
            "id": "english-paragraph-guided-one",
            "skillId": "english-organize-revise-paragraph",
            "purpose": "guided-practice",
            "subject": "english",
            "gradeBand": {
              "min": 5,
              "max": 8,
              "label": "Grades 5–8"
            },
            "locale": "en-US",
            "prompt": "A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?",
            "directions": "Choose the response that best shows the strategy. You may ask for another explanation during teaching.",
            "maxAttempts": 3,
            "estimatedSeconds": 60,
            "tags": [
              "english",
              "guided-practice"
            ],
            "noCameraRequired": true,
            "identifyingInformationRequested": false,
            "kind": "multiple-choice",
            "options": [
              {
                "id": "english-paragraph-g1-move",
                "text": "Try moving the point before the examples, then reread."
              },
              {
                "id": "english-paragraph-g1-spell",
                "text": "Change a correctly spelled word."
              },
              {
                "id": "english-paragraph-g1-rewrite",
                "text": "Replace all of the student’s sentences."
              }
            ],
            "correctOptionIds": [
              "english-paragraph-g1-move"
            ],
            "allowMultiple": false,
            "shuffle": false
          },
          "expectedInput": "answer",
          "oneUsefulStepOnly": true,
          "givesFinalGradedAnswer": false,
          "asksLearnerToParticipate": true,
          "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
          "confidence": null,
          "alternateExplanationAvailable": true,
          "escalationReason": null,
          "jarvisClaimsHumanIdentity": false
        },
        "different-example": {
          "id": "english-organize-revise-clear-paragraph-different-example",
          "phase": "teach-visually",
          "skillId": "english-organize-revise-paragraph",
          "learnerMessage": "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
          "spokenTurn": {
            "id": "english-organize-revise-clear-paragraph-different-example-spoken",
            "text": "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
            "locale": "en-US",
            "pace": "slow",
            "emphasisTokens": [],
            "canInterrupt": true,
            "requireLearnerResponse": false,
            "fallbackText": "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
            "captionsRequired": true,
            "transcriptRequired": true,
            "claimsHumanIdentity": false
          },
          "boardCommands": [
            {
              "id": "english-paragraph-different-clear",
              "kind": "clear-board",
              "durationMs": 0,
              "ariaLabel": "Clear the English teaching board"
            },
            {
              "id": "english-paragraph-different-title",
              "kind": "set-title",
              "text": "Move before rewriting",
              "durationMs": 0,
              "ariaLabel": "Teaching board title: Move before rewriting"
            },
            {
              "id": "english-paragraph-different-order",
              "kind": "add-text",
              "text": "Draft order: detail, closing, point → Try: point, detail, closing",
              "region": "center",
              "emphasis": "strong",
              "durationMs": 300,
              "ariaLabel": "Move the point before the detail and closing instead of replacing the writer's words"
            }
          ],
          "assessmentItem": null,
          "expectedInput": "continue",
          "oneUsefulStepOnly": true,
          "givesFinalGradedAnswer": false,
          "asksLearnerToParticipate": true,
          "uncertaintyStatement": "This is one piece of learning evidence, not a label or diagnosis.",
          "confidence": null,
          "alternateExplanationAvailable": true,
          "escalationReason": null,
          "jarvisClaimsHumanIdentity": false
        }
      },
      "distinguishingProbes": [
        {
          "misconceptionId": "english-paragraph-surface-only",
          "assessmentItemIds": [
            "english-paragraph-diagnostic-one",
            "english-paragraph-diagnostic-two"
          ],
          "evidenceTags": [
            "english-paragraph-selects-surface-edit",
            "english-paragraph-revises-organization"
          ],
          "interpretation": "Contrast proofreading with a revision that changes the path or relevance of ideas."
        },
        {
          "misconceptionId": "english-paragraph-rewrite-erases-voice",
          "assessmentItemIds": [
            "english-paragraph-diagnostic-one",
            "english-paragraph-diagnostic-two"
          ],
          "evidenceTags": [
            "english-paragraph-selects-full-rewrite",
            "english-paragraph-preserves-voice"
          ],
          "interpretation": "Check whether the learner can target one need without replacing the writer’s wording and decisions."
        }
      ],
      "visualExplanationPlan": {
        "purpose": "Show paragraph organization as a path while keeping the student’s original wording visible.",
        "boardCommandIds": [
          "english-paragraph-show-clear",
          "english-paragraph-show-title",
          "english-paragraph-show-map",
          "english-paragraph-show-step"
        ],
        "revealOrder": [
          "Underline the point",
          "Link each detail",
          "Move or clarify one part",
          "Learner rereads and makes the final revision"
        ],
        "noVisualFallback": "Read the paragraph aloud sentence by sentence and use the oral labels point, detail, explanation, and closing."
      },
      "narration": {
        "id": "english-organize-revise-clear-paragraph-narration",
        "locale": "en-US",
        "text": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow. Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision. Let’s do one together. A paragraph begins with two examples and states its main point last. What is the smallest useful first revision? Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
        "audioUri": null,
        "captions": [
          {
            "id": "english-organize-revise-clear-paragraph-narration-caption-1",
            "startMs": 0,
            "endMs": 8085,
            "text": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
            "speaker": "jarvis"
          },
          {
            "id": "english-organize-revise-clear-paragraph-narration-caption-2",
            "startMs": 8085,
            "endMs": 17655,
            "text": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
            "speaker": "jarvis"
          },
          {
            "id": "english-organize-revise-clear-paragraph-narration-caption-3",
            "startMs": 17655,
            "endMs": 25080,
            "text": "Let’s do one together. A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?",
            "speaker": "jarvis"
          },
          {
            "id": "english-organize-revise-clear-paragraph-narration-caption-4",
            "startMs": 25080,
            "endMs": 34210,
            "text": "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
            "speaker": "jarvis"
          }
        ],
        "transcript": [
          {
            "id": "english-organize-revise-clear-paragraph-narration-transcript-1",
            "speaker": "jarvis",
            "text": "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
            "visibleToLearner": true,
            "containsIdentifyingInformation": false
          },
          {
            "id": "english-organize-revise-clear-paragraph-narration-transcript-2",
            "speaker": "jarvis",
            "text": "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
            "visibleToLearner": true,
            "containsIdentifyingInformation": false
          },
          {
            "id": "english-organize-revise-clear-paragraph-narration-transcript-3",
            "speaker": "jarvis",
            "text": "Let’s do one together. A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?",
            "visibleToLearner": true,
            "containsIdentifyingInformation": false
          },
          {
            "id": "english-organize-revise-clear-paragraph-narration-transcript-4",
            "speaker": "jarvis",
            "text": "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
            "visibleToLearner": true,
            "containsIdentifyingInformation": false
          }
        ],
        "voiceRequired": false,
        "mediaRequired": false
      },
      "webVtt": "WEBVTT\n\nenglish-organize-revise-clear-paragraph-narration-caption-1\n00:00:00.000 --> 00:00:08.085\nShow me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.\n\nenglish-organize-revise-clear-paragraph-narration-caption-2\n00:00:08.085 --> 00:00:17.655\nTalk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.\n\nenglish-organize-revise-clear-paragraph-narration-caption-3\n00:00:17.655 --> 00:00:25.080\nLet’s do one together. A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?\n\nenglish-organize-revise-clear-paragraph-narration-caption-4\n00:00:25.080 --> 00:00:34.210\nDifferent example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.\n",
      "prerequisiteRemediation": [
        {
          "prerequisiteSkillId": "english-write-complete-sentences",
          "trigger": "The learner’s idea cannot yet be expressed as a complete sentence.",
          "learnerPrompt": "Say who or what your sentence is about, then say what that subject does or is.",
          "completionEvidence": [
            "States a subject",
            "Adds a predicate to complete the thought"
          ],
          "returnsToTargetSkill": true
        },
        {
          "prerequisiteSkillId": "english-state-paragraph-point",
          "trigger": "The learner cannot say what the paragraph should help a reader understand.",
          "learnerPrompt": "Finish this frame in your own words: I want my reader to understand that ___.",
          "completionEvidence": [
            "States one focused idea",
            "Connects at least one existing detail to that idea"
          ],
          "returnsToTargetSkill": true
        }
      ],
      "parentTeacherNotes": {
        "lookFor": [
          "Can state the paragraph’s point",
          "Moves or clarifies one part at a time",
          "Keeps ownership of wording and final decisions"
        ],
        "supportiveLanguage": [
          "What do you want the reader to understand?",
          "Which words already sound right to you?"
        ],
        "avoid": [
          "Rewriting the paragraph for the learner",
          "Calling grammar or spelling careless",
          "Equating one clean draft with mastery"
        ],
        "masteryReminder": "Look for independent organization and revision across multiple purposes and drafts, followed by fresh reassessment."
      },
      "answerReasoning": [
        {
          "itemId": "english-paragraph-diagnostic-one",
          "reasoning": "Moving the existing point gives the paragraph a clear path while preserving the writer’s ideas and wording.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-paragraph-diagnostic-two",
          "reasoning": "A focused relevance decision improves unity without handing authorship to the tutor.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-paragraph-guided-one",
          "reasoning": "Testing one move makes the structure clearer while leaving the student in control of the final revision.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-paragraph-guided-two",
          "reasoning": "A supporting detail belongs when its connection to the paragraph’s point is clear.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-paragraph-independent-one",
          "reasoning": "The order introduces the point, develops it, and gives the reader a purposeful ending.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-paragraph-independent-two",
          "reasoning": "Choices teach the connection while leaving the final language and decision with the writer.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-paragraph-independent-three",
          "reasoning": "The note names the reader problem and gives the learner ownership of the revision choice.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-paragraph-reassessment-one",
          "reasoning": "The writer supplies the controlling point, then uses it to test organization and relevance.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        },
        {
          "itemId": "english-paragraph-reassessment-two",
          "reasoning": "Rereading tests the effect of the focused move before another revision decision is made.",
          "revealPolicy": "after-learner-attempt",
          "preservesLearnerAuthorship": true
        }
      ],
      "learnerAuthorshipPrompt": "Choose one move, addition, or clarification; keep the parts that sound like you; then type the final revision in your own words.",
      "gradedAssignmentBoundary": "I can teach the strategy with a fresh example, but I will not complete graded work for you."
    }
  }
};
