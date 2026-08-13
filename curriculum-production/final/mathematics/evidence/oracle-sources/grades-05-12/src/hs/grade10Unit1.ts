import { makeHsUnitBank, numericDistractors, rand, spec } from './core.ts'

/** Grade 10 Unit 1 — Geometric Foundations and Constructions (G-CO.1, 12, 13). */

export const GRADE10_UNIT1 = makeHsUnitBank(10, 1, [
  spec<{ which: number }>({
    itemType: 'precise-geometric-definition',
    standard: 'G-CO.1',
    lessonFocus: 'precise definitions of the basic geometric objects',
    build: () => {
      const terms = [
        {
          term: 'circle',
          answer: 'the set of all points in a plane at a fixed distance from a given centre point',
          distractors: [
            'a closed curve with no corners',
            'a shape whose area is πr²',
            'a polygon with infinitely many sides',
          ],
        },
        {
          term: 'angle',
          answer: 'the figure formed by two rays sharing a common endpoint',
          distractors: [
            'the amount of turn measured in degrees',
            'the space between two intersecting lines',
            'a corner of a polygon',
          ],
        },
        {
          term: 'perpendicular lines',
          answer: 'two lines that intersect to form right angles',
          distractors: [
            'two lines that never meet',
            'two lines with opposite slopes',
            'two lines that form an isosceles triangle',
          ],
        },
        {
          term: 'parallel lines',
          answer: 'two coplanar lines that never intersect, however far they are extended',
          distractors: [
            'two lines the same distance apart at one point',
            'two lines that meet only at infinity',
            'two lines with the same length',
          ],
        },
        {
          term: 'line segment',
          answer: 'the set of two endpoints and all points between them on the line through them',
          distractors: [
            'a line with a measurable length',
            'part of a line that goes on forever in one direction',
            'the shortest path between two shapes',
          ],
        },
      ]
      const which = rand(0, terms.length - 1)
      const entry = terms[which]
      return {
        prompt: `Which statement is a precise definition of a ${entry.term}?`,
        parameters: { which },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `A precise definition names the undefined terms it is built from — point, line, distance along a line, and distance around a circular arc — and states exactly which objects qualify.`,
          `Descriptions that appeal to appearance or to a formula do not determine membership, so they are not definitions.`,
          `The precise definition of a ${entry.term} is: ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Chose a description of what the object looks like or how it is measured.',
            likelyCause: 'A property of the object was mistaken for its definition.',
            remediation:
              'Test each candidate by asking whether it lets you decide, for any figure, whether it qualifies.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'the set of all points in a plane at a fixed distance from a given centre point',
        'the figure formed by two rays sharing a common endpoint',
        'two lines that intersect to form right angles',
        'two coplanar lines that never intersect, however far they are extended',
        'the set of two endpoints and all points between them on the line through them',
      ][which],
    referenceExample: {
      prompt: 'Define a circle precisely.',
      steps: ['Fix a centre and a distance.', 'Take every point in the plane at that distance.'],
      answer: 'the set of points at a fixed distance from a centre',
    },
  }),

  spec<{ which: number }>({
    itemType: 'identify-construction-outcome',
    standard: 'G-CO.12',
    lessonFocus: 'formal constructions with compass and straightedge',
    build: () => {
      const constructions = [
        {
          steps:
            'Open the compass to more than half of AB. From A draw an arc above and below AB; from B, with the same opening, draw arcs crossing them. Draw the line through the two crossing points.',
          answer: 'the perpendicular bisector of AB',
          distractors: ['the angle bisector of ∠A', 'a line parallel to AB', 'a copy of segment AB'],
        },
        {
          steps:
            'From vertex V draw an arc crossing both rays at P and Q. From P and Q draw equal arcs meeting at R. Draw ray VR.',
          answer: 'the bisector of the angle at V',
          distractors: [
            'the perpendicular bisector of PQ only',
            'a line perpendicular to one ray',
            'an equilateral triangle on PQ',
          ],
        },
        {
          steps:
            'With the compass set to the radius, mark successive arcs around the circle from a starting point, then join consecutive marks.',
          answer: 'a regular hexagon inscribed in the circle',
          distractors: [
            'a regular pentagon inscribed in the circle',
            'an equilateral triangle inscribed in the circle',
            'a square inscribed in the circle',
          ],
        },
        {
          steps:
            'Through point P not on line ℓ, copy the angle that a transversal makes with ℓ, placing the copy at P on the same transversal.',
          answer: 'a line through P parallel to ℓ',
          distractors: [
            'a line through P perpendicular to ℓ',
            'the perpendicular bisector of the transversal',
            'the reflection of ℓ across P',
          ],
        },
      ]
      const which = rand(0, constructions.length - 1)
      const entry = constructions[which]
      return {
        prompt: `A construction proceeds as follows. ${entry.steps} What has been constructed?`,
        parameters: { which },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `Track what each compass opening guarantees: equal openings produce equal distances, and equal distances place a point on a locus.`,
          which === 0
            ? 'Both crossing points are equidistant from A and from B, and the set of such points is exactly the perpendicular bisector.'
            : which === 1
              ? 'R is equidistant from P and Q, which are equidistant from V, so ray VR splits the angle into two congruent parts.'
              : which === 2
                ? 'A chord equal to the radius subtends a 60° central angle, and six such arcs close the circle exactly.'
                : 'Copying the angle makes corresponding angles equal, which forces the two lines to be parallel.',
          `The construction produces ${entry.answer}.`,
        ],
        commonErrors: [
          {
            observed: 'Named the construction from the shape of the arcs rather than from what they guarantee.',
            likelyCause: 'The construction was memorised as a sequence of marks.',
            remediation:
              'For each arc, state which two distances it makes equal, then say what locus that defines.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'the perpendicular bisector of AB',
        'the bisector of the angle at V',
        'a regular hexagon inscribed in the circle',
        'a line through P parallel to ℓ',
      ][which],
    referenceExample: {
      prompt: 'Equal arcs from A and B meet above and below AB. What is the joining line?',
      steps: ['Both meeting points are equidistant from A and B.', 'That locus is the perpendicular bisector.'],
      answer: 'the perpendicular bisector of AB',
    },
  }),

  spec<{ sides: number; radius: number }>({
    itemType: 'inscribed-polygon-central-angle',
    standard: 'G-CO.13',
    lessonFocus: 'inscribing regular polygons in a circle',
    build: (difficulty) => {
      const sides = [3, 4, 6][rand(0, difficulty === 1 ? 1 : 2)]
      const radius = rand(2, 12)
      const central = 360 / sides
      return {
        prompt: `A regular ${sides === 3 ? 'triangle' : sides === 4 ? 'quadrilateral' : 'hexagon'} is inscribed in a circle of radius ${radius}. What central angle does each side subtend?`,
        parameters: { sides, radius },
        answer: `${central}°`,
        // For a square the interior angle and the supplement both equal the
        // central angle, so the authored near-misses collapse; pad numerically.
        distractors: numericDistractors(central, [
          180 / sides,
          180 - central,
          central * 2,
          Math.round(((sides - 2) * 180) / sides),
          central / 2,
        ]).map((value) => `${value}°`),
        solutionSteps: [
          `The ${sides} vertices divide the full circle into ${sides} equal arcs.`,
          `A full turn is 360°, so each arc measures 360 ÷ ${sides}.`,
          `Each side therefore subtends a central angle of ${central}°.`,
          `Note this differs from the polygon's interior angle, which is ${Math.round(((sides - 2) * 180) / sides)}°.`,
        ],
        commonErrors: [
          {
            observed: `Gave the interior angle ${Math.round(((sides - 2) * 180) / sides)}° instead.`,
            likelyCause: 'The angle at the centre was confused with the angle at a vertex.',
            remediation:
              'Draw the radii to two adjacent vertices and mark which angle the question is asking about.',
          },
        ],
      }
    },
    oracle: ({ sides }) => `${360 / sides}°`,
    referenceExample: {
      prompt: 'A regular hexagon is inscribed in a circle. Central angle per side?',
      steps: ['Six equal arcs make 360°.', '360 ÷ 6 = 60°.'],
      answer: '60°',
    },
  }),

  spec<{ which: number }>({
    itemType: 'justify-construction-validity',
    standard: 'G-CO.12',
    lessonFocus: 'justifying why a construction works',
    build: () => {
      const cases = [
        {
          claim: 'the perpendicular bisector construction',
          answer: 'Both constructed points are equidistant from the endpoints, and the locus of such points is exactly the perpendicular bisector.',
          distractors: [
            'The arcs look symmetric, so the line must be perpendicular.',
            'The compass width was more than half the segment, which forces perpendicularity.',
            'Any line through the midpoint is a perpendicular bisector.',
          ],
        },
        {
          claim: 'the angle bisector construction',
          answer: 'The construction builds two congruent triangles by SSS, so the angles at the vertex are congruent.',
          distractors: [
            'The ray drawn appears to split the angle evenly.',
            'Equal arcs always produce equal angles regardless of the triangle.',
            'The construction relies on the angle being acute.',
          ],
        },
        {
          claim: 'the equilateral triangle construction on a given segment',
          answer: 'Both circles have radius equal to the segment, so all three sides are that same length.',
          distractors: [
            'The circles intersect, which guarantees 60° angles by definition.',
            'The construction works only when the segment is horizontal.',
            'The intersection point is the midpoint of the segment.',
          ],
        },
      ]
      const which = rand(0, cases.length - 1)
      const entry = cases[which]
      return {
        prompt: `Which statement correctly justifies ${entry.claim}?`,
        parameters: { which },
        answer: entry.answer,
        distractors: entry.distractors,
        solutionSteps: [
          `A justification must appeal to what the compass guarantees, not to how the figure looks.`,
          `Equal compass openings create equal lengths, and equal lengths let a congruence criterion or a locus definition be applied.`,
          entry.answer,
        ],
        commonErrors: [
          {
            observed: 'Justified the construction by appearance.',
            likelyCause: 'A drawing was accepted as evidence.',
            remediation:
              'Require every justification to cite equal radii and then a named theorem or definition.',
          },
        ],
      }
    },
    oracle: ({ which }) =>
      [
        'Both constructed points are equidistant from the endpoints, and the locus of such points is exactly the perpendicular bisector.',
        'The construction builds two congruent triangles by SSS, so the angles at the vertex are congruent.',
        'Both circles have radius equal to the segment, so all three sides are that same length.',
      ][which],
    referenceExample: {
      prompt: 'Why does the equilateral triangle construction work?',
      steps: ['Both circles have radius AB.', 'So AC = BC = AB.'],
      answer: 'All three sides equal the radius',
    },
  }),
])
