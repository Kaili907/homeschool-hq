import type { Difficulty } from '../types'
import { ri } from '../genUtils'
import { makeCurriculumQuestion, type CurriculumGenerator, type CurriculumQuestion, type CurriculumWorkedExample } from './generatorCore'
/** Coverage contract: Unit 8, course days 127-144, standards 5.MD.1-5. */
export const GRADE5_MATH_UNIT8_ITEM_TYPES=['measurement-conversion','line-plot-fraction-data','volume-unit-cubes','volume-formula','additive-volume','measurement-design'] as const
export type Grade5MathUnit8ItemType=typeof GRADE5_MATH_UNIT8_ITEM_TYPES[number]
type P={a:bigint;b:bigint;c:bigint;d:bigint;mode:string};type Q<T extends Grade5MathUnit8ItemType>=CurriculumQuestion<T,P>;export type Grade5MathUnit8Question={ [T in Grade5MathUnit8ItemType]:Q<T>}[Grade5MathUnit8ItemType]
type Def={standard:'5.MD.1'|'5.MD.2'|'5.MD.3'|'5.MD.4'|'5.MD.5';lessonFocus:string;workedExample:CurriculumWorkedExample}

/**
 * One authored worked example per item type. Each is a concrete instance of the
 * generated prompt shape and multiplies the actual dimensions out; this prose is
 * what a student reads after a wrong answer, so it is the teaching.
 */
