import type { Difficulty } from '../types'
import { pick, ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'

/** Coverage: Unit 9, course days 145-162; 5.G.1, 5.G.2, 5.G.3, 5.G.4. */
export const GRADE5_MATH_UNIT9_ITEM_TYPES = ['identify-coordinate-axes','read-ordered-pair','graph-context-point','classify-shape-properties','shape-hierarchy','geometric-vocabulary','coordinate-route'] as const
export type Grade5MathUnit9ItemType = typeof GRADE5_MATH_UNIT9_ITEM_TYPES[number]
type Axis = { axis: 'horizontal'|'vertical' }
type Point = { x:number; y:number }
type Context = Point & { place:'library'|'garden'|'playground' }
type Shape = { kind:'triangle'|'rectangle'|'parallelogram'|'rhombus'; sides:number; rightAngles:number; parallelPairs:number }
type Hierarchy = { shape:'square'|'rectangle'|'rhombus'; category:'rectangle'|'parallelogram'|'quadrilateral' }
type Vocabulary = { word:'perpendicular'|'parallel'|'vertex' }
type Route = { startX:number; startY:number; right:number; up:number }
type U9<T extends Grade5MathUnit9ItemType,P> = CurriculumQuestion<T,P>
export type Grade5MathUnit9Question = U9<'identify-coordinate-axes',Axis>|U9<'read-ordered-pair',Point>|U9<'graph-context-point',Context>|U9<'classify-shape-properties',Shape>|U9<'shape-hierarchy',Hierarchy>|U9<'geometric-vocabulary',Vocabulary>|U9<'coordinate-route',Route>
type Standard = '5.G.1'|'5.G.2'|'5.G.3'|'5.G.4'
type Def = { standard:Standard; lessonFocus:string; workedExample:CurriculumWorkedExample }
const ex=(prompt:string,answer:string,...steps:string[]):CurriculumWorkedExample=>({prompt,answer,steps})
export const GRADE5_MATH_UNIT9_ITEM_DEFINITIONS = {
  'identify-coordinate-axes':{standard:'5.G.1',lessonFocus:'coordinate-plane axes and ordered pairs',workedExample:ex('Which axis is horizontal?','x-axis','The x-axis runs left and right.','So it is horizontal.')},
  'read-ordered-pair':{standard:'5.G.1',lessonFocus:'coordinate-plane axes and ordered pairs',workedExample:ex('What point has x-coordinate 3 and y-coordinate 5?','(3, 5)','Write x first.','Write y second.')},
  'graph-context-point':{standard:'5.G.2',lessonFocus:'graphing real-world points',workedExample:ex('The library is at x = 4 and y = 2. What point names it?','(4, 2)','Use horizontal distance for x.','Use vertical distance for y.')},
  'classify-shape-properties':{standard:'5.G.3',lessonFocus:'classifying two-dimensional figures',workedExample:ex('A quadrilateral has 4 right angles and 2 pairs of parallel sides. What is it?','rectangle','Four right angles fit a rectangle.','Its opposite sides are parallel.')},
  'shape-hierarchy':{standard:'5.G.4',lessonFocus:'hierarchies of properties',workedExample:ex('A square is always what kind of quadrilateral?','rectangle','A square has four right angles.','Every square is a rectangle.')},
  'geometric-vocabulary':{standard:'5.G.3',lessonFocus:'geometric vocabulary',workedExample:ex('Lines that meet to form a right angle are called what?','perpendicular','A right angle measures 90 degrees.','Those lines are perpendicular.')},
  'coordinate-route':{standard:'5.G.2',lessonFocus:'coordinate problem solving',workedExample:ex('Start at (2, 1), move right 3 and up 2. Where do you end?','(5, 3)','Right increases x.','Up increases y.')},
} as const satisfies Record<Grade5MathUnit9ItemType,Def>
const pt=(x:number,y:number)=>`(${x}, ${y})`
const max=(d:Difficulty)=>d===1?6:d===2?10:15
function q<T extends Grade5MathUnit9ItemType,P>(itemType:T,difficulty:Difficulty,prompt:string,correctAnswer:string,distractors:string[],parameters:P):U9<T,P>{const d=GRADE5_MATH_UNIT9_ITEM_DEFINITIONS[itemType];return makeCurriculumQuestion({itemType,difficulty,prompt,correctAnswer,distractors,parameters,standard:d.standard,lessonFocus:d.lessonFocus,workedExample:d.workedExample,distractorMode:'distinct'})}
function otherPoints(x:number,y:number):string[]{const values=[pt(y,x),pt(x+1,y),pt(x,y+1),pt(x+1,y+1),pt(Math.max(0,x-1),y),pt(x,Math.max(0,y-1))];return [...new Set(values)].filter(v=>v!==pt(x,y))}
export function generateIdentifyCoordinateAxesQuestion(difficulty:Difficulty):U9<'identify-coordinate-axes',Axis>{const axis=pick(['horizontal','vertical'] as const);return q('identify-coordinate-axes',difficulty,`Which coordinate-plane axis is ${axis}?`,axis==='horizontal'?'x-axis':'y-axis',axis==='horizontal'?['y-axis','origin','ordered pair']:['x-axis','origin','ordered pair'],{axis})}
export function generateReadOrderedPairQuestion(difficulty:Difficulty):U9<'read-ordered-pair',Point>{let x=ri(0,max(difficulty));let y=ri(0,max(difficulty));if(x===y)y=(y+1)%(max(difficulty)+1);return q('read-ordered-pair',difficulty,`What ordered pair has x-coordinate ${x} and y-coordinate ${y}?`,pt(x,y),otherPoints(x,y),{x,y})}
export function generateGraphContextPointQuestion(difficulty:Difficulty):U9<'graph-context-point',Context>{let x=ri(0,max(difficulty));let y=ri(0,max(difficulty));if(x===y)y=(y+1)%(max(difficulty)+1);const place=pick(['library','garden','playground'] as const);return q('graph-context-point',difficulty,`On a map, the ${place} is at x = ${x} and y = ${y}. Which point names its location?`,pt(x,y),otherPoints(x,y),{x,y,place})}
export function generateClassifyShapePropertiesQuestion(difficulty:Difficulty):U9<'classify-shape-properties',Shape>{const p=pick([{kind:'triangle',sides:3,rightAngles:0,parallelPairs:0},{kind:'rectangle',sides:4,rightAngles:4,parallelPairs:2},{kind:'parallelogram',sides:4,rightAngles:0,parallelPairs:2},{kind:'rhombus',sides:4,rightAngles:0,parallelPairs:2}] as const);return q('classify-shape-properties',difficulty,`A ${p.kind==='rhombus'?'quadrilateral with four equal sides':`shape has ${p.sides} sides, ${p.rightAngles} right angles, and ${p.parallelPairs} pairs of parallel sides`}. What is the most specific name?`,p.kind,['triangle','rectangle','parallelogram','rhombus','pentagon'].filter(x=>x!==p.kind),p)}
export function generateShapeHierarchyQuestion(difficulty:Difficulty):U9<'shape-hierarchy',Hierarchy>{const p=pick([{shape:'square',category:'rectangle'},{shape:'rectangle',category:'parallelogram'},{shape:'rhombus',category:'parallelogram'}] as const);return q('shape-hierarchy',difficulty,`In the hierarchy ${p.shape} → ${p.category} → quadrilateral, what category comes immediately after ${p.shape}?`,p.category,['triangle','pentagon','circle','trapezoid'],p)}
export function generateGeometricVocabularyQuestion(difficulty:Difficulty):U9<'geometric-vocabulary',Vocabulary>{const word=pick(['perpendicular','parallel','vertex'] as const);const clue=word==='perpendicular'?'Lines that meet to form a right angle':word==='parallel'?'Lines in a plane that never meet':'The point where two sides of a polygon meet';return q('geometric-vocabulary',difficulty,`${clue} are called what?`,word,['perpendicular','parallel','vertex','edge'].filter(x=>x!==word),{word})}
export function generateCoordinateRouteQuestion(difficulty:Difficulty):U9<'coordinate-route',Route>{const p={startX:ri(0,max(difficulty)-3),startY:ri(0,max(difficulty)-3),right:ri(1,3),up:ri(1,3)};const x=p.startX+p.right,y=p.startY+p.up;return q('coordinate-route',difficulty,`Start at ${pt(p.startX,p.startY)}. Move right ${p.right} and up ${p.up}. What is the endpoint?`,pt(x,y),otherPoints(x,y),p)}
export const GRADE5_MATH_UNIT9_GENERATORS={'identify-coordinate-axes':generateIdentifyCoordinateAxesQuestion,'read-ordered-pair':generateReadOrderedPairQuestion,'graph-context-point':generateGraphContextPointQuestion,'classify-shape-properties':generateClassifyShapePropertiesQuestion,'shape-hierarchy':generateShapeHierarchyQuestion,'geometric-vocabulary':generateGeometricVocabularyQuestion,'coordinate-route':generateCoordinateRouteQuestion} satisfies Record<Grade5MathUnit9ItemType,CurriculumGenerator<Grade5MathUnit9Question>>
export function generateGrade5MathUnit9Question<T extends Grade5MathUnit9ItemType>(itemType:T,difficulty:Difficulty):Extract<Grade5MathUnit9Question,{itemType:T}>{return (GRADE5_MATH_UNIT9_GENERATORS[itemType] as CurriculumGenerator<Extract<Grade5MathUnit9Question,{itemType:T}>>)(difficulty)}
