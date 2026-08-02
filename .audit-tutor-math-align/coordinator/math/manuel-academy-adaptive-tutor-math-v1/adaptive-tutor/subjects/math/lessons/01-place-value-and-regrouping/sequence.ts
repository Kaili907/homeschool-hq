import type { AdaptiveMathSequence } from '../../types'

export const sequence = {
  "sequenceId": "math-seq-pv-regroup-v1",
  "lessonId": "math-lesson-01-place-value-regrouping",
  "version": "1.0.0",
  "order": "01",
  "title": "Place Value and Regrouping",
  "summary": "Build, compare, compose, decompose, add, and subtract multi-digit whole numbers using base-ten equivalence.",
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
    "math-skill-pv-value-v1",
    "math-skill-pv-compose-v1",
    "math-skill-regroup-add-v1",
    "math-skill-regroup-sub-v1"
  ],
  "legacySkillMappings": [
    "place",
    "place4",
    "addsub"
  ],
  "prerequisites": [
    "Count, read, and write whole numbers to at least 10,000.",
    "Recall basic addition and subtraction facts.",
    "Understand that 10 ones equal 1 ten and 10 tens equal 1 hundred."
  ],
  "objectives": [
    "Identify a digit’s value through the hundred-thousands place.",
    "Compose, decompose, compare, and order multi-digit numbers.",
    "Add and subtract with regrouping, including across zeros.",
    "Use models, equations, and estimates to explain and check work."
  ],
  "diagnostic": {
    "items": [
      {
        "id": "math-pv-d01",
        "type": "multiple-choice",
        "prompt": "What is the value of the 7 in 472,615?",
        "choices": [
          {
            "id": "A",
            "text": "7"
          },
          {
            "id": "B",
            "text": "7,000"
          },
          {
            "id": "C",
            "text": "70,000"
          },
          {
            "id": "D",
            "text": "700,000"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "The 7 is in the ten-thousands place, so its value is 7 × 10,000 = 70,000.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-digit-vs-value"
          ],
          "B": [
            "math-mis-pv-digit-vs-value"
          ],
          "D": [
            "math-mis-pv-left-align"
          ]
        },
        "representation": "place-value-chart",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-d02",
        "type": "multiple-choice",
        "prompt": "Which comparison is true?",
        "choices": [
          {
            "id": "A",
            "text": "305,090 > 350,009"
          },
          {
            "id": "B",
            "text": "305,090 < 350,009"
          },
          {
            "id": "C",
            "text": "305,090 = 350,009"
          },
          {
            "id": "D",
            "text": "The numbers cannot be compared because they contain zeros."
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Both have 3 hundred-thousands. At the ten-thousands place, 0 is less than 5, so 305,090 is less.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-zero-skip"
          ],
          "C": [
            "math-mis-pv-zero-skip"
          ],
          "D": [
            "math-mis-pv-zero-skip"
          ]
        },
        "representation": "place-value-chart",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-d03",
        "type": "multiple-choice",
        "prompt": "Which expanded form equals 402,306?",
        "choices": [
          {
            "id": "A",
            "text": "400,000 + 2,000 + 300 + 6"
          },
          {
            "id": "B",
            "text": "40,000 + 2,000 + 30 + 6"
          },
          {
            "id": "C",
            "text": "400,000 + 20,000 + 300 + 6"
          },
          {
            "id": "D",
            "text": "4,000 + 200 + 300 + 6"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "The digits show 4 hundred-thousands, 2 thousands, 3 hundreds, and 6 ones. The zero places contribute no amount but still hold position.",
        "misconceptionSignals": {
          "B": [
            "math-mis-pv-zero-skip"
          ],
          "C": [
            "math-mis-pv-digit-vs-value"
          ],
          "D": [
            "math-mis-pv-digit-vs-value"
          ]
        },
        "representation": "expanded-form",
        "difficultyBand": "entry",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-d04",
        "type": "multiple-choice",
        "prompt": "In 4,083 + 2,759, which place must be regrouped first?",
        "choices": [
          {
            "id": "A",
            "text": "Thousands"
          },
          {
            "id": "B",
            "text": "Hundreds"
          },
          {
            "id": "C",
            "text": "Tens"
          },
          {
            "id": "D",
            "text": "Ones"
          }
        ],
        "correctChoiceId": "D",
        "reasoning": "Start at the ones: 3 + 9 = 12, so 10 ones regroup as 1 ten.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-left-align"
          ],
          "B": [
            "math-mis-pv-left-align"
          ],
          "C": [
            "math-mis-pv-left-align"
          ]
        },
        "representation": "column-arithmetic",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-d05",
        "type": "multiple-choice",
        "prompt": "To begin 5,002 − 187, where does the first available unit for regrouping come from?",
        "choices": [
          {
            "id": "A",
            "text": "The ones place"
          },
          {
            "id": "B",
            "text": "The tens place"
          },
          {
            "id": "C",
            "text": "The hundreds place"
          },
          {
            "id": "D",
            "text": "The thousands place"
          }
        ],
        "correctChoiceId": "D",
        "reasoning": "The tens and hundreds places contain zero. One thousand must be regrouped through hundreds and tens so the ones can become 12.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-borrow-zero"
          ],
          "B": [
            "math-mis-pv-borrow-zero"
          ],
          "C": [
            "math-mis-pv-borrow-zero"
          ]
        },
        "representation": "base-ten-blocks",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-d06",
        "type": "open-response",
        "prompt": "Explain why 14 ones and 1 ten 4 ones represent the same amount.",
        "acceptableEvidence": [
          "States that 10 ones equal 1 ten.",
          "Explains that the trade changes the representation but not the total.",
          "May use 14 = 10 + 4."
        ],
        "reasoning": "Ten ones can be exchanged for one ten, leaving four ones. Both forms total 14.",
        "misconceptionSignals": {
          "mentions different totals": [
            "math-mis-pv-regroup-changes-number"
          ],
          "cannot name the trade": [
            "math-mis-pv-regroup-changes-number"
          ]
        },
        "representation": "base-ten-blocks",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "routingRules": [
      {
        "when": "two or more prerequisite-band misses",
        "route": "prerequisite-remediation-pv-base-ten"
      },
      {
        "when": "one misconception has two or more evidence signals",
        "route": "matching reteaching branch"
      },
      {
        "when": "mixed or uncertain evidence",
        "route": "show-me then one distinguishing probe"
      },
      {
        "when": "five or more items show secure reasoning",
        "route": "guided-practice with reduced scaffolds"
      }
    ]
  },
  "misconceptions": [
    {
      "id": "math-mis-pv-digit-vs-value",
      "label": "Names the digit instead of its value",
      "likelyEvidence": [
        "Chooses 7 or 7,000 for the 7 in 472,615.",
        "Says the place name but does not multiply by its unit value."
      ],
      "distinguishingEvidence": [
        "Ask for the same digit in two positions, such as 7 in 70,507.",
        "Ask the learner to build the number with a place-value chart."
      ],
      "firstResponse": "You found the digit. Now let’s connect its position to how much it is worth.",
      "route": "reteach-pv-place-value-chart"
    },
    {
      "id": "math-mis-pv-zero-skip",
      "label": "Treats zero placeholders as removable",
      "likelyEvidence": [
        "Reads 402,306 as 42,36 or decomposes it without the thousands/hundreds positions.",
        "Aligns numbers by visible digits rather than by place."
      ],
      "distinguishingEvidence": [
        "Compare 4,023 and 423 on a chart.",
        "Ask which position the zero is holding."
      ],
      "firstResponse": "A zero can hold a place even when it adds no amount. Let’s keep every column visible.",
      "route": "reteach-pv-zero-placeholders"
    },
    {
      "id": "math-mis-pv-regroup-changes-number",
      "label": "Believes regrouping changes the total",
      "likelyEvidence": [
        "Says 14 ones and 1 ten 4 ones are different amounts.",
        "Adds a carried ten without removing ten ones."
      ],
      "distinguishingEvidence": [
        "Trade 10 ones for 1 ten and recount.",
        "Write 14 = 10 + 4 beside the model."
      ],
      "firstResponse": "Regrouping changes the form, not the amount. Let’s make a fair trade of ten for one unit in the next place.",
      "route": "reteach-pv-trade-equivalence"
    },
    {
      "id": "math-mis-pv-borrow-zero",
      "label": "Stops when the next place is zero",
      "likelyEvidence": [
        "Cannot regroup in 5,002 − 187.",
        "Changes a zero directly to 10 without showing where the unit came from."
      ],
      "distinguishingEvidence": [
        "Use 1 thousand → 10 hundreds → 9 hundreds and 10 tens → 9 tens and 12 ones.",
        "Ask the learner to point to the source of every regrouped unit."
      ],
      "firstResponse": "The next column is zero, so we need to trace the trade to the first place that has a unit available.",
      "route": "reteach-pv-across-zeros"
    },
    {
      "id": "math-mis-pv-big-minus-small",
      "label": "Subtracts the smaller digit from the larger digit in each column",
      "likelyEvidence": [
        "Computes 42 − 18 as 36.",
        "Ignores which digit belongs to the whole minuend or subtrahend."
      ],
      "distinguishingEvidence": [
        "Ask whether 42 − 18 should be more or less than 30.",
        "Model the ones column with regrouping."
      ],
      "firstResponse": "You compared the two digits, but subtraction keeps the order of the whole numbers. Let’s regroup the top number instead.",
      "route": "reteach-pv-subtraction-order"
    },
    {
      "id": "math-mis-pv-left-align",
      "label": "Aligns multi-digit numbers from the left edge",
      "likelyEvidence": [
        "Writes 4,083 over 2759 so 4 aligns with 2.",
        "Produces place-value errors even with accurate facts."
      ],
      "distinguishingEvidence": [
        "Ask the learner to label the ones column first.",
        "Compare left-aligned and right-aligned layouts."
      ],
      "firstResponse": "The digits need to line up by place, not by the left edge. Let’s anchor the ones column first.",
      "route": "reteach-pv-alignment"
    }
  ],
  "visualExplanationPlan": {
    "representations": [
      "base-ten-blocks",
      "place-value-chart",
      "column-arithmetic",
      "number-line"
    ],
    "boards": [
      {
        "id": "pv-board-01",
        "kind": "place-value-chart",
        "action": "show",
        "payload": {
          "columns": [
            "hundred-thousands",
            "ten-thousands",
            "thousands",
            "hundreds",
            "tens",
            "ones"
          ],
          "number": "472615"
        },
        "altText": "Place-value chart showing 472,615 with 7 in the ten-thousands column.",
        "narrationCue": "pv-n02"
      },
      {
        "id": "pv-board-02",
        "kind": "base-ten-blocks",
        "action": "trade",
        "payload": {
          "from": "ones",
          "count": 10,
          "to": "tens",
          "toCount": 1,
          "equation": "14 = 10 + 4"
        },
        "altText": "Ten one blocks trade for one ten rod while four one blocks remain.",
        "narrationCue": "pv-n04"
      },
      {
        "id": "pv-board-03",
        "kind": "column-arithmetic",
        "action": "highlight",
        "payload": {
          "problem": "36,482 + 7,659",
          "column": "ones",
          "annotation": "2 + 9 = 11; write 1, regroup 1 ten"
        },
        "altText": "Vertical addition aligned by place with the ones column highlighted.",
        "narrationCue": "pv-n05"
      },
      {
        "id": "pv-board-04",
        "kind": "place-value-chart",
        "action": "regroup",
        "payload": {
          "number": "5002",
          "path": [
            "thousands",
            "hundreds",
            "tens",
            "ones"
          ],
          "resultingDigits": [
            "4",
            "9",
            "9",
            "12"
          ]
        },
        "altText": "Place-value chart tracing one thousand through zero hundreds and zero tens to make twelve ones.",
        "narrationCue": "pv-n07"
      },
      {
        "id": "pv-board-05",
        "kind": "number-line",
        "action": "compare",
        "payload": {
          "estimateFrom": 62000,
          "subtract": 19000,
          "estimateTo": 43000
        },
        "altText": "Number line showing an estimate from 62,000 back 19,000 to about 43,000.",
        "narrationCue": "pv-n09"
      }
    ],
    "accessibility": [
      "Every visual command includes text alternative.",
      "Color is never the only indicator.",
      "No visual is required; all moves are also stated in words."
    ]
  },
  "spokenExplanation": {
    "voice": "warm, clear, unhurried, nonjudgmental",
    "segments": [
      [
        "pv-n01",
        "Place value tells both which digit we see and how much that digit is worth."
      ],
      [
        "pv-n02",
        "A digit’s position gives its unit: ones, tens, hundreds, thousands, and beyond."
      ],
      [
        "pv-n03",
        "Zeros matter because they hold positions, even when they add no amount."
      ],
      [
        "pv-n04",
        "Regrouping is an equal trade. Ten ones become one ten, and the total stays the same."
      ],
      [
        "pv-n05",
        "For addition and subtraction, line up digits by place and begin at the ones."
      ],
      [
        "pv-n06",
        "When a column totals ten or more, regroup one unit into the next larger place."
      ],
      [
        "pv-n07",
        "When subtracting across zeros, trace the trade to the first place that has a unit available."
      ],
      [
        "pv-n08",
        "Do not switch to big digit minus small digit. Keep the order of the whole subtraction problem."
      ],
      [
        "pv-n09",
        "Estimate before or after solving to check whether the exact answer has a reasonable size."
      ],
      [
        "pv-n10",
        "Explain each trade. Your explanation gives stronger evidence than a single correct number."
      ]
    ]
  },
  "modes": {
    "showMe": {
      "purpose": "Watch a complete worked example while predicting each next move.",
      "example": "36,482 + 7,659",
      "steps": [
        {
          "id": "pv-sm-01",
          "prompt": "Before calculating, where should the ones digits be placed?",
          "expectedEvidence": "Align 2 above 9 in the ones column.",
          "hint": "Find the rightmost digit in each number.",
          "visualCommandId": "pv-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "pv-sm-02",
          "prompt": "The ones total 11. What trade keeps the value the same?",
          "expectedEvidence": "Trade 10 ones for 1 ten and leave 1 one.",
          "hint": "Think: 11 = 10 + 1.",
          "visualCommandId": "pv-board-02",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "pv-sm-03",
          "prompt": "After adding each place and regrouping, how can an estimate check the result?",
          "expectedEvidence": "Use rounded values and compare the size.",
          "hint": "Round 36,482 and 7,659 to convenient thousands.",
          "visualCommandId": "pv-board-05",
          "answerRevealPolicy": "after-worked-steps",
          "onePromptOnly": true
        }
      ]
    },
    "talkMeThroughIt": {
      "purpose": "The learner explains the plan aloud or in writing; the tutor asks one focused question at a time.",
      "example": "50,307 − 8,946",
      "steps": [
        {
          "id": "pv-tm-01",
          "prompt": "What do you notice in the ones column?",
          "expectedEvidence": "7 is too small to subtract 6? Actually 7 − 6 can be done, so no regrouping yet.",
          "hint": "Check the top and bottom ones digits.",
          "visualCommandId": "pv-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "pv-tm-02",
          "prompt": "What happens in the tens column, where 0 − 4 cannot be done with whole-number regrouping?",
          "expectedEvidence": "Trace a regroup from the hundreds or farther left.",
          "hint": "Look left for the first place with a unit available.",
          "visualCommandId": "pv-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "pv-tm-03",
          "prompt": "How will you check whether your difference is reasonable?",
          "expectedEvidence": "Estimate 50,000 − 9,000 ≈ 41,000.",
          "hint": "Round each number to the nearest thousand.",
          "visualCommandId": "pv-board-05",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    },
    "letsDoOneTogether": {
      "purpose": "Alternate responsibility between tutor and learner.",
      "example": "27,685 + 14,739",
      "steps": [
        {
          "id": "pv-tg-01",
          "prompt": "I aligned the ones. You add the ones and describe the regroup.",
          "expectedEvidence": "5 + 9 = 14; write 4 ones and regroup 1 ten.",
          "hint": "Say both what is written and what is moved.",
          "visualCommandId": "pv-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "pv-tg-02",
          "prompt": "I added the tens including the regrouped ten. Which column comes next?",
          "expectedEvidence": "Hundreds.",
          "hint": "Move one place left.",
          "visualCommandId": "pv-board-03",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "pv-tg-03",
          "prompt": "You finish the remaining columns. What estimate will you use as a final check?",
          "expectedEvidence": "About 28,000 + 15,000 = 43,000.",
          "hint": "Use nearby thousands.",
          "visualCommandId": "pv-board-05",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    },
    "differentExample": {
      "purpose": "Transfer the same idea to regrouping across zeros.",
      "example": "90,004 − 27,568",
      "steps": [
        {
          "id": "pv-de-01",
          "prompt": "Which place first needs a regroup?",
          "expectedEvidence": "The ones place because 4 − 8 needs regrouping.",
          "hint": "Start at the rightmost column.",
          "visualCommandId": "pv-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "pv-de-02",
          "prompt": "Where is the first available unit to the left?",
          "expectedEvidence": "The ten-thousands place (9 ten-thousands).",
          "hint": "Pass through each zero place carefully.",
          "visualCommandId": "pv-board-04",
          "answerRevealPolicy": "never-on-first-turn",
          "onePromptOnly": true
        },
        {
          "id": "pv-de-03",
          "prompt": "Explain why every trade keeps the number equal to 90,004.",
          "expectedEvidence": "Each unit becomes ten units of the next smaller place.",
          "hint": "Name the base-ten equivalence at each move.",
          "visualCommandId": "pv-board-02",
          "answerRevealPolicy": "after-learner-solution",
          "onePromptOnly": true
        }
      ]
    }
  },
  "guidedPractice": {
    "items": [
      {
        "id": "math-pv-g01",
        "type": "multiple-choice",
        "prompt": "What is the value of the 5 in 651,204?",
        "choices": [
          {
            "id": "A",
            "text": "5"
          },
          {
            "id": "B",
            "text": "500"
          },
          {
            "id": "C",
            "text": "50,000"
          },
          {
            "id": "D",
            "text": "500,000"
          }
        ],
        "correctChoiceId": "C",
        "reasoning": "The 5 is in the ten-thousands place.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-digit-vs-value"
          ],
          "B": [
            "math-mis-pv-digit-vs-value"
          ],
          "D": [
            "math-mis-pv-left-align"
          ]
        },
        "representation": "place-value-chart",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-g02",
        "type": "multiple-choice",
        "prompt": "Which number is greater?",
        "choices": [
          {
            "id": "A",
            "text": "608,041"
          },
          {
            "id": "B",
            "text": "680,014"
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
        "correctChoiceId": "B",
        "reasoning": "At the ten-thousands place, 8 is greater than 0.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-zero-skip"
          ],
          "C": [
            "math-mis-pv-zero-skip"
          ]
        },
        "representation": "place-value-chart",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-g03",
        "type": "multiple-choice",
        "prompt": "What is 27,685 + 14,739?",
        "choices": [
          {
            "id": "A",
            "text": "41,314"
          },
          {
            "id": "B",
            "text": "42,424"
          },
          {
            "id": "C",
            "text": "42,324"
          },
          {
            "id": "D",
            "text": "41,424"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Regroup ones, tens, hundreds, and thousands while keeping place alignment.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-regroup-changes-number"
          ],
          "C": [
            "math-mis-pv-left-align"
          ],
          "D": [
            "math-mis-pv-regroup-changes-number"
          ]
        },
        "representation": "column-arithmetic",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-g04",
        "type": "multiple-choice",
        "prompt": "What is 70,003 − 28,746?",
        "choices": [
          {
            "id": "A",
            "text": "41,257"
          },
          {
            "id": "B",
            "text": "42,743"
          },
          {
            "id": "C",
            "text": "58,657"
          },
          {
            "id": "D",
            "text": "41,343"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "Regroup across the zeros, then subtract in order by place.",
        "misconceptionSignals": {
          "B": [
            "math-mis-pv-big-minus-small"
          ],
          "C": [
            "math-mis-pv-borrow-zero"
          ],
          "D": [
            "math-mis-pv-borrow-zero"
          ]
        },
        "representation": "column-arithmetic",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-g05",
        "type": "open-response",
        "prompt": "Use a place-value chart or words to explain the first regrouping in 36,482 + 7,659.",
        "acceptableEvidence": [
          "Identifies 2 + 9 = 11 ones.",
          "Trades 10 ones for 1 ten and leaves 1 one.",
          "Carries/adds 1 ten to the tens column."
        ],
        "reasoning": "The ones total 11, so regroup as 1 ten and 1 one.",
        "misconceptionSignals": {
          "does not remove 10 ones": [
            "math-mis-pv-regroup-changes-number"
          ]
        },
        "representation": "place-value-chart",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-g06",
        "type": "open-response",
        "prompt": "Estimate 90,004 − 27,568, then explain whether an exact answer near 62,000 would be reasonable.",
        "acceptableEvidence": [
          "Rounds to compatible values such as 90,000 − 28,000.",
          "Concludes about 62,000 is reasonable.",
          "Uses the estimate to check size, not replace the exact calculation."
        ],
        "reasoning": "90,000 − 28,000 is about 62,000, so an exact answer near that amount is reasonable.",
        "misconceptionSignals": {
          "estimate far from exact": [
            "math-mis-pv-digit-vs-value"
          ]
        },
        "representation": "number-line",
        "difficultyBand": "target",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "scaffolding": "Begin with model choice, fade to symbolic work, and ask for reasoning on at least two items."
  },
  "independentMasteryCheck": {
    "items": [
      {
        "id": "math-pv-m01",
        "type": "multiple-choice",
        "prompt": "What is the value of the 8 in 583,417?",
        "choices": [
          {
            "id": "A",
            "text": "8,000"
          },
          {
            "id": "B",
            "text": "80,000"
          },
          {
            "id": "C",
            "text": "800,000"
          },
          {
            "id": "D",
            "text": "800"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "The 8 is in the ten-thousands place.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-digit-vs-value"
          ],
          "C": [
            "math-mis-pv-left-align"
          ],
          "D": [
            "math-mis-pv-digit-vs-value"
          ]
        },
        "representation": "symbolic",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-m02",
        "type": "multiple-choice",
        "prompt": "What is 48,796 + 36,587?",
        "choices": [
          {
            "id": "A",
            "text": "84,273"
          },
          {
            "id": "B",
            "text": "85,383"
          },
          {
            "id": "C",
            "text": "85,283"
          },
          {
            "id": "D",
            "text": "84,383"
          }
        ],
        "correctChoiceId": "B",
        "reasoning": "Add by place and regroup each total of ten or more.",
        "misconceptionSignals": {
          "A": [
            "math-mis-pv-regroup-changes-number"
          ],
          "C": [
            "math-mis-pv-left-align"
          ],
          "D": [
            "math-mis-pv-regroup-changes-number"
          ]
        },
        "representation": "column-arithmetic",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-m03",
        "type": "multiple-choice",
        "prompt": "What is 80,010 − 46,875?",
        "choices": [
          {
            "id": "A",
            "text": "33,135"
          },
          {
            "id": "B",
            "text": "34,245"
          },
          {
            "id": "C",
            "text": "44,865"
          },
          {
            "id": "D",
            "text": "33,245"
          }
        ],
        "correctChoiceId": "A",
        "reasoning": "Regroup across zeros while preserving subtraction order.",
        "misconceptionSignals": {
          "B": [
            "math-mis-pv-borrow-zero"
          ],
          "C": [
            "math-mis-pv-big-minus-small"
          ],
          "D": [
            "math-mis-pv-borrow-zero"
          ]
        },
        "representation": "column-arithmetic",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-m04",
        "type": "open-response",
        "prompt": "Explain how you know 509,030 is greater than 590,003 or correct the statement if it is false.",
        "acceptableEvidence": [
          "Corrects the statement: 509,030 is less than 590,003.",
          "Compares the ten-thousands place after matching hundred-thousands.",
          "Explains 0 ten-thousands is less than 9 ten-thousands."
        ],
        "reasoning": "The statement is false. 509,030 < 590,003 because 0 ten-thousands is less than 9 ten-thousands.",
        "misconceptionSignals": {
          "ignores zeros": [
            "math-mis-pv-zero-skip"
          ]
        },
        "representation": "place-value-chart",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-m05",
        "type": "open-response",
        "prompt": "Show one regrouping trade that keeps the value of 3,214 unchanged.",
        "acceptableEvidence": [
          "Examples: 1 ten becomes 10 ones; 2 hundreds becomes 1 hundred and 10 tens; 3 thousands becomes 2 thousands and 10 hundreds.",
          "States the total stays 3,214."
        ],
        "reasoning": "Any equivalent base-ten trade is valid when one unit in a place becomes ten units in the next smaller place.",
        "misconceptionSignals": {
          "changes total": [
            "math-mis-pv-regroup-changes-number"
          ]
        },
        "representation": "base-ten-blocks",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      },
      {
        "id": "math-pv-m06",
        "type": "open-response",
        "prompt": "Estimate and then solve 62,405 − 18,967. Explain how the estimate checks your exact result.",
        "acceptableEvidence": [
          "Estimate near 43,000 or 44,000.",
          "Exact difference 43,438.",
          "Explains the exact answer is close to the estimate."
        ],
        "reasoning": "62,405 − 18,967 = 43,438; an estimate such as 62,000 − 19,000 = 43,000 confirms the size.",
        "misconceptionSignals": {
          "exact without check": [
            "math-mis-pv-left-align"
          ],
          "subtraction reversal": [
            "math-mis-pv-big-minus-small"
          ]
        },
        "representation": "mixed",
        "difficultyBand": "independent",
        "answerRevealPolicy": "after-attempt-and-reasoning"
      }
    ],
    "masteryRule": "Across at least two sessions, earn secure evidence on at least 5 of 6 items, including both computation items and two explanations, with no persistent misconception pattern. One correct response never establishes mastery.",
    "retryRule": "After reteaching, use parallel items rather than repeating the same numbers immediately."
  },
  "reteachingBranches": [
    {
      "id": "reteach-pv-place-value-chart",
      "targets": [
        "math-mis-pv-digit-vs-value",
        "math-mis-pv-left-align"
      ],
      "sequence": [
        "Build the number in a labeled chart.",
        "Say digit, place, and value as three separate facts.",
        "Move the same digit to a new place and compare values.",
        "Return to one diagnostic transfer item."
      ]
    },
    {
      "id": "reteach-pv-zero-placeholders",
      "targets": [
        "math-mis-pv-zero-skip"
      ],
      "sequence": [
        "Use empty columns with zero cards.",
        "Compare numbers that differ only around zeros.",
        "Align by the ones column.",
        "Explain what each zero is holding."
      ]
    },
    {
      "id": "reteach-pv-trade-equivalence",
      "targets": [
        "math-mis-pv-regroup-changes-number"
      ],
      "sequence": [
        "Build 14 with ones.",
        "Trade ten ones for one ten.",
        "Write 14 = 10 + 4.",
        "Apply the same trade inside one addition column."
      ]
    },
    {
      "id": "reteach-pv-across-zeros",
      "targets": [
        "math-mis-pv-borrow-zero",
        "math-mis-pv-big-minus-small"
      ],
      "sequence": [
        "Start with a base-ten model such as 3,002.",
        "Trace one unit through each zero place.",
        "Record every changed digit on a chart.",
        "Check the difference with addition."
      ]
    }
  ],
  "prerequisiteRemediationBranches": [
    {
      "id": "prerequisite-remediation-pv-base-ten",
      "targets": [
        "10 ones = 1 ten",
        "place names through thousands"
      ],
      "activities": [
        "Bundle counters into groups of ten.",
        "Match 34, 3 tens 4 ones, and 30 + 4.",
        "Practice two-digit addition without regrouping before one regrouping trade."
      ],
      "exitEvidence": "Explain and model two base-ten trades correctly on separate examples."
    }
  ],
  "parentTeacherReview": {
    "lookFor": [
      "Does the learner name digit, place, and value separately?",
      "Can the learner explain where a regrouped unit came from?",
      "Does the learner use an estimate or inverse operation to check?"
    ],
    "avoid": [
      "Speed pressure before place-value accuracy.",
      "Calling a regrouping error careless without checking the model.",
      "Treating one correct worksheet item as mastery."
    ],
    "reviewPrompt": "Ask: “Show me one trade that keeps the number equal. How do you know?”"
  },
  "noMediaFallback": {
    "instructions": [
      "Draw a six-column place-value chart on paper.",
      "Use dots for ones, lines for tens, squares for hundreds, and labeled boxes for larger places.",
      "Read every visual command aloud as a text instruction.",
      "Use scrap paper for column alignment and estimates."
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
