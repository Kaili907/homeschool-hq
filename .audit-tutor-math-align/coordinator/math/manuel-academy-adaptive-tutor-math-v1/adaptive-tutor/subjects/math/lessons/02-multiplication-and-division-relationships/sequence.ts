import type { AdaptiveMathSequence } from '../../types'

export const sequence = {
  "sequenceId": "math-seq-mult-div-rel-v1",
  "lessonId": "math-lesson-02-multiplication-division-relationships",
  "version": "1.0.0",
  "order": "02",
  "title": "Multiplication and Division Relationships",
  "summary": "Use arrays, equal groups, fact families, area models, and context to connect multiplication and division.",
  "gradeBand": {
    "minimum": 4,
    "maximum": 6,
    "primary": [
      4,
      5
    ],
    "extension": [
      6
    ],
    "prerequisiteSupport": [
      3
    ]
  },
  "estimatedMinutes": {
    "diagnostic": 15,
    "instruction": 25,
    "guidedPractice": 20,
    "masteryCheck": 20
  },
  "skillIds": [
    "math-skill-md-equal-groups-v1",
    "math-skill-md-inverse-v1",
    "math-skill-md-area-model-v1",
    "math-skill-md-remainders-v1"
  ],
  "legacySkillMappings": [
    "mult",
    "div",
    "mult4",
    "div4",
    "factors4"
  ],
  "prerequisites": [
    "Skip-count by common factors.",
    "Represent basic multiplication with equal groups.",
    "Use addition and subtraction facts accurately."
  ],
  "objectives": [
    "Interpret factors as number of groups and group size.",
    "Use multiplication facts to solve and check division.",
    "Multiply multi-digit numbers using area-model partial products.",
    "Interpret remainders according to units and context."
  ],
  "diagnostic": {
    "items": [
      {
        "id": "math-md-d01",
        "type": "multiple-choice",
        "prompt": "Which picture represents 4 groups of 6?",
        "choices": [
          {
            "id": "A",
            "text": "An array with 4 rows of 6"
          },
          {
            "id": "B",
            "text": "An array with 6 rows of 4"
          },
          {
            "id": "C",
            "text": "A line of 10 objects"
          },
          {
            "id": "D",
            "text": "24 objects with no grouping"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "Four groups with six in each group can be shown as four rows of six.",
        "misconceptionSignals": {
          "B": [
            "math-mis-md-groups-size-swap"
          ],
          "C": [
            "math-mis-md-repeated-add-only"
          ],
          "D": [
            "math-mis-md-groups-size-swap"
          ]
        },
        "representation": "array",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-d02",
        "type": "multiple-choice",
        "prompt": "Use 7 × 8 = 56. Which division equation is in the same fact family?",
        "choices": [
          {
            "id": "A",
            "text": "56 ÷ 7 = 8"
          },
          {
            "id": "B",
            "text": "56 ÷ 8 = 7"
          },
          {
            "id": "C",
            "text": "Both A and B"
          },
          {
            "id": "D",
            "text": "56 − 8 = 48"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "Multiplication and division use the same three numbers in inverse equations.",
        "misconceptionSignals": {
          "A": [
            "math-mis-md-inverse-gap"
          ],
          "B": [
            "math-mis-md-inverse-gap"
          ],
          "D": [
            "math-mis-md-division-subtraction"
          ]
        },
        "representation": "fact-family",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-d03",
        "type": "multiple-choice",
        "prompt": "What does 24 ÷ 6 ask in a “groups of 6” interpretation?",
        "choices": [
          {
            "id": "A",
            "text": "Subtract 6 once from 24"
          },
          {
            "id": "B",
            "text": "Find how many groups of 6 fit in 24"
          },
          {
            "id": "C",
            "text": "Add 24 and 6"
          },
          {
            "id": "D",
            "text": "Find 24 groups of 6"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Division can ask how many equal groups of the divisor fit in the dividend.",
        "misconceptionSignals": {
          "A": [
            "math-mis-md-division-subtraction"
          ],
          "C": [
            "math-mis-md-inverse-gap"
          ],
          "D": [
            "math-mis-md-groups-size-swap"
          ]
        },
        "representation": "equal-groups",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-d04",
        "type": "multiple-choice",
        "prompt": "Which partial products correctly decompose 23 × 6?",
        "choices": [
          {
            "id": "A",
            "text": "20 × 6 and 3 × 6"
          },
          {
            "id": "B",
            "text": "2 × 6 and 3 × 6"
          },
          {
            "id": "C",
            "text": "23 × 3 and 23 × 3 only"
          },
          {
            "id": "D",
            "text": "20 × 3 and 6 × 3"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "Split 23 into 20 + 3, multiply each part by 6, then combine.",
        "misconceptionSignals": {
          "B": [
            "math-mis-md-partial-product"
          ],
          "C": [
            "math-mis-md-repeated-add-only"
          ],
          "D": [
            "math-mis-md-partial-product"
          ]
        },
        "representation": "area-model",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-d05",
        "type": "multiple-choice",
        "prompt": "A teacher has 156 markers and puts 12 in each bin. Which equation can check the number of full bins?",
        "choices": [
          {
            "id": "A",
            "text": "12 + ? = 156"
          },
          {
            "id": "B",
            "text": "12 × ? = 156"
          },
          {
            "id": "C",
            "text": "156 × 12 = ?"
          },
          {
            "id": "D",
            "text": "156 − 12 = ?"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "The unknown number of bins times 12 markers per bin must equal 156.",
        "misconceptionSignals": {
          "A": [
            "math-mis-md-inverse-gap"
          ],
          "C": [
            "math-mis-md-groups-size-swap"
          ],
          "D": [
            "math-mis-md-division-subtraction"
          ]
        },
        "representation": "equation",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-d06",
        "type": "open-response",
        "prompt": "Thirty students ride in vans that hold 8 students each. Explain what the remainder means and how many vans are needed.",
        "acceptableEvidence": [
          "Computes 30 ÷ 8 = 3 remainder 6.",
          "Explains 3 vans are full and 6 students still need a van.",
          "Concludes 4 vans are needed."
        ],
        "reasoning": "The remainder represents students who still need transportation, so the context requires one additional van.",
        "misconceptionSignals": {
          "drops remainder": [
            "math-mis-md-remainder-rule"
          ],
          "reports 3 R6 vans": [
            "math-mis-md-remainder-rule"
          ]
        },
        "representation": "equal-groups",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "routingRules": [
      {
        "when": "basic equal-group meaning is insecure",
        "route": "prerequisite-remediation-md-groups"
      },
      {
        "when": "inverse evidence is weak",
        "route": "reteach-md-fact-family"
      },
      {
        "when": "partial product omitted",
        "route": "reteach-md-area-model"
      },
      {
        "when": "remainder is handled mechanically",
        "route": "reteach-md-remainder-context"
      }
    ]
  },
  "misconceptions": [
    {
      "id": "math-mis-md-repeated-add-only",
      "label": "Sees multiplication only as repeated addition and cannot use structure",
      "likelyEvidence": [
        "Counts every object one by one in a large array.",
        "Cannot decompose 23 × 6 into 20 × 6 and 3 × 6."
      ],
      "distinguishingEvidence": [
        "Ask for two ways to split an array.",
        "Ask which partial product matches each rectangle."
      ],
      "firstResponse": "Repeated addition is one meaning. Let’s also use the array’s structure so we do not have to count one object at a time.",
      "route": "reteach-md-array-decompose"
    },
    {
      "id": "math-mis-md-groups-size-swap",
      "label": "Confuses number of groups with size of each group",
      "likelyEvidence": [
        "Uses the wrong unit in a word problem.",
        "Draws 6 groups of 4 when asked for 4 groups of 6 and cannot explain the difference."
      ],
      "distinguishingEvidence": [
        "Ask the learner to label groups and items per group.",
        "Compare 4 × 6 and 6 × 4 in context."
      ],
      "firstResponse": "The product may stay the same, but the story roles are different. Let’s label groups and items in each group.",
      "route": "reteach-md-equal-groups"
    },
    {
      "id": "math-mis-md-division-subtraction",
      "label": "Treats division as subtracting the divisor once",
      "likelyEvidence": [
        "Answers 24 ÷ 6 as 18.",
        "Stops after one subtraction."
      ],
      "distinguishingEvidence": [
        "Ask how many groups of 6 fit into 24.",
        "Use repeated subtraction until zero and count jumps."
      ],
      "firstResponse": "Division asks how many equal groups or how many in each group, not what remains after one subtraction.",
      "route": "reteach-md-division-meaning"
    },
    {
      "id": "math-mis-md-inverse-gap",
      "label": "Does not connect multiplication and division as inverse relationships",
      "likelyEvidence": [
        "Knows 7 × 8 but cannot use it for 56 ÷ 7.",
        "Writes an unrelated fact family."
      ],
      "distinguishingEvidence": [
        "Cover one factor in an array equation.",
        "Ask which multiplication fact checks a division result."
      ],
      "firstResponse": "The same three numbers can tell a multiplication and division family. Let’s use the known product to find the missing factor.",
      "route": "reteach-md-fact-family"
    },
    {
      "id": "math-mis-md-partial-product",
      "label": "Omits or misplaces a partial product",
      "likelyEvidence": [
        "Computes 23 × 6 as 18 or 120.",
        "Adds 20 + 18 instead of 120 + 18."
      ],
      "distinguishingEvidence": [
        "Label each area-model region.",
        "Ask what 20 groups of 6 means."
      ],
      "firstResponse": "You solved one part. Let’s match every part of 23 to a partial product before combining.",
      "route": "reteach-md-area-model"
    },
    {
      "id": "math-mis-md-remainder-rule",
      "label": "Uses one fixed rule for every remainder",
      "likelyEvidence": [
        "Always drops the remainder or always rounds up.",
        "Gives a fractional bus or person when the context needs whole groups."
      ],
      "distinguishingEvidence": [
        "Compare “full teams,” “left over,” and “containers needed” contexts.",
        "Ask what the remainder represents in the story."
      ],
      "firstResponse": "The calculation gives a remainder, but the story decides what that remainder means.",
      "route": "reteach-md-remainder-context"
    }
  ],
  "visualExplanationPlan": {
    "representations": [
      "array",
      "equal-groups",
      "area-model",
      "number-line",
      "step-diagram"
    ],
    "boards": [
      {
        "id": "md-board-01",
        "kind": "array",
        "action": "show",
        "payload": {
          "rows": 4,
          "columns": 6,
          "rowLabel": "groups",
          "columnLabel": "items per group"
        },
        "altText": "Array with four rows and six objects in each row.",
        "narrationCue": "md-n02"
      },
      {
        "id": "md-board-02",
        "kind": "equal-groups",
        "action": "group",
        "payload": {
          "total": 24,
          "groupSize": 6,
          "groups": 4
        },
        "altText": "Twenty-four objects circled into four equal groups of six.",
        "narrationCue": "md-n04"
      },
      {
        "id": "md-board-03",
        "kind": "area-model",
        "action": "partition",
        "payload": {
          "factors": [
            23,
            6
          ],
          "split": [
            20,
            3
          ],
          "partialProducts": [
            120,
            18
          ]
        },
        "altText": "Area model for twenty-three times six split into twenty times six and three times six.",
        "narrationCue": "md-n06"
      },
      {
        "id": "md-board-04",
        "kind": "number-line",
        "action": "jump",
        "payload": {
          "start": 0,
          "end": 56,
          "jumpSize": 7,
          "jumps": 8
        },
        "altText": "Number line with eight jumps of seven reaching fifty-six.",
        "narrationCue": "md-n05"
      },
      {
        "id": "md-board-05",
        "kind": "step-diagram",
        "action": "connect",
        "payload": {
          "nodes": [
            "7 × 8 = 56",
            "56 ÷ 7 = 8",
            "56 ÷ 8 = 7"
          ],
          "label": "inverse fact family"
        },
        "altText": "Step diagram connecting one multiplication fact to two related division facts.",
        "narrationCue": "md-n03"
      }
    ],
    "accessibility": [
      "Objects are countable with row and column labels.",
      "Text equations accompany every model.",
      "No learner image or camera is used."
    ]
  },
  "spokenExplanation": {
    "voice": "warm, clear, curious, nonjudgmental",
    "segments": [
      [
        "md-n01",
        "Multiplication and division describe related equal-group situations."
      ],
      [
        "md-n02",
        "An array shows the number of groups and the number in each group."
      ],
      [
        "md-n03",
        "A multiplication fact and its related division facts use the same three numbers."
      ],
      [
        "md-n04",
        "Division can ask how many groups fit, or how many items belong in each group."
      ],
      [
        "md-n05",
        "Number-line jumps make repeated groups visible without hiding the total."
      ],
      [
        "md-n06",
        "An area model splits a difficult factor into friendlier parts and keeps every partial product."
      ],
      [
        "md-n07",
        "When you divide, a missing-factor multiplication equation can guide the solution."
      ],
      [
        "md-n08",
        "A remainder is evidence. Its meaning depends on the question and the units."
      ],
      [
        "md-n09",
        "Check multiplication with division, and check division with multiplication."
      ],
      [
        "md-n10",
        "Explain the group size, the number of groups, and what the result means in context."
      ]
    ]
  },
  "modes": {
    "showMe": {
      "purpose": "See an area model and inverse check unfold one step at a time.",
      "example": "18 × 7 and 126 ÷ 7",
      "steps": [
        {
          "id": "md-sm-01",
          "prompt": "How could 18 be split into friendlier parts?",
          "expectedEvidence": "10 + 8.",
          "hint": "Look for a ten and what remains.",
          "visualCommandId": "md-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "md-sm-02",
          "prompt": "What two partial products belong to those parts?",
          "expectedEvidence": "10 × 7 and 8 × 7.",
          "hint": "Keep the factor 7 with both parts.",
          "visualCommandId": "md-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "md-sm-03",
          "prompt": "After combining the partial products, which division equation checks the product?",
          "expectedEvidence": "126 ÷ 7 = 18.",
          "hint": "Use product ÷ one factor = the other factor.",
          "visualCommandId": "md-board-05",
          "answerRevealPolicy": "after-worked-steps",
          "onePromptOnly": true
        }
      ]
    },
    "talkMeThroughIt": {
      "purpose": "Explain a division plan using a known multiplication relationship.",
      "example": "144 ÷ 12",
      "steps": [
        {
          "id": "md-tm-01",
          "prompt": "What missing-factor equation matches 144 ÷ 12?",
          "expectedEvidence": "12 × ? = 144.",
          "hint": "Replace division with a multiplication question.",
          "visualCommandId": "md-board-05",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "md-tm-02",
          "prompt": "Which known multiples of 12 help you locate the factor?",
          "expectedEvidence": "For example, 12 × 10 = 120 and 12 × 2 = 24.",
          "hint": "Build from a friendly ten.",
          "visualCommandId": "md-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "md-tm-03",
          "prompt": "How will multiplication verify your quotient?",
          "expectedEvidence": "Multiply the quotient by 12 and reach 144.",
          "hint": "Use the inverse operation.",
          "visualCommandId": "md-board-05",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    },
    "letsDoOneTogether": {
      "purpose": "Alternate array construction and equation writing.",
      "example": "24 groups of 8",
      "steps": [
        {
          "id": "md-tg-01",
          "prompt": "I will draw 20 groups of 8. What smaller rectangle is still needed?",
          "expectedEvidence": "4 groups of 8.",
          "hint": "Split 24 into 20 + 4.",
          "visualCommandId": "md-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "md-tg-02",
          "prompt": "You find both partial products. What should be combined?",
          "expectedEvidence": "160 + 32.",
          "hint": "Multiply each part by 8.",
          "visualCommandId": "md-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "md-tg-03",
          "prompt": "I will write the product. You write a related division equation and explain it.",
          "expectedEvidence": "192 ÷ 8 = 24 or 192 ÷ 24 = 8.",
          "hint": "Use the same three numbers.",
          "visualCommandId": "md-board-05",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    },
    "differentExample": {
      "purpose": "Transfer the relationship to a remainder context.",
      "example": "73 items packed 9 per box",
      "steps": [
        {
          "id": "md-de-01",
          "prompt": "What multiplication fact gets closest to 73 without going over?",
          "expectedEvidence": "9 × 8 = 72.",
          "hint": "Use nearby multiples of 9.",
          "visualCommandId": "md-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "md-de-02",
          "prompt": "What does the remaining 1 represent?",
          "expectedEvidence": "One unpacked item.",
          "hint": "Subtract the packed amount from the total.",
          "visualCommandId": "md-board-02",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "md-de-03",
          "prompt": "Would the answer be 8 boxes or 9 boxes if every item must be packed? Explain.",
          "expectedEvidence": "Nine boxes, because the remaining item needs another box.",
          "hint": "Let the story decide how to use the remainder.",
          "visualCommandId": "md-board-02",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    }
  },
  "guidedPractice": {
    "items": [
      {
        "id": "math-md-g01",
        "type": "multiple-choice",
        "prompt": "Which equation represents 9 equal groups of 7?",
        "choices": [
          {
            "id": "A",
            "text": "9 + 7"
          },
          {
            "id": "B",
            "text": "9 × 7"
          },
          {
            "id": "C",
            "text": "63 ÷ 9"
          },
          {
            "id": "D",
            "text": "Both B and C describe the same relationship"
          }
        ],
        "correctChoiceId": "D",
        "reasoning": "9 × 7 = 63 and 63 ÷ 9 = 7 are related equations.",
        "misconceptionSignals": {
          "A": [
            "math-mis-md-repeated-add-only"
          ],
          "B": [
            "math-mis-md-inverse-gap"
          ],
          "C": [
            "math-mis-md-inverse-gap"
          ]
        },
        "representation": "equal-groups",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-g02",
        "type": "multiple-choice",
        "prompt": "What is 18 × 7 using (10 × 7) + (8 × 7)?",
        "choices": [
          {
            "id": "A",
            "text": "126"
          },
          {
            "id": "B",
            "text": "96"
          },
          {
            "id": "C",
            "text": "78"
          },
          {
            "id": "D",
            "text": "136"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "The partial products are 10 × 7 = 70 and 8 × 7 = 56; combining them gives 126.",
        "misconceptionSignals": {
          "B": [
            "math-mis-md-partial-product"
          ],
          "C": [
            "math-mis-md-repeated-add-only"
          ],
          "D": [
            "math-mis-md-partial-product"
          ]
        },
        "representation": "area-model",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-g03",
        "type": "multiple-choice",
        "prompt": "What is 144 ÷ 12?",
        "choices": [
          {
            "id": "A",
            "text": "10"
          },
          {
            "id": "B",
            "text": "11"
          },
          {
            "id": "C",
            "text": "12"
          },
          {
            "id": "D",
            "text": "13"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "Because 12 × 12 = 144.",
        "misconceptionSignals": {
          "A": [
            "math-mis-md-inverse-gap"
          ],
          "B": [
            "math-mis-md-inverse-gap"
          ],
          "D": [
            "math-mis-md-inverse-gap"
          ]
        },
        "representation": "fact-family",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-g04",
        "type": "open-response",
        "prompt": "Draw or describe an array for 16 × 5 and split it into two easier rectangles.",
        "acceptableEvidence": [
          "Examples: 10 × 5 and 6 × 5; 8 × 5 and 8 × 5.",
          "Partial products total 80.",
          "Connects both rectangles to the full array."
        ],
        "reasoning": "A valid decomposition preserves all 16 groups and combines partial products to 80.",
        "misconceptionSignals": {
          "omits region": [
            "math-mis-md-partial-product"
          ]
        },
        "representation": "area-model",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-g05",
        "type": "multiple-choice",
        "prompt": "Fifty-two stickers are shared equally among 6 students. Which statement best describes the result?",
        "choices": [
          {
            "id": "A",
            "text": "Each gets 8 and 4 are left"
          },
          {
            "id": "B",
            "text": "Each gets 9 with none left"
          },
          {
            "id": "C",
            "text": "Each gets 8 and throw away 4"
          },
          {
            "id": "D",
            "text": "Each gets 46"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "6 × 8 = 48, leaving 4 stickers. The context may decide what to do with leftovers.",
        "misconceptionSignals": {
          "B": [
            "math-mis-md-inverse-gap"
          ],
          "C": [
            "math-mis-md-remainder-rule"
          ],
          "D": [
            "math-mis-md-division-subtraction"
          ]
        },
        "representation": "equal-groups",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-g06",
        "type": "open-response",
        "prompt": "Explain how 13 × 9 can help solve 117 ÷ 9.",
        "acceptableEvidence": [
          "States 13 × 9 = 117.",
          "Uses inverse relationship to conclude the missing factor is 13.",
          "May write the fact family."
        ],
        "reasoning": "Multiplication checks division: if 13 groups of 9 make 117, then 117 divided into groups of 9 makes 13 groups.",
        "misconceptionSignals": {
          "no inverse link": [
            "math-mis-md-inverse-gap"
          ]
        },
        "representation": "fact-family",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "scaffolding": "Move from arrays to equations to context; require a multiplication check for at least one division item."
  },
  "independentMasteryCheck": {
    "items": [
      {
        "id": "math-md-m01",
        "type": "multiple-choice",
        "prompt": "What is 26 × 8 using an area model?",
        "choices": [
          {
            "id": "A",
            "text": "160"
          },
          {
            "id": "B",
            "text": "188"
          },
          {
            "id": "C",
            "text": "208"
          },
          {
            "id": "D",
            "text": "216"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "20 × 8 = 160 and 6 × 8 = 48; 160 + 48 = 208.",
        "misconceptionSignals": {
          "A": [
            "math-mis-md-partial-product"
          ],
          "B": [
            "math-mis-md-partial-product"
          ],
          "D": [
            "math-mis-md-repeated-add-only"
          ]
        },
        "representation": "area-model",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-m02",
        "type": "multiple-choice",
        "prompt": "What is 216 ÷ 18?",
        "choices": [
          {
            "id": "A",
            "text": "10"
          },
          {
            "id": "B",
            "text": "11"
          },
          {
            "id": "C",
            "text": "12"
          },
          {
            "id": "D",
            "text": "14"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "Because 18 × 12 = 216, division by 18 returns the missing factor 12.",
        "misconceptionSignals": {
          "A": [
            "math-mis-md-inverse-gap"
          ],
          "B": [
            "math-mis-md-inverse-gap"
          ],
          "D": [
            "math-mis-md-inverse-gap"
          ]
        },
        "representation": "fact-family",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-m03",
        "type": "open-response",
        "prompt": "Write all four equations in the fact family for 9, 14, and 126.",
        "acceptableEvidence": [
          "9 × 14 = 126",
          "14 × 9 = 126",
          "126 ÷ 9 = 14",
          "126 ÷ 14 = 9"
        ],
        "reasoning": "The two multiplication and two division equations use the same three numbers.",
        "misconceptionSignals": {
          "missing inverse": [
            "math-mis-md-inverse-gap"
          ]
        },
        "representation": "equation",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-m04",
        "type": "multiple-choice",
        "prompt": "A bakery packs 95 rolls in trays that hold 12. How many trays are needed to hold every roll?",
        "choices": [
          {
            "id": "A",
            "text": "7"
          },
          {
            "id": "B",
            "text": "7 remainder 11"
          },
          {
            "id": "C",
            "text": "8"
          },
          {
            "id": "D",
            "text": "9"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "Seven trays hold 84 rolls and 11 remain, so an eighth tray is needed.",
        "misconceptionSignals": {
          "A": [
            "math-mis-md-remainder-rule"
          ],
          "B": [
            "math-mis-md-remainder-rule"
          ],
          "D": [
            "math-mis-md-groups-size-swap"
          ]
        },
        "representation": "word-context",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-m05",
        "type": "open-response",
        "prompt": "Compare 5 groups of 12 and 12 groups of 5. What stays the same, and what changes in a story?",
        "acceptableEvidence": [
          "Both products are 60.",
          "Number of groups and size of each group switch roles.",
          "Units/context may make the two stories different."
        ],
        "reasoning": "The commutative property preserves the product, but the contextual meaning of each factor can differ.",
        "misconceptionSignals": {
          "says identical stories": [
            "math-mis-md-groups-size-swap"
          ]
        },
        "representation": "array",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-md-m06",
        "type": "open-response",
        "prompt": "Solve 17 × 6 with a decomposition, then use your result to write a related division equation.",
        "acceptableEvidence": [
          "Decomposes 17 as 10 + 7 or another valid split.",
          "Gets 102.",
          "Writes 102 ÷ 6 = 17 or 102 ÷ 17 = 6."
        ],
        "reasoning": "Partial products combine to 102, and division reverses the multiplication relationship.",
        "misconceptionSignals": {
          "omits partial": [
            "math-mis-md-partial-product"
          ],
          "no inverse": [
            "math-mis-md-inverse-gap"
          ]
        },
        "representation": "mixed",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "masteryRule": "Across at least two sessions, show secure evidence on at least 5 of 6 items, including one area model, one inverse explanation, and one remainder interpretation. One correct fact is not mastery.",
    "retryRule": "Change numbers and context while preserving the same relationship."
  },
  "reteachingBranches": [
    {
      "id": "reteach-md-equal-groups",
      "targets": [
        "math-mis-md-groups-size-swap"
      ],
      "sequence": [
        "Label groups and items per group.",
        "Build the same product with two array orientations.",
        "Explain what changes in a story even when the product stays equal."
      ]
    },
    {
      "id": "reteach-md-division-meaning",
      "targets": [
        "math-mis-md-division-subtraction"
      ],
      "sequence": [
        "Circle equal groups in a total.",
        "Count groups or count items per group.",
        "Connect repeated subtraction to the number of jumps, not one subtraction."
      ]
    },
    {
      "id": "reteach-md-fact-family",
      "targets": [
        "math-mis-md-inverse-gap"
      ],
      "sequence": [
        "Build one array.",
        "Write two multiplication equations.",
        "Cover one factor and write two related division equations.",
        "Use multiplication to check division."
      ]
    },
    {
      "id": "reteach-md-area-model",
      "targets": [
        "math-mis-md-repeated-add-only",
        "math-mis-md-partial-product"
      ],
      "sequence": [
        "Partition a factor by place value.",
        "Label each rectangle.",
        "Compute every partial product.",
        "Combine and check with an estimate."
      ]
    },
    {
      "id": "reteach-md-remainder-context",
      "targets": [
        "math-mis-md-remainder-rule"
      ],
      "sequence": [
        "Solve one division calculation.",
        "Place the same quotient and remainder in three different stories.",
        "Decide whether to drop, report, or use another group based on units."
      ]
    }
  ],
  "prerequisiteRemediationBranches": [
    {
      "id": "prerequisite-remediation-md-groups",
      "targets": [
        "equal groups",
        "skip counting",
        "basic facts"
      ],
      "activities": [
        "Build groups with counters.",
        "Write repeated addition and multiplication for the same model.",
        "Find missing factors within 10 × 10."
      ],
      "exitEvidence": "Correctly label and explain three equal-group models in two separate attempts."
    }
  ],
  "parentTeacherReview": {
    "lookFor": [
      "Can the learner label groups and group size?",
      "Does the learner use multiplication to check division?",
      "Can the learner explain what a remainder means in the specific story?"
    ],
    "avoid": [
      "Drilling isolated facts as the only evidence.",
      "Accepting an unexplained rounded quotient in a context problem.",
      "Calling slow counting a failure instead of offering structure."
    ],
    "reviewPrompt": "Ask: “What multiplication fact proves your division result?”"
  },
  "noMediaFallback": {
    "instructions": [
      "Draw arrays as dots in rows.",
      "Circle equal groups on paper.",
      "Split rectangles with a vertical line for area models.",
      "Use tick marks for number-line jumps."
    ],
    "fullyFunctionalWithoutMedia": true
  },
  "policy": {
    "finalAnswerPolicy": "Do not reveal a final answer before the learner attempts the current step and explains reasoning.",
    "turnPolicy": "Present exactly one step or one question at a time.",
    "reasoningPolicy": "Ask the learner to explain how they know before advancing.",
    "evidencePolicy": "Treat incorrect answers as evidence for routing, not as a character judgment.",
    "languagePolicy": "Use warm, specific, non-shaming language. Never label a learner as bad at math.",
    "diagnosisPolicy": "Do not diagnose dyscalculia or any medical, developmental, or learning condition.",
    "integrityPolicy": "Do not complete graded homework. Offer concept instruction or a similar ungraded example instead.",
    "masteryPolicy": "Never claim mastery from one correct response; require repeated evidence across representations.",
    "privacyPolicy": "Never require a camera, microphone, or identifiable child photo."
  }
} as const satisfies AdaptiveMathSequence
