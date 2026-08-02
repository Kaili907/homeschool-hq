import type { AdaptiveMathSequence } from '../../types'

export const sequence = {
  "sequenceId": "math-seq-equivalent-fractions-v1",
  "lessonId": "math-lesson-03-equivalent-fractions-common-denominators",
  "version": "1.0.0",
  "order": "03",
  "title": "Equivalent Fractions and Common Denominators",
  "summary": "Use fraction bars, number lines, multiples, and area models to build equivalence and operate with unlike denominators.",
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
    "instruction": 30,
    "guidedPractice": 25,
    "masteryCheck": 20
  },
  "skillIds": [
    "math-skill-fr-equivalence-v1",
    "math-skill-fr-common-denominator-v1",
    "math-skill-fr-add-sub-v1",
    "math-skill-fr-compare-v1"
  ],
  "legacySkillMappings": [
    "fracUnit",
    "fracComp",
    "fracEquiv4",
    "fracAddSub4"
  ],
  "prerequisites": [
    "Recognize numerator and denominator.",
    "Partition the same-size whole into equal parts.",
    "Recall multiplication facts and list multiples."
  ],
  "objectives": [
    "Generate and explain equivalent fractions.",
    "Find useful common denominators.",
    "Add and subtract fractions with unlike denominators.",
    "Compare fractions using models and common units."
  ],
  "diagnostic": {
    "items": [
      {
        "id": "math-fr-d01",
        "type": "multiple-choice",
        "prompt": "Which fraction is equivalent to 2/3?",
        "choices": [
          {
            "id": "A",
            "text": "4/5"
          },
          {
            "id": "B",
            "text": "4/6"
          },
          {
            "id": "C",
            "text": "6/8"
          },
          {
            "id": "D",
            "text": "8/9"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Multiply numerator and denominator by 2: 2/3 = 4/6.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-one-sided-scale"
          ],
          "C": [
            "math-mis-fr-one-sided-scale"
          ],
          "D": [
            "math-mis-fr-one-sided-scale"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-d02",
        "type": "multiple-choice",
        "prompt": "Which statement is true?",
        "choices": [
          {
            "id": "A",
            "text": "1/8 > 1/4"
          },
          {
            "id": "B",
            "text": "1/8 < 1/4"
          },
          {
            "id": "C",
            "text": "1/8 = 1/4"
          },
          {
            "id": "D",
            "text": "They cannot be compared"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "With the same-size whole, eighths are smaller than fourths.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-whole-number-rules"
          ],
          "C": [
            "math-mis-fr-whole-number-rules"
          ],
          "D": [
            "math-mis-fr-unequal-wholes"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-d03",
        "type": "multiple-choice",
        "prompt": "What is a useful least common denominator for 2/5 and 1/3?",
        "choices": [
          {
            "id": "A",
            "text": "8"
          },
          {
            "id": "B",
            "text": "10"
          },
          {
            "id": "C",
            "text": "15"
          },
          {
            "id": "D",
            "text": "30"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "15 is the least positive number divisible by both 5 and 3.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-add-denominators"
          ],
          "B": [
            "math-mis-fr-common-product-only"
          ],
          "D": [
            "math-mis-fr-common-product-only"
          ]
        },
        "representation": "multiples-list",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-d04",
        "type": "multiple-choice",
        "prompt": "What is 3/8 + 1/4?",
        "choices": [
          {
            "id": "A",
            "text": "4/12"
          },
          {
            "id": "B",
            "text": "4/8"
          },
          {
            "id": "C",
            "text": "5/8"
          },
          {
            "id": "D",
            "text": "3/32"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "Rename 1/4 as 2/8, then 3/8 + 2/8 = 5/8.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-add-denominators"
          ],
          "B": [
            "math-mis-fr-one-sided-scale"
          ],
          "D": [
            "math-mis-fr-add-denominators"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-d05",
        "type": "multiple-choice",
        "prompt": "Which is greater: 5/6 or 7/9?",
        "choices": [
          {
            "id": "A",
            "text": "5/6"
          },
          {
            "id": "B",
            "text": "7/9"
          },
          {
            "id": "C",
            "text": "They are equal"
          },
          {
            "id": "D",
            "text": "Not enough information"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "Use eighteenths: 5/6 = 15/18 and 7/9 = 14/18.",
        "misconceptionSignals": {
          "B": [
            "math-mis-fr-whole-number-rules"
          ],
          "C": [
            "math-mis-fr-one-sided-scale"
          ],
          "D": [
            "math-mis-fr-unequal-wholes"
          ]
        },
        "representation": "number-line",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-d06",
        "type": "open-response",
        "prompt": "Explain why multiplying 3/5 by 2/2 does not change its value.",
        "acceptableEvidence": [
          "States 2/2 equals 1.",
          "Multiplying by 1 keeps the value.",
          "Connects 3/5 to 6/10 with equal bars or the same number-line point."
        ],
        "reasoning": "The numerator and denominator scale together by the same factor, which multiplies the fraction by 1.",
        "misconceptionSignals": {
          "only numerator changes": [
            "math-mis-fr-one-sided-scale"
          ],
          "says value doubles": [
            "math-mis-fr-one-sided-scale"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "routingRules": [
      {
        "when": "unit-fraction size is insecure",
        "route": "prerequisite-remediation-fr-parts"
      },
      {
        "when": "scaling is one-sided",
        "route": "reteach-fr-equivalence"
      },
      {
        "when": "denominators are added",
        "route": "reteach-fr-common-units"
      },
      {
        "when": "comparison uses different wholes",
        "route": "reteach-fr-same-whole"
      }
    ]
  },
  "misconceptions": [
    {
      "id": "math-mis-fr-whole-number-rules",
      "label": "Applies whole-number size rules to denominators",
      "likelyEvidence": [
        "Says 1/8 is greater than 1/4 because 8 is greater than 4.",
        "Chooses the fraction with the larger denominator when numerators match."
      ],
      "distinguishingEvidence": [
        "Compare equal-size fraction bars.",
        "Place both fractions between 0 and 1 on a number line."
      ],
      "firstResponse": "The denominator tells how many equal parts make the whole. More equal parts means each part is smaller.",
      "route": "reteach-fr-unit-size"
    },
    {
      "id": "math-mis-fr-one-sided-scale",
      "label": "Scales only the numerator or only the denominator",
      "likelyEvidence": [
        "Changes 2/3 to 4/3 or 2/6.",
        "Cannot explain why multiplying by n/n keeps value equal."
      ],
      "distinguishingEvidence": [
        "Overlay fraction bars before and after scaling.",
        "Ask what form of 1 was multiplied."
      ],
      "firstResponse": "For an equivalent fraction, the numerator and denominator must be scaled by the same nonzero factor.",
      "route": "reteach-fr-equivalence"
    },
    {
      "id": "math-mis-fr-add-denominators",
      "label": "Adds numerators and denominators",
      "likelyEvidence": [
        "Computes 2/5 + 1/3 as 3/8.",
        "Treats unlike-size pieces as directly countable."
      ],
      "distinguishingEvidence": [
        "Ask whether fifths and thirds are the same-size pieces.",
        "Use fraction bars to rename both fractions in equal-sized parts."
      ],
      "firstResponse": "We can combine only pieces with the same name. Let’s rename both fractions with a common denominator first.",
      "route": "reteach-fr-common-units"
    },
    {
      "id": "math-mis-fr-common-product-only",
      "label": "Believes the product is the only possible common denominator",
      "likelyEvidence": [
        "Uses 48 for 3/8 and 1/4 and cannot see 8.",
        "Finds a correct but unnecessarily large denominator and becomes error-prone."
      ],
      "distinguishingEvidence": [
        "List multiples of both denominators.",
        "Ask for the least shared multiple and another valid shared multiple."
      ],
      "firstResponse": "The product can work, but a smaller shared multiple may make the work easier.",
      "route": "reteach-fr-common-denominator"
    },
    {
      "id": "math-mis-fr-unequal-wholes",
      "label": "Compares fraction models built from different-size wholes",
      "likelyEvidence": [
        "Calls a larger physical 1/4 greater than a smaller physical 1/2 without checking the whole.",
        "Ignores the equal-whole condition."
      ],
      "distinguishingEvidence": [
        "Make both bars the same total length.",
        "Ask what the whole is in each model."
      ],
      "firstResponse": "Fraction comparisons need the same-size whole. Let’s make the wholes equal before comparing the parts.",
      "route": "reteach-fr-same-whole"
    },
    {
      "id": "math-mis-fr-simplify-subtract",
      "label": "Simplifies by subtracting the same number from numerator and denominator",
      "likelyEvidence": [
        "Changes 6/8 to 4/6.",
        "Cannot identify a common factor."
      ],
      "distinguishingEvidence": [
        "Ask whether the value stays at the same number-line point.",
        "Use division by a common factor and multiply back to check."
      ],
      "firstResponse": "Simplifying divides both numbers by the same common factor; subtracting does not preserve the ratio.",
      "route": "reteach-fr-simplify"
    }
  ],
  "visualExplanationPlan": {
    "representations": [
      "fraction-bar",
      "number-line",
      "area-model",
      "multiples-list",
      "step-diagram"
    ],
    "boards": [
      {
        "id": "fr-board-01",
        "kind": "fraction-bar",
        "action": "overlay",
        "payload": {
          "first": {
            "numerator": 2,
            "denominator": 3
          },
          "second": {
            "numerator": 4,
            "denominator": 6
          }
        },
        "altText": "Equal-length fraction bars showing two thirds and four sixths cover the same amount.",
        "narrationCue": "fr-n03"
      },
      {
        "id": "fr-board-02",
        "kind": "number-line",
        "action": "mark",
        "payload": {
          "min": 0,
          "max": 1,
          "marks": [
            "3/4",
            "6/8"
          ],
          "samePoint": true
        },
        "altText": "Number line from zero to one with three fourths and six eighths at the same point.",
        "narrationCue": "fr-n04"
      },
      {
        "id": "fr-board-03",
        "kind": "fraction-bar",
        "action": "rename",
        "payload": {
          "fractions": [
            "2/3",
            "1/4"
          ],
          "commonDenominator": 12,
          "renamed": [
            "8/12",
            "3/12"
          ]
        },
        "altText": "Fraction bars rename two thirds and one fourth into twelfths.",
        "narrationCue": "fr-n06"
      },
      {
        "id": "fr-board-04",
        "kind": "step-diagram",
        "action": "list-multiples",
        "payload": {
          "denominators": [
            6,
            4
          ],
          "multiples": {
            "6": [
              6,
              12,
              18,
              24
            ],
            "4": [
              4,
              8,
              12,
              16,
              20,
              24
            ]
          },
          "leastCommon": 12
        },
        "altText": "Lists multiples of six and four and highlights twelve as the first shared multiple.",
        "narrationCue": "fr-n05"
      },
      {
        "id": "fr-board-05",
        "kind": "area-model",
        "action": "compare",
        "payload": {
          "wholeSize": "same",
          "fractions": [
            "5/6",
            "7/9"
          ],
          "commonGrid": [
            18,
            15,
            14
          ]
        },
        "altText": "Equal-size area models compare fifteen eighteenths with fourteen eighteenths.",
        "narrationCue": "fr-n08"
      }
    ],
    "accessibility": [
      "Every model specifies an equal-size whole.",
      "Patterns or labels supplement shading.",
      "All visual reasoning is duplicated in words and equations."
    ]
  },
  "spokenExplanation": {
    "voice": "warm, precise, unhurried, nonjudgmental",
    "segments": [
      [
        "fr-n01",
        "A fraction names a number using equal parts of a whole."
      ],
      [
        "fr-n02",
        "The denominator tells how many equal parts make one whole; the numerator tells how many parts are counted."
      ],
      [
        "fr-n03",
        "Equivalent fractions name the same value with different-size units."
      ],
      [
        "fr-n04",
        "Equivalent fractions land at the same point on a number line."
      ],
      [
        "fr-n05",
        "A common denominator is a shared unit. The least common denominator is often the easiest shared unit."
      ],
      [
        "fr-n06",
        "To add or subtract fractions, rename them with equal-size pieces before combining numerators."
      ],
      [
        "fr-n07",
        "Do not add denominators. The denominator names the unit and stays the same once the units match."
      ],
      [
        "fr-n08",
        "Comparisons are fair only when the wholes are the same size."
      ],
      [
        "fr-n09",
        "Simplify by dividing the numerator and denominator by the same common factor."
      ],
      [
        "fr-n10",
        "Use bars, number lines, and equations to explain why the value stays equal."
      ]
    ]
  },
  "modes": {
    "showMe": {
      "purpose": "Watch unlike fractions become equal-size units before combining.",
      "example": "2/3 + 1/4",
      "steps": [
        {
          "id": "fr-sm-01",
          "prompt": "Why can’t thirds and fourths be counted together yet?",
          "expectedEvidence": "They are different-size units.",
          "hint": "Look at the widths of the pieces.",
          "visualCommandId": "fr-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "fr-sm-02",
          "prompt": "What is the least common denominator of 3 and 4?",
          "expectedEvidence": "12.",
          "hint": "List multiples until one matches.",
          "visualCommandId": "fr-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "fr-sm-03",
          "prompt": "After renaming both fractions in twelfths, what operation is left?",
          "expectedEvidence": "Add the numerators while keeping denominator 12.",
          "hint": "Now the pieces have the same name.",
          "visualCommandId": "fr-board-03",
          "answerRevealPolicy": "after-worked-steps",
          "onePromptOnly": true
        }
      ]
    },
    "talkMeThroughIt": {
      "purpose": "The learner explains every equivalence used in a subtraction.",
      "example": "5/6 − 1/4",
      "steps": [
        {
          "id": "fr-tm-01",
          "prompt": "What common denominator will you use, and why?",
          "expectedEvidence": "12 because it is divisible by 6 and 4.",
          "hint": "List or reason about common multiples.",
          "visualCommandId": "fr-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "fr-tm-02",
          "prompt": "How will you rename 5/6 and 1/4 without changing their values?",
          "expectedEvidence": "10/12 and 3/12 using equal scaling.",
          "hint": "Multiply each numerator and denominator by the same factor.",
          "visualCommandId": "fr-board-01",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "fr-tm-03",
          "prompt": "How can a bar or number line verify the difference?",
          "expectedEvidence": "Show the distance from 3/12 to 10/12 as 7/12.",
          "hint": "Use equal twelfth units.",
          "visualCommandId": "fr-board-02",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    },
    "letsDoOneTogether": {
      "purpose": "Alternate choosing a common unit and performing a rename.",
      "example": "3/5 + 1/2",
      "steps": [
        {
          "id": "fr-tg-01",
          "prompt": "I listed multiples of 5. You name the least common multiple with 2.",
          "expectedEvidence": "10.",
          "hint": "Which listed multiple is also even?",
          "visualCommandId": "fr-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "fr-tg-02",
          "prompt": "I renamed 3/5 as 6/10. You rename 1/2.",
          "expectedEvidence": "5/10.",
          "hint": "Multiply top and bottom by 5.",
          "visualCommandId": "fr-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "fr-tg-03",
          "prompt": "You combine the tenths and decide whether the result is less than, equal to, or greater than one. Explain.",
          "expectedEvidence": "11/10, greater than one.",
          "hint": "Ten tenths make one whole.",
          "visualCommandId": "fr-board-03",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    },
    "differentExample": {
      "purpose": "Transfer from addition to comparison.",
      "example": "5/6 compared with 7/9",
      "steps": [
        {
          "id": "fr-de-01",
          "prompt": "What shared denominator can represent sixths and ninths?",
          "expectedEvidence": "18.",
          "hint": "Find a common multiple of 6 and 9.",
          "visualCommandId": "fr-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "fr-de-02",
          "prompt": "Rename both fractions in eighteenths.",
          "expectedEvidence": "15/18 and 14/18.",
          "hint": "Scale 6 by 3 and 9 by 2.",
          "visualCommandId": "fr-board-05",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "fr-de-03",
          "prompt": "Which is greater, and how does the model prove it?",
          "expectedEvidence": "5/6 is greater by 1/18.",
          "hint": "Compare equal-size pieces.",
          "visualCommandId": "fr-board-05",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    }
  },
  "guidedPractice": {
    "items": [
      {
        "id": "math-fr-g01",
        "type": "multiple-choice",
        "prompt": "Complete the equivalent fraction: 3/4 = ?/20",
        "choices": [
          {
            "id": "A",
            "text": "12"
          },
          {
            "id": "B",
            "text": "15"
          },
          {
            "id": "C",
            "text": "16"
          },
          {
            "id": "D",
            "text": "17"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Multiply 4 by 5 to get 20, so multiply 3 by 5 to get 15.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-one-sided-scale"
          ],
          "C": [
            "math-mis-fr-one-sided-scale"
          ],
          "D": [
            "math-mis-fr-one-sided-scale"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-g02",
        "type": "multiple-choice",
        "prompt": "Which denominator is the least common denominator for 5/6 and 1/4?",
        "choices": [
          {
            "id": "A",
            "text": "10"
          },
          {
            "id": "B",
            "text": "12"
          },
          {
            "id": "C",
            "text": "24"
          },
          {
            "id": "D",
            "text": "48"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "12 is the least common multiple of 6 and 4.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-add-denominators"
          ],
          "C": [
            "math-mis-fr-common-product-only"
          ],
          "D": [
            "math-mis-fr-common-product-only"
          ]
        },
        "representation": "multiples-list",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-g03",
        "type": "multiple-choice",
        "prompt": "What is 2/3 + 1/4?",
        "choices": [
          {
            "id": "A",
            "text": "3/7"
          },
          {
            "id": "B",
            "text": "8/12"
          },
          {
            "id": "C",
            "text": "11/12"
          },
          {
            "id": "D",
            "text": "3/12"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "2/3 = 8/12 and 1/4 = 3/12, so the sum is 11/12.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-add-denominators"
          ],
          "B": [
            "math-mis-fr-one-sided-scale"
          ],
          "D": [
            "math-mis-fr-one-sided-scale"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-g04",
        "type": "multiple-choice",
        "prompt": "What is 5/6 − 1/4?",
        "choices": [
          {
            "id": "A",
            "text": "4/2"
          },
          {
            "id": "B",
            "text": "7/12"
          },
          {
            "id": "C",
            "text": "4/10"
          },
          {
            "id": "D",
            "text": "9/24"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "5/6 = 10/12 and 1/4 = 3/12; 10/12 − 3/12 = 7/12.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-add-denominators"
          ],
          "C": [
            "math-mis-fr-add-denominators"
          ],
          "D": [
            "math-mis-fr-common-product-only"
          ]
        },
        "representation": "number-line",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-g05",
        "type": "open-response",
        "prompt": "Use a number line or fraction bars to show that 6/8 and 3/4 are equivalent.",
        "acceptableEvidence": [
          "Marks both at the same point.",
          "Shows six of eight parts match three of four equal parts.",
          "May explain dividing 6 and 8 by 2."
        ],
        "reasoning": "Both fractions represent the same portion of an equal-size whole and the same number-line location.",
        "misconceptionSignals": {
          "different whole sizes": [
            "math-mis-fr-unequal-wholes"
          ]
        },
        "representation": "number-line",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-g06",
        "type": "open-response",
        "prompt": "Explain why 4/6 simplifies to 2/3 but not to 3/5.",
        "acceptableEvidence": [
          "Divides numerator and denominator by 2.",
          "Explains subtracting 1 does not preserve the ratio.",
          "Checks equivalence with multiplication or a model."
        ],
        "reasoning": "4/6 ÷ 2/2 = 2/3; 3/5 is at a different value.",
        "misconceptionSignals": {
          "subtracts one": [
            "math-mis-fr-simplify-subtract"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "scaffolding": "Begin with bars and number lines, then fade to multiples and symbolic equations."
  },
  "independentMasteryCheck": {
    "items": [
      {
        "id": "math-fr-m01",
        "type": "multiple-choice",
        "prompt": "Which fraction is equivalent to 7/10?",
        "choices": [
          {
            "id": "A",
            "text": "14/20"
          },
          {
            "id": "B",
            "text": "14/10"
          },
          {
            "id": "C",
            "text": "7/20"
          },
          {
            "id": "D",
            "text": "21/40"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "Multiply numerator and denominator by 2.",
        "misconceptionSignals": {
          "B": [
            "math-mis-fr-one-sided-scale"
          ],
          "C": [
            "math-mis-fr-one-sided-scale"
          ],
          "D": [
            "math-mis-fr-one-sided-scale"
          ]
        },
        "representation": "symbolic",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-m02",
        "type": "multiple-choice",
        "prompt": "What is 3/5 + 1/2?",
        "choices": [
          {
            "id": "A",
            "text": "4/7"
          },
          {
            "id": "B",
            "text": "11/10"
          },
          {
            "id": "C",
            "text": "8/10"
          },
          {
            "id": "D",
            "text": "9/10"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "3/5 = 6/10 and 1/2 = 5/10, so the sum is 11/10.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-add-denominators"
          ],
          "C": [
            "math-mis-fr-one-sided-scale"
          ],
          "D": [
            "math-mis-fr-one-sided-scale"
          ]
        },
        "representation": "symbolic",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-m03",
        "type": "multiple-choice",
        "prompt": "What is 7/8 − 1/6?",
        "choices": [
          {
            "id": "A",
            "text": "6/2"
          },
          {
            "id": "B",
            "text": "17/24"
          },
          {
            "id": "C",
            "text": "6/14"
          },
          {
            "id": "D",
            "text": "20/48"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "7/8 = 21/24 and 1/6 = 4/24; the difference is 17/24.",
        "misconceptionSignals": {
          "A": [
            "math-mis-fr-add-denominators"
          ],
          "C": [
            "math-mis-fr-add-denominators"
          ],
          "D": [
            "math-mis-fr-common-product-only"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-m04",
        "type": "open-response",
        "prompt": "Compare 4/5 and 7/9 using a common denominator or another valid strategy.",
        "acceptableEvidence": [
          "Concludes 4/5 > 7/9.",
          "Uses forty-fifths: 36/45 > 35/45, or valid cross-products/number line.",
          "Explains the comparison."
        ],
        "reasoning": "4/5 is greater because 36/45 is greater than 35/45.",
        "misconceptionSignals": {
          "uses denominator size only": [
            "math-mis-fr-whole-number-rules"
          ]
        },
        "representation": "number-line",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-m05",
        "type": "open-response",
        "prompt": "Create two different fractions equivalent to 5/6 and explain the scaling factor for each.",
        "acceptableEvidence": [
          "Examples: 10/12 by ×2/2; 15/18 by ×3/3.",
          "Scales numerator and denominator equally.",
          "Explains value stays equal."
        ],
        "reasoning": "Any same-factor scaling of numerator and denominator produces an equivalent fraction.",
        "misconceptionSignals": {
          "one-sided scaling": [
            "math-mis-fr-one-sided-scale"
          ]
        },
        "representation": "fraction-bars",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-fr-m06",
        "type": "open-response",
        "prompt": "Solve 2/3 + 3/10, simplify if needed, and explain why your denominator is valid.",
        "acceptableEvidence": [
          "Uses denominator 30 or another valid common denominator.",
          "Gets 20/30 + 9/30 = 29/30.",
          "Explains the denominator is a multiple of both 3 and 10."
        ],
        "reasoning": "The least common denominator is 30, and the sum is 29/30.",
        "misconceptionSignals": {
          "adds denominators": [
            "math-mis-fr-add-denominators"
          ],
          "unnecessary denominator only": [
            "math-mis-fr-common-product-only"
          ]
        },
        "representation": "mixed",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "masteryRule": "Across at least two sessions, show secure evidence on at least 5 of 6 items, including equivalence, unlike-denominator operation, comparison, and an explanation with a model. One correct fraction answer is not mastery.",
    "retryRule": "Use new denominators and switch representation after reteaching."
  },
  "reteachingBranches": [
    {
      "id": "reteach-fr-unit-size",
      "targets": [
        "math-mis-fr-whole-number-rules"
      ],
      "sequence": [
        "Use same-length wholes.",
        "Partition into halves, fourths, and eighths.",
        "Compare unit sizes.",
        "Mark fractions on a number line."
      ]
    },
    {
      "id": "reteach-fr-equivalence",
      "targets": [
        "math-mis-fr-one-sided-scale"
      ],
      "sequence": [
        "Overlay equivalent bars.",
        "Name the scaling factor.",
        "Write multiplication by n/n.",
        "Check the same number-line point."
      ]
    },
    {
      "id": "reteach-fr-common-units",
      "targets": [
        "math-mis-fr-add-denominators"
      ],
      "sequence": [
        "Place unlike pieces side by side.",
        "Rename with one shared unit.",
        "Combine only numerators after units match.",
        "Estimate whether the result is reasonable."
      ]
    },
    {
      "id": "reteach-fr-common-denominator",
      "targets": [
        "math-mis-fr-common-product-only"
      ],
      "sequence": [
        "List multiples of both denominators.",
        "Circle all shared multiples.",
        "Choose the least useful shared multiple.",
        "Compare with the product denominator."
      ]
    },
    {
      "id": "reteach-fr-same-whole",
      "targets": [
        "math-mis-fr-unequal-wholes"
      ],
      "sequence": [
        "Reset bars to equal total length.",
        "Compare the same fractions again.",
        "State the equal-whole requirement."
      ]
    },
    {
      "id": "reteach-fr-simplify",
      "targets": [
        "math-mis-fr-simplify-subtract"
      ],
      "sequence": [
        "Find a common factor.",
        "Divide numerator and denominator by that factor.",
        "Multiply back to check equivalence.",
        "Confirm on a number line."
      ]
    }
  ],
  "prerequisiteRemediationBranches": [
    {
      "id": "prerequisite-remediation-fr-parts",
      "targets": [
        "equal parts",
        "numerator/denominator",
        "unit fractions"
      ],
      "activities": [
        "Fold or draw equal-size paper bars.",
        "Label total equal parts and selected parts.",
        "Order 1/2, 1/3, 1/4, and 1/6 with the same whole."
      ],
      "exitEvidence": "Correctly explain numerator, denominator, and unit-fraction size on three models over two attempts."
    }
  ],
  "parentTeacherReview": {
    "lookFor": [
      "Does the learner keep the whole the same size?",
      "Can the learner explain why scaling top and bottom together preserves value?",
      "Does the learner name the shared unit before adding or subtracting?"
    ],
    "avoid": [
      "Teaching “butterfly” cross-multiplication without meaning.",
      "Accepting denominator addition as a small arithmetic slip.",
      "Using differently sized food pictures as comparison proof."
    ],
    "reviewPrompt": "Ask: “What unit are these pieces named in now, and why is that a fair unit?”"
  },
  "noMediaFallback": {
    "instructions": [
      "Draw equal-length fraction bars with a ruler or folded paper.",
      "Use a hand-drawn zero-to-one number line.",
      "List denominator multiples in two rows and circle matches.",
      "State each renaming equation aloud."
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