export const GRADE5_MATH_UNIT8_ITEM_DEFINITIONS={
 'measurement-conversion':{standard:'5.MD.1',lessonFocus:'measurement conversions',workedExample:{
  prompt:'Convert 3 feet to inches.',
  answer:'36 inches',
  steps:[
   '1 foot equals 12 inches, so each of the 3 feet contributes 12 inches.',
   'Multiply by the conversion factor: 3 × 12 = 36.',
   'An inch is smaller than a foot, so the count must grow, not shrink: 3 feet = 36 inches.',
  ]}},
 'line-plot-fraction-data':{standard:'5.MD.2',lessonFocus:'line plots with fractional data',workedExample:{
  prompt:'A line plot has 2 marks at 1/4 meter, 3 marks at 1/2 meter, and 1 mark at 3/4 meter. What total length do the marks represent?',
  answer:'2 3/4 meters',
  steps:[
   'Rewrite every value in quarter meters so they can be counted together: 1/2 = 2/4 and 3/4 stays 3/4.',
   'Count the quarters each column contributes: 2 × 1 = 2, then 3 × 2 = 6, then 1 × 3 = 3, and 2 + 6 + 3 = 11 quarters.',
   '11/4 meters is 8/4 (which is 2 whole meters) plus 3/4 left over, so the total is 2 3/4 meters.',
  ]}},
 'volume-unit-cubes':{standard:'5.MD.3',lessonFocus:'volume as unit cubes',workedExample:{
  prompt:'A rectangular prism is 2 unit cubes long, 3 wide, and 4 high. How many unit cubes fill it?',
  answer:'24 cubic units',
  steps:[
   'One layer on the base holds 2 × 3 = 6 cubes.',
   'The prism is 4 layers tall, so it holds 4 copies of that layer: 6 × 4 = 24 cubes.',
   'Counting cubes measures volume, so the answer is 24 cubic units — the base alone, 6 square units, is only one layer.',
  ]}},
 'volume-formula':{standard:'5.MD.5',lessonFocus:'volume formulas',workedExample:{
  prompt:'Find the volume of a rectangular prism with length 3, width 4, and height 5 units.',
  answer:'60 cubic units',
  steps:[
   'The volume of a rectangular prism is V = length × width × height, so all three dimensions are multiplied.',
   'Multiply the first two: 3 × 4 = 12, the area of the base.',
   'Multiply that base by the height: 12 × 5 = 60, so V = 60 cubic units.',
  ]}},
 'additive-volume':{standard:'5.MD.5',lessonFocus:'additive volume',workedExample:{
  prompt:'An L-shaped solid is decomposed into two non-congruent rectangular prisms sharing a base of 3 by 4 units and having heights 2 and 5 units. What is its combined volume?',
  answer:'84 cubic units',
  steps:[
   'Find the first prism on its own: 3 × 4 × 2 = 24 cubic units.',
   'Find the second prism on its own: 3 × 4 × 5 = 60 cubic units.',
   'Add the two parts: 24 + 60 = 84 cubic units. Because they share the base, adding the heights first gives the same total: 3 × 4 × 7 = 84.',
  ]}},
 'measurement-design':{standard:'5.MD.4',lessonFocus:'real-world measurement design',workedExample:{
  prompt:'A storage box is 2 inches by 3 inches by 5 inches. What is its capacity?',
  answer:'30 cubic inches',
  steps:[
   'Capacity is how much space fills the box, which is its volume: 2 × 3 × 5.',
   'Multiply the first two dimensions: 2 × 3 = 6 square inches for the bottom of the box.',
   'Multiply that by the remaining dimension: 6 × 5 = 30, so the box holds 30 cubic inches.',
  ]}},
} as const satisfies Record<Grade5MathUnit8ItemType,Def>
/** Distractors always come from this item's numbers; `distinct` drops any that collapse onto the answer. */
const q=(itemType:Grade5MathUnit8ItemType,difficulty:Difficulty,prompt:string,answer:string,distractors:readonly string[],parameters:P)=>makeCurriculumQuestion({itemType,difficulty,prompt,correctAnswer:answer,distractors,distractorMode:'distinct',parameters,...GRADE5_MATH_UNIT8_ITEM_DEFINITIONS[itemType]})
const dims=(d:Difficulty)=>({a:BigInt(ri(2,d+3)),b:BigInt(ri(2,d+4)),c:BigInt(ri(2,d+5))})
/** Renders a count of quarter meters the same way the answers do (11 -> "2 3/4"). */
const quarters=(n:bigint):string=>{const w=n/4n,r=n%4n;if(r===0n)return `${w}`;const f=r===2n?'1/2':`${r}/4`;return w===0n?f:`${w} ${f}`}
/** The recurring Unit 8 confusions: base area for volume, and dimensions summed rather than multiplied. */
const volumeConfusions=(a:bigint,b:bigint,c:bigint,unit:string):string[]=>[
 `${a*b} ${unit}`,                 // stopped at the area of the base
 `${a*c} ${unit}`,                 // multiplied only two of the three dimensions
 `${a+b+c} ${unit}`,               // added the dimensions instead of multiplying
 `${a*b+c} ${unit}`,               // added the height onto the base area
 `${2n*(a*b+b*c+a*c)} ${unit}`,    // computed surface area instead of volume
]
export function generateMeasurementConversionQuestion(difficulty:Difficulty){const a=BigInt(ri(2,difficulty+8)),b=12n;return q('measurement-conversion',difficulty,`Convert ${a} feet to inches.`,`${a*b} inches`,[
 `${a+b} inches`,      // added 12 instead of multiplying by it
 `${a*3n} inches`,     // used the feet-to-yards factor of 3
 `${a*10n} inches`,    // converted as though ten inches made a foot
 `${a*b*b} inches`,    // applied the conversion twice
],{a,b,c:0n,d:0n,mode:'feet-inches'})}
export function generateLinePlotFractionDataQuestion(difficulty:Difficulty){const a=BigInt(ri(1,difficulty+3)),b=BigInt(ri(1,difficulty+3)),c=BigInt(ri(1,difficulty+3)),n=a+2n*b+3n*c;return q('line-plot-fraction-data',difficulty,`A line plot has ${a} mark${a===1n?'':'s'} at 1/4 meter, ${b} mark${b===1n?'':'s'} at 1/2 meter, and ${c} mark${c===1n?'':'s'} at 3/4 meter. What total length do the marks represent?`,`${quarters(n)} meters`,[
 `${a+b+c} meters`,               // counted the marks instead of adding their lengths
 `${quarters(a+b+c)} meters`,     // treated every mark as 1/4 meter
 `${quarters(a+b+2n*c)} meters`,  // read 1/2 as one quarter and 3/4 as two quarters
 `${quarters(n+4n)} meters`,      // added an extra whole meter when regrouping quarters
 `${quarters(3n*c)} meters`,      // totalled only the 3/4-meter column
],{a,b,c,d:4n,mode:'mixed-quarters'})}
export function generateVolumeUnitCubesQuestion(difficulty:Difficulty){const{a,b,c}=dims(difficulty);return q('volume-unit-cubes',difficulty,`A rectangular prism is ${a} unit cubes long, ${b} wide, and ${c} high. How many unit cubes fill it?`,`${a*b*c} cubic units`,volumeConfusions(a,b,c,'cubic units'),{a,b,c,d:0n,mode:'cubes'})}
export function generateVolumeFormulaQuestion(difficulty:Difficulty){const{a,b,c}=dims(difficulty);return q('volume-formula',difficulty,`Find the volume of a rectangular prism with length ${a}, width ${b}, and height ${c} units.`,`${a*b*c} cubic units`,volumeConfusions(a,b,c,'cubic units'),{a,b,c,d:0n,mode:'formula'})}
export function generateAdditiveVolumeQuestion(difficulty:Difficulty){const{a,b,c}=dims(difficulty);let d=BigInt(ri(2,difficulty+4));while(d===c)d=BigInt(ri(2,difficulty+4));const left=a*b*c,right=a*b*d;return q('additive-volume',difficulty,`An L-shaped solid is decomposed into two non-congruent rectangular prisms sharing a base of ${a} by ${b} units and having heights ${c} and ${d} units. What is its combined volume?`,`${left+right} cubic units`,[
 `${left} cubic units`,           // volume of the first prism only
 `${a*b*c*d} cubic units`,        // multiplied the two heights instead of adding them
 `${a+b+c+d} cubic units`,        // added every dimension instead of multiplying
 `${a*b+c+d} cubic units`,        // added the heights onto the shared base area
 `${right} cubic units`,          // volume of the second prism only
],{a,b,c,d,mode:'additive'})}
export function generateMeasurementDesignQuestion(difficulty:Difficulty){const{a,b,c}=dims(difficulty);return q('measurement-design',difficulty,`A storage box is ${a} inches by ${b} inches by ${c} inches. What is its capacity?`,`${a*b*c} cubic inches`,volumeConfusions(a,b,c,'cubic inches'),{a,b,c,d:0n,mode:'design'})}
export const GRADE5_MATH_UNIT8_GENERATORS={'measurement-conversion':generateMeasurementConversionQuestion,'line-plot-fraction-data':generateLinePlotFractionDataQuestion,'volume-unit-cubes':generateVolumeUnitCubesQuestion,'volume-formula':generateVolumeFormulaQuestion,'additive-volume':generateAdditiveVolumeQuestion,'measurement-design':generateMeasurementDesignQuestion} satisfies Record<Grade5MathUnit8ItemType,CurriculumGenerator<Grade5MathUnit8Question>>
export function generateGrade5MathUnit8Question<T extends Grade5MathUnit8ItemType>(type:T,difficulty:Difficulty):Extract<Grade5MathUnit8Question,{itemType:T}>{return GRADE5_MATH_UNIT8_GENERATORS[type](difficulty) as Extract<Grade5MathUnit8Question,{itemType:T}>}
