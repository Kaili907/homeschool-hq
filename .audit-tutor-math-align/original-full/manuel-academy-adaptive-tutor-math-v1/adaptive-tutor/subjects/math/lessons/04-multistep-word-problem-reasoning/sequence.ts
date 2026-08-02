import type { AdaptiveMathSequence } from '../../types'

export const sequence = {
  "sequenceId": "math-seq-multistep-word-problems-v1",
  "lessonId": "math-lesson-04-multistep-word-problem-reasoning",
  "version": "1.0.0",
  "order": "04",
  "title": "Multistep Word-Problem Reasoning",
  "summary": "Use organizers, units, hidden questions, step diagrams, and checks to reason through multistep problems.",
  "gradeBand": {
    "minimum": 4,
    "maximum": 6,
    "primary": [
      4,
      5,
      6
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
    "instruction": 30,
    "guidedPractice": 25,
    "masteryCheck": 25
  },
  "skillIds": [
    "math-skill-wp-represent-v1",
    "math-skill-wp-plan-v1",
    "math-skill-wp-units-v1",
    "math-skill-wp-check-v1"
  ],
  "legacySkillMappings": [
    "word2",
    "word4"
  ],
  "prerequisites": [
    "Interpret the four operations in one-step situations.",
    "Multiply and divide whole numbers at the learner’s instructional level.",
    "Add and subtract multi-digit whole numbers.",
    "Read and label common measurement and money units."
  ],
  "objectives": [
    "Identify the final question, relevant data, and answer unit.",
    "Name hidden intermediate questions and order dependent steps.",
    "Represent relationships with diagrams, equations, and organizers.",
    "Check reasonableness and explain how the result answers the story."
  ],
  "diagnostic": {
    "items": [
      {
        "id": "math-wp-d01",
        "type": "multiple-choice",
        "prompt": "A school store opens 8 boxes with 6 notebooks in each box. It sells 19 notebooks. Which plan finds how many remain?",
        "choices": [
          {
            "id": "A",
            "text": "8 + 6 − 19"
          },
          {
            "id": "B",
            "text": "8 × 6 − 19"
          },
          {
            "id": "C",
            "text": "19 − 8 × 6"
          },
          {
            "id": "D",
            "text": "8 × (6 − 19)"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "First find total notebooks with 8 × 6, then subtract the 19 sold.",
        "misconceptionSignals": {
          "A": [
            "math-mis-wp-keyword-only"
          ],
          "C": [
            "math-mis-wp-wrong-order"
          ],
          "D": [
            "math-mis-wp-wrong-order"
          ]
        },
        "representation": "step-diagram",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-d02",
        "type": "multiple-choice",
        "prompt": "A class has 24 students. Tickets cost $12 per student, and the bus fee is $85. Which expression gives the total trip cost?",
        "choices": [
          {
            "id": "A",
            "text": "24 + 12 + 85"
          },
          {
            "id": "B",
            "text": "24 × 12 + 85"
          },
          {
            "id": "C",
            "text": "24 × (12 + 85)"
          },
          {
            "id": "D",
            "text": "85 − 24 × 12"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Multiply students by cost per student, then add the one-time bus fee.",
        "misconceptionSignals": {
          "A": [
            "math-mis-wp-unit-mismatch"
          ],
          "C": [
            "math-mis-wp-wrong-order"
          ],
          "D": [
            "math-mis-wp-wrong-order"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-d03",
        "type": "multiple-choice",
        "prompt": "A problem says a library has 7 shelves with 24 books each, 38 books are checked out, and the library opened in 1998. Which number is not needed to find books currently on shelves?",
        "choices": [
          {
            "id": "A",
            "text": "7"
          },
          {
            "id": "B",
            "text": "24"
          },
          {
            "id": "C",
            "text": "38"
          },
          {
            "id": "D",
            "text": "1998"
          }
        ],
        "correctChoiceId": "D",
        "reasoning": "The opening year does not connect to the quantity of books currently on shelves.",
        "misconceptionSignals": {
          "A": [
            "math-mis-wp-use-all-numbers"
          ],
          "B": [
            "math-mis-wp-use-all-numbers"
          ],
          "C": [
            "math-mis-wp-use-all-numbers"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-d04",
        "type": "multiple-choice",
        "prompt": "After calculating 9 boxes × 12 shirts = 108 shirts, what should you ask next if 47 shirts were sold?",
        "choices": [
          {
            "id": "A",
            "text": "Is 108 even?"
          },
          {
            "id": "B",
            "text": "How many shirts remain after 47 are sold?"
          },
          {
            "id": "C",
            "text": "What is 9 + 12?"
          },
          {
            "id": "D",
            "text": "Can I stop because I used multiplication?"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "108 is an intermediate total; the final question requires subtracting the amount sold.",
        "misconceptionSignals": {
          "A": [
            "math-mis-wp-no-check"
          ],
          "C": [
            "math-mis-wp-keyword-only"
          ],
          "D": [
            "math-mis-wp-one-step-stop"
          ]
        },
        "representation": "step-diagram",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-d05",
        "type": "multiple-choice",
        "prompt": "Thirty-five tickets cost $8 each, plus a $45 room fee. A group pays $350. Which order is correct for finding change?",
        "choices": [
          {
            "id": "A",
            "text": "350 − 45, then × 8"
          },
          {
            "id": "B",
            "text": "35 × 8, then + 45, then subtract from 350"
          },
          {
            "id": "C",
            "text": "35 + 8 + 45, then subtract from 350"
          },
          {
            "id": "D",
            "text": "350 ÷ 35, then + 45"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Find ticket cost, add the fee, then subtract total cost from amount paid.",
        "misconceptionSignals": {
          "A": [
            "math-mis-wp-wrong-order"
          ],
          "C": [
            "math-mis-wp-unit-mismatch"
          ],
          "D": [
            "math-mis-wp-keyword-only"
          ]
        },
        "representation": "step-diagram",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-d06",
        "type": "open-response",
        "prompt": "A garden has 6 rows of 14 plants. Twenty-nine plants are given away. Explain how you would solve and check how many remain without calculating the final answer yet.",
        "acceptableEvidence": [
          "Plan: multiply 6 × 14 to find the starting total, then subtract 29.",
          "Names plants as the unit.",
          "Check: result must be less than starting total and nonnegative; estimate can be used."
        ],
        "reasoning": "A correct plan identifies the dependent intermediate total and a reasonableness check without requiring the final answer immediately.",
        "misconceptionSignals": {
          "stops after product": [
            "math-mis-wp-one-step-stop"
          ],
          "subtracts first": [
            "math-mis-wp-wrong-order"
          ],
          "no units": [
            "math-mis-wp-unit-mismatch"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "routingRules": [
      {
        "when": "one-step operation meanings are insecure",
        "route": "prerequisite-remediation-wp-one-step"
      },
      {
        "when": "all numbers are used automatically",
        "route": "reteach-wp-relevant-data"
      },
      {
        "when": "intermediate result is reported as final",
        "route": "reteach-wp-answer-target"
      },
      {
        "when": "operations are correct but ordered incorrectly",
        "route": "reteach-wp-step-order"
      }
    ]
  },
  "misconceptions": [
    {
      "id": "math-mis-wp-keyword-only",
      "label": "Chooses operations from one keyword",
      "likelyEvidence": [
        "Sees “left” and always subtracts, even when the structure differs.",
        "Sees “each” and multiplies without identifying known and unknown quantities."
      ],
      "distinguishingEvidence": [
        "Remove the keyword and ask for a diagram.",
        "Use two stories with the same keyword but different structures."
      ],
      "firstResponse": "A keyword can be a clue, but the quantities and their relationships decide the operation.",
      "route": "reteach-wp-relationships"
    },
    {
      "id": "math-mis-wp-use-all-numbers",
      "label": "Uses every number whether relevant or not",
      "likelyEvidence": [
        "Includes a date, room number, or unused count in a calculation.",
        "Cannot explain what a number measures."
      ],
      "distinguishingEvidence": [
        "Ask for units beside every number.",
        "Ask which quantities connect to the question."
      ],
      "firstResponse": "Not every number must be used. Let’s label what each number measures and connect only the needed quantities.",
      "route": "reteach-wp-relevant-data"
    },
    {
      "id": "math-mis-wp-one-step-stop",
      "label": "Stops after an intermediate result",
      "likelyEvidence": [
        "Finds total made but not how many remain.",
        "Answers the first hidden question rather than the stated question."
      ],
      "distinguishingEvidence": [
        "Ask “What does this number answer?”",
        "Underline the final question and compare units."
      ],
      "firstResponse": "That number answers an important first step. Now let’s return to the question and see what is still missing.",
      "route": "reteach-wp-answer-target"
    },
    {
      "id": "math-mis-wp-wrong-order",
      "label": "Uses correct operations in the wrong order",
      "likelyEvidence": [
        "Subtracts before finding the total produced.",
        "Treats a fee as part of a per-person amount."
      ],
      "distinguishingEvidence": [
        "Build a step diagram with arrows.",
        "Ask which quantity must exist before the next calculation can happen."
      ],
      "firstResponse": "You selected useful operations. Let’s put them in dependency order so each step creates what the next step needs.",
      "route": "reteach-wp-step-order"
    },
    {
      "id": "math-mis-wp-unit-mismatch",
      "label": "Combines quantities with incompatible units",
      "likelyEvidence": [
        "Adds students to dollars or boxes to individual items.",
        "Writes a numeric answer without the requested unit."
      ],
      "distinguishingEvidence": [
        "Label every quantity and operation with units.",
        "Ask what one product or quotient represents."
      ],
      "firstResponse": "The numbers need matching meanings before they can be combined. Let’s attach a unit to every quantity.",
      "route": "reteach-wp-units"
    },
    {
      "id": "math-mis-wp-no-check",
      "label": "Accepts a computation without checking reasonableness or the question",
      "likelyEvidence": [
        "Reports more items remaining than were made.",
        "Does not notice negative or impossible context results."
      ],
      "distinguishingEvidence": [
        "Estimate before exact calculation.",
        "Substitute the result back into the story."
      ],
      "firstResponse": "The calculation is not the last step. Let’s check the size, unit, and whether it answers the actual question.",
      "route": "reteach-wp-check"
    }
  ],
  "visualExplanationPlan": {
    "representations": [
      "word-problem-organizer",
      "step-diagram",
      "array",
      "number-line"
    ],
    "boards": [
      {
        "id": "wp-board-01",
        "kind": "word-problem-organizer",
        "action": "fill",
        "payload": {
          "fields": [
            "What is asked?",
            "Known quantities and units",
            "Useful or extra?",
            "Hidden first question",
            "Operation plan",
            "Check"
          ]
        },
        "altText": "Organizer with boxes for the question, quantities, relevance, hidden question, plan, and check.",
        "narrationCue": "wp-n03"
      },
      {
        "id": "wp-board-02",
        "kind": "step-diagram",
        "action": "connect",
        "payload": {
          "steps": [
            "8 boxes × 6 notebooks",
            "48 notebooks − 19 sold",
            "notebooks remaining"
          ],
          "arrows": [
            "creates starting total",
            "answers final question"
          ]
        },
        "altText": "Two-step diagram multiplying to find a total, then subtracting sold notebooks.",
        "narrationCue": "wp-n05"
      },
      {
        "id": "wp-board-03",
        "kind": "array",
        "action": "show",
        "payload": {
          "rows": 7,
          "columns": 24,
          "label": "books before checkout"
        },
        "altText": "Array representing seven shelves with twenty-four books on each shelf.",
        "narrationCue": "wp-n04"
      },
      {
        "id": "wp-board-04",
        "kind": "step-diagram",
        "action": "annotate-units",
        "payload": {
          "expression": "24 students × $12/student + $85 bus fee",
          "units": [
            "students",
            "dollars per student",
            "dollars"
          ]
        },
        "altText": "Unit-labeled expression showing student units cancel to dollars before adding a dollar fee.",
        "narrationCue": "wp-n06"
      },
      {
        "id": "wp-board-05",
        "kind": "number-line",
        "action": "estimate",
        "payload": {
          "start": 400,
          "subtractApprox": 370,
          "endApprox": 30,
          "unit": "dollars"
        },
        "altText": "Number line estimating four hundred dollars minus about three hundred seventy dollars to about thirty dollars.",
        "narrationCue": "wp-n08"
      }
    ],
    "accessibility": [
      "Organizer fields use plain language and can be read aloud.",
      "Units appear in text, not only color.",
      "Problems remain solvable with pencil and paper only."
    ]
  },
  "spokenExplanation": {
    "voice": "warm, strategic, unhurried, nonjudgmental",
    "segments": [
      [
        "wp-n01",
        "A multistep word problem is a relationship puzzle, not a keyword hunt."
      ],
      [
        "wp-n02",
        "Begin by stating exactly what the question asks and the unit the answer must use."
      ],
      [
        "wp-n03",
        "Label every number with its meaning, then mark any information that is not connected to the question."
      ],
      [
        "wp-n04",
        "Use a drawing, array, table, or organizer to show how quantities are related."
      ],
      [
        "wp-n05",
        "Name the hidden first question. Its answer becomes information for the next step."
      ],
      [
        "wp-n06",
        "Put operations in dependency order and keep units attached to the calculations."
      ],
      [
        "wp-n07",
        "Pause after each step and ask what that result means in the story."
      ],
      [
        "wp-n08",
        "Estimate before or after exact work to check the size of the result."
      ],
      [
        "wp-n09",
        "Use an inverse operation or substitute the result back into the story when possible."
      ],
      [
        "wp-n10",
        "The solution is complete only when the final number, unit, and explanation answer the original question."
      ]
    ]
  },
  "modes": {
    "showMe": {
      "purpose": "Watch a story become a two-step diagram without revealing the final result at the start.",
      "example": "7 shelves × 24 books, then 38 checked out",
      "steps": [
        {
          "id": "wp-sm-01",
          "prompt": "What is the final question asking us to count?",
          "expectedEvidence": "Books currently on shelves.",
          "hint": "Underline the requested unit.",
          "visualCommandId": "wp-board-01",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "wp-sm-02",
          "prompt": "What hidden quantity must be found before subtracting checked-out books?",
          "expectedEvidence": "The total books before checkout.",
          "hint": "Which two quantities describe equal groups?",
          "visualCommandId": "wp-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "wp-sm-03",
          "prompt": "After both steps, how can you check the result?",
          "expectedEvidence": "Add checked-out books back to the remaining amount or estimate.",
          "hint": "Reverse the last operation.",
          "visualCommandId": "wp-board-02",
          "answerRevealPolicy": "after-worked-steps",
          "onePromptOnly": true
        }
      ]
    },
    "talkMeThroughIt": {
      "purpose": "The learner narrates a plan before computing.",
      "example": "9 boxes of 12 shirts; 47 sold",
      "steps": [
        {
          "id": "wp-tm-01",
          "prompt": "Tell me what each number measures.",
          "expectedEvidence": "9 boxes, 12 shirts per box, 47 shirts sold.",
          "hint": "Attach a unit to every number.",
          "visualCommandId": "wp-board-01",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "wp-tm-02",
          "prompt": "Which quantity must be created first?",
          "expectedEvidence": "Starting total shirts from 9 × 12.",
          "hint": "The amount sold must be removed from what total?",
          "visualCommandId": "wp-board-02",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "wp-tm-03",
          "prompt": "What check will show your final result answers the story?",
          "expectedEvidence": "Remaining + sold = starting total, with shirts as the unit.",
          "hint": "Reverse the subtraction and read the question again.",
          "visualCommandId": "wp-board-02",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    },
    "letsDoOneTogether": {
      "purpose": "Alternate organizer fields and calculations.",
      "example": "35 tickets at $8 plus $45 fee; paid $350",
      "steps": [
        {
          "id": "wp-tg-01",
          "prompt": "I identified the final unit as dollars of change. You write the first hidden question.",
          "expectedEvidence": "What is the cost of 35 tickets?",
          "hint": "Use tickets × dollars per ticket.",
          "visualCommandId": "wp-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "wp-tg-02",
          "prompt": "I will add the room fee after the ticket total. You explain why it is added only once.",
          "expectedEvidence": "It is a one-time fee, not a per-ticket fee.",
          "hint": "Compare the units and wording.",
          "visualCommandId": "wp-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "wp-tg-03",
          "prompt": "You find the change and estimate to check it. What should the estimate be near?",
          "expectedEvidence": "About $25 to $30.",
          "hint": "Round the total cost near $325.",
          "visualCommandId": "wp-board-05",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    },
    "differentExample": {
      "purpose": "Transfer the organizer to a non-money context.",
      "example": "6 rows of 14 plants; 29 given away",
      "steps": [
        {
          "id": "wp-de-01",
          "prompt": "Which model represents the starting number of plants?",
          "expectedEvidence": "An array with 6 rows of 14.",
          "hint": "Identify equal groups.",
          "visualCommandId": "wp-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "wp-de-02",
          "prompt": "Why must multiplication happen before subtraction?",
          "expectedEvidence": "The amount given away is removed from the full starting total.",
          "hint": "Ask which number the 29 is part of.",
          "visualCommandId": "wp-board-02",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "wp-de-03",
          "prompt": "What makes a final result reasonable?",
          "expectedEvidence": "It is less than 84, nonnegative, and the units are plants.",
          "hint": "Estimate and check the requested unit.",
          "visualCommandId": "wp-board-01",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    }
  },
  "guidedPractice": {
    "items": [
      {
        "id": "math-wp-g01",
        "type": "multiple-choice",
        "prompt": "A club fills 12 bags with 15 pencils each and gives away 68 pencils. Which two operations are needed?",
        "choices": [
          {
            "id": "A",
            "text": "Addition then division"
          },
          {
            "id": "B",
            "text": "Multiplication then subtraction"
          },
          {
            "id": "C",
            "text": "Subtraction then multiplication"
          },
          {
            "id": "D",
            "text": "Division then addition"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Find total pencils, then remove the amount given away.",
        "misconceptionSignals": {
          "A": [
            "math-mis-wp-keyword-only"
          ],
          "C": [
            "math-mis-wp-wrong-order"
          ],
          "D": [
            "math-mis-wp-keyword-only"
          ]
        },
        "representation": "step-diagram",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-g02",
        "type": "open-response",
        "prompt": "For the pencil problem, write the hidden first question and the final question.",
        "acceptableEvidence": [
          "Hidden: How many pencils are in 12 bags?",
          "Final: How many pencils remain after 68 are given away?"
        ],
        "reasoning": "Naming intermediate and final questions prevents stopping early.",
        "misconceptionSignals": {
          "only hidden question": [
            "math-mis-wp-one-step-stop"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-g03",
        "type": "multiple-choice",
        "prompt": "A family buys 4 museum tickets at $18 each and pays a $6 parking fee. What is the total cost?",
        "choices": [
          {
            "id": "A",
            "text": "$72"
          },
          {
            "id": "B",
            "text": "$78"
          },
          {
            "id": "C",
            "text": "$96"
          },
          {
            "id": "D",
            "text": "$102"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "4 × $18 = $72, then $72 + $6 = $78.",
        "misconceptionSignals": {
          "A": [
            "math-mis-wp-one-step-stop"
          ],
          "C": [
            "math-mis-wp-wrong-order"
          ],
          "D": [
            "math-mis-wp-unit-mismatch"
          ]
        },
        "representation": "step-diagram",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-g04",
        "type": "multiple-choice",
        "prompt": "A tank holds 250 liters. It contains 138 liters, then 47 more liters are added. How many more liters are needed to fill it?",
        "choices": [
          {
            "id": "A",
            "text": "65 liters"
          },
          {
            "id": "B",
            "text": "159 liters"
          },
          {
            "id": "C",
            "text": "185 liters"
          },
          {
            "id": "D",
            "text": "203 liters"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "First find 138 + 47 = 185 liters, then 250 − 185 = 65 liters.",
        "misconceptionSignals": {
          "B": [
            "math-mis-wp-one-step-stop"
          ],
          "C": [
            "math-mis-wp-one-step-stop"
          ],
          "D": [
            "math-mis-wp-wrong-order"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-g05",
        "type": "open-response",
        "prompt": "A story includes 5 tables, 8 chairs per table, 3 windows, and 7 extra chairs. Identify the data needed to find the total number of chairs.",
        "acceptableEvidence": [
          "Uses 5 tables, 8 chairs per table, and 7 extra chairs.",
          "Excludes 3 windows.",
          "Plans 5 × 8 + 7."
        ],
        "reasoning": "The window count is unrelated to the requested chair total.",
        "misconceptionSignals": {
          "uses windows": [
            "math-mis-wp-use-all-numbers"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-g06",
        "type": "open-response",
        "prompt": "Solve and check: A camp orders 9 cases of 24 water bottles and uses 157 bottles. How many remain?",
        "acceptableEvidence": [
          "9 × 24 = 216.",
          "216 − 157 = 59 bottles.",
          "Checks 59 + 157 = 216 or uses an estimate."
        ],
        "reasoning": "The inverse check confirms the remaining and used amounts return to the starting total.",
        "misconceptionSignals": {
          "stops at 216": [
            "math-mis-wp-one-step-stop"
          ],
          "no unit": [
            "math-mis-wp-unit-mismatch"
          ],
          "no check": [
            "math-mis-wp-no-check"
          ]
        },
        "representation": "step-diagram",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "scaffolding": "Require a plan and unit labels before computation; gradually remove organizer prompts."
  },
  "independentMasteryCheck": {
    "items": [
      {
        "id": "math-wp-m01",
        "type": "multiple-choice",
        "prompt": "A theater has 14 rows with 18 seats in each row. Twenty-seven seats are blocked. How many seats are available?",
        "choices": [
          {
            "id": "A",
            "text": "225"
          },
          {
            "id": "B",
            "text": "242"
          },
          {
            "id": "C",
            "text": "252"
          },
          {
            "id": "D",
            "text": "279"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "14 × 18 = 252, then 252 − 27 = 225.",
        "misconceptionSignals": {
          "B": [
            "math-mis-wp-one-step-stop"
          ],
          "C": [
            "math-mis-wp-one-step-stop"
          ],
          "D": [
            "math-mis-wp-wrong-order"
          ]
        },
        "representation": "symbolic",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-m02",
        "type": "multiple-choice",
        "prompt": "A team buys 16 meals at $9 each and pays a $24 delivery fee. It pays with $200. How much change should it receive?",
        "choices": [
          {
            "id": "A",
            "text": "$32"
          },
          {
            "id": "B",
            "text": "$56"
          },
          {
            "id": "C",
            "text": "$80"
          },
          {
            "id": "D",
            "text": "$168"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "16 × $9 = $144; $144 + $24 = $168; $200 − $168 = $32.",
        "misconceptionSignals": {
          "B": [
            "math-mis-wp-one-step-stop"
          ],
          "C": [
            "math-mis-wp-wrong-order"
          ],
          "D": [
            "math-mis-wp-one-step-stop"
          ]
        },
        "representation": "step-diagram",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-m03",
        "type": "open-response",
        "prompt": "A warehouse has 11 shelves with 32 boxes each. It ships 145 boxes and receives 28 new boxes. Write and solve a step plan for the current number of boxes.",
        "acceptableEvidence": [
          "11 × 32 = 352.",
          "352 − 145 = 207.",
          "207 + 28 = 235 boxes.",
          "Explains the order and unit."
        ],
        "reasoning": "The current inventory begins with shelf total, removes shipped boxes, then adds received boxes.",
        "misconceptionSignals": {
          "wrong order": [
            "math-mis-wp-wrong-order"
          ],
          "stops early": [
            "math-mis-wp-one-step-stop"
          ],
          "no unit": [
            "math-mis-wp-unit-mismatch"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-m04",
        "type": "open-response",
        "prompt": "A recipe card says 6 trays, 15 muffins per tray, 2 oven racks, and 34 muffins served. Which data is relevant to muffins remaining, and why?",
        "acceptableEvidence": [
          "Uses 6, 15, and 34.",
          "Excludes 2 oven racks because it does not measure muffins.",
          "Plans 6 × 15 − 34."
        ],
        "reasoning": "Only quantities linked to muffin totals are needed.",
        "misconceptionSignals": {
          "uses all numbers": [
            "math-mis-wp-use-all-numbers"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-m05",
        "type": "open-response",
        "prompt": "A bus can carry 48 passengers. Three buses are available for 137 passengers. Determine whether there are enough seats and explain your check.",
        "acceptableEvidence": [
          "3 × 48 = 144 seats.",
          "144 − 137 = 7 seats remain.",
          "Concludes there are enough seats and checks units/reasonableness."
        ],
        "reasoning": "The capacity exceeds passengers by 7, so all passengers can ride.",
        "misconceptionSignals": {
          "subtracts wrong order": [
            "math-mis-wp-wrong-order"
          ],
          "no conclusion": [
            "math-mis-wp-one-step-stop"
          ],
          "no unit": [
            "math-mis-wp-unit-mismatch"
          ]
        },
        "representation": "step-diagram",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-wp-m06",
        "type": "open-response",
        "prompt": "Create a two-step word problem represented by 7 × 16 − 25. Label the units and explain what each step finds.",
        "acceptableEvidence": [
          "Creates a coherent equal-groups context.",
          "First step finds total 112 units.",
          "Second step removes 25 and finds 87 units.",
          "Question asks for the final remaining amount."
        ],
        "reasoning": "A valid story matches both operation order and units.",
        "misconceptionSignals": {
          "keyword mismatch": [
            "math-mis-wp-keyword-only"
          ],
          "unit mismatch": [
            "math-mis-wp-unit-mismatch"
          ]
        },
        "representation": "word-problem-organizer",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "masteryRule": "Across at least two sessions, show secure evidence on at least 5 of 6 items, including one money context, one irrelevant-data item, one three-step item, and one created problem. One correct numeric answer is not mastery.",
    "retryRule": "Use a parallel context with different quantities and a different placement of extra information."
  },
  "reteachingBranches": [
    {
      "id": "reteach-wp-relationships",
      "targets": [
        "math-mis-wp-keyword-only"
      ],
      "sequence": [
        "Remove keywords and draw the relationship.",
        "Compare two stories sharing the same keyword.",
        "Choose the operation from known and unknown quantities."
      ]
    },
    {
      "id": "reteach-wp-relevant-data",
      "targets": [
        "math-mis-wp-use-all-numbers"
      ],
      "sequence": [
        "Attach units to every number.",
        "Connect quantities to the final question with arrows.",
        "Cross out one unrelated fact and explain why."
      ]
    },
    {
      "id": "reteach-wp-answer-target",
      "targets": [
        "math-mis-wp-one-step-stop"
      ],
      "sequence": [
        "Underline the final question.",
        "Name the hidden first question.",
        "After each calculation, state what the result answers.",
        "Continue until the original question is answered."
      ]
    },
    {
      "id": "reteach-wp-step-order",
      "targets": [
        "math-mis-wp-wrong-order"
      ],
      "sequence": [
        "Write each needed quantity in a box.",
        "Draw arrows from prerequisites to later steps.",
        "Compute only after the dependency order is clear."
      ]
    },
    {
      "id": "reteach-wp-units",
      "targets": [
        "math-mis-wp-unit-mismatch"
      ],
      "sequence": [
        "Label every quantity.",
        "Check which units can be added or subtracted.",
        "Explain product or quotient units in words.",
        "Write the final unit."
      ]
    },
    {
      "id": "reteach-wp-check",
      "targets": [
        "math-mis-wp-no-check"
      ],
      "sequence": [
        "Estimate the expected range.",
        "Use an inverse check.",
        "Read the final sentence with the answer inserted.",
        "Reject impossible sizes or units."
      ]
    }
  ],
  "prerequisiteRemediationBranches": [
    {
      "id": "prerequisite-remediation-wp-one-step",
      "targets": [
        "operation meaning",
        "known/unknown quantities",
        "units"
      ],
      "activities": [
        "Sort one-step stories by relationship, not keyword.",
        "Draw one model for each operation.",
        "Match equations to stories and explain units."
      ],
      "exitEvidence": "Solve and explain four one-step relationship types across two attempts."
    }
  ],
  "parentTeacherReview": {
    "lookFor": [
      "Does the learner name the final unit before calculating?",
      "Can the learner state what each intermediate result means?",
      "Does the learner check reasonableness and answer the actual question?"
    ],
    "avoid": [
      "Telling the operation from a keyword.",
      "Correcting arithmetic before checking the learner’s plan.",
      "Counting an unexplained number as full success."
    ],
    "reviewPrompt": "Ask: “What question did your first step answer, and what was still missing?”"
  },
  "noMediaFallback": {
    "instructions": [
      "Fold paper into six organizer boxes: ask, know, extra, hidden question, steps, check.",
      "Draw arrows between dependent steps.",
      "Write units beside every number.",
      "Use a rough estimate and inverse check on paper."
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
