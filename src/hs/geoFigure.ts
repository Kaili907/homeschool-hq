// ---------- M4 geometry figure descriptors (pure data, no React) ----------
//
// A GeoFigure is a small, serializable description of a diagram. The generator
// in geometryGen.ts produces it; GeoFigureView (components/GeoFigure.tsx) draws
// it as SVG. Keeping this file dependency-free lets types.ts reference it for
// the additive Visual `geo` variant without a circular import.

/**
 * The eight angles formed when a transversal crosses two parallel lines.
 * 1–4 sit at the upper intersection, 5–8 at the lower one, each numbered
 * TL, TR, BL, BR (top-left, top-right, bottom-left, bottom-right).
 */
export type AnglePos = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type GeoFigure =
  /** Two parallel lines cut by a transversal. `givenPos` shows a value, `askPos` shows "?". */
  | { kind: 'parallelLines'; acute: number; givenPos: AnglePos; askPos: AnglePos }
  /** Right triangle; the unknown leg/hypotenuse renders as "?". */
  | { kind: 'rightTriangle'; a: string; b: string; c: string; rightAt?: 'corner' }
  /** Generic triangle with three angle labels (any may be "?"). */
  | { kind: 'triangleAngles'; angles: [string, string, string] }
  /** Triangle with three side labels; optional tick counts mark congruent sides. */
  | { kind: 'triangleSides'; sides: [string, string, string]; ticks?: [number, number, number] }
  /** Circle labeled with a radius or diameter segment. */
  | { kind: 'circle'; label: string; which: 'r' | 'd' }
  /** A quadrilateral with edge/height labels (order documented per shape). */
  | { kind: 'quad'; shape: 'rectangle' | 'square' | 'parallelogram' | 'trapezoid'; labels: string[] }
  /** Two labeled points on a coordinate plane (slope / distance / midpoint). */
  | { kind: 'coordPair'; x1: number; y1: number; x2: number; y2: number }
  /** A 3-D rectangular box with edge labels (volume / surface area). */
  | { kind: 'box'; l: string; w: string; h: string }
