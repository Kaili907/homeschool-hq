"""Verified Michigan mathematics standards catalog for Grades 3 and 4.

Source of record: "Michigan K-12 Standards: Mathematics", Michigan Department of
Education, linked from https://www.michigan.gov/mde/services/academic-standards.

Format convention: the MDE document prints a domain header, a prose cluster
heading, then standards numbered continuously within the domain. Cluster letters
(A/B/C) do NOT appear in the document. Codes are therefore written 3.OA.1, not
3.OA.A.1 -- the same convention already used by the Manuel Academy v1.0.0
Grade 5 mathematics course.

The MP.n prefix is a Manuel Academy package convention. The MDE document numbers
the Standards for Mathematical Practice plainly 1-8 under that heading; the
literal string "MP.1" does not appear in the MDE text. The prefix is retained for
consistency with v1.0.0 and must not be described as MDE's own notation.

DOMAIN CEILINGS (verified; codes beyond these do not exist):
  3.OA -> 9    3.NBT -> 3    3.NF -> 3    3.MD -> 8    3.G -> 2
  4.OA -> 5    4.NBT -> 6    4.NF -> 7    4.MD -> 7    4.G -> 3
"""

DOMAIN_CEILINGS = {
  "3.OA": 9, "3.NBT": 3, "3.NF": 3, "3.MD": 8, "3.G": 2,
  "4.OA": 5, "4.NBT": 6, "4.NF": 7, "4.MD": 7, "4.G": 3,
}

DOMAIN_TITLES = {
  "OA": "Operations and Algebraic Thinking",
  "NBT": "Number and Operations in Base Ten",
  "NF": "Number and Operations - Fractions",
  "MD": "Measurement and Data",
  "G": "Geometry",
}

SCOPE_NOTES = {
  3: [
    "Grade 3 fractions are limited to denominators 2, 3, 4, 6, and 8.",
    "A range of algorithms may be used for base-ten computation.",
  ],
  4: [
    "Grade 4 fractions are limited to denominators 2, 3, 4, 5, 6, 8, 10, 12, and 100.",
    "Grade 4 base-ten work is limited to whole numbers less than or equal to 1,000,000.",
  ],
}

G3 = {
  "3.OA.1": "Interpret products of whole numbers, such as 5 x 7 as five groups of seven objects.",
  "3.OA.2": "Interpret whole-number quotients as equal sharing or as equal grouping.",
  "3.OA.3": "Use multiplication and division within 100 to solve word problems involving equal groups, arrays, and measurement quantities.",
  "3.OA.4": "Determine the unknown whole number in a multiplication or division equation.",
  "3.OA.5": "Apply properties of operations as strategies to multiply and divide; formal property names are not required.",
  "3.OA.6": "Understand division as an unknown-factor problem.",
  "3.OA.7": "Fluently multiply and divide within 100; know from memory all products of two one-digit numbers by the end of Grade 3.",
  "3.OA.8": "Solve two-step word problems using the four operations and assess the reasonableness of answers.",
  "3.OA.9": "Identify and explain arithmetic patterns using properties of operations.",
  "3.NBT.1": "Use place-value understanding to round whole numbers to the nearest 10 or 100.",
  "3.NBT.2": "Fluently add and subtract within 1000 using strategies and algorithms based on place value and the relationship between addition and subtraction.",
  "3.NBT.3": "Multiply one-digit whole numbers by multiples of 10 in the range 10 to 90.",
  "3.NF.1": "Understand 1/b as one part of a whole partitioned into b equal parts, and a/b as a parts of size 1/b.",
  "3.NF.2": "Understand a fraction as a number on the number line and represent fractions on a number-line diagram.",
  "3.NF.3": "Explain equivalence of fractions in special cases and compare fractions by reasoning about their size.",
  "3.MD.1": "Tell and write time to the nearest minute and solve word problems involving time intervals in minutes.",
  "3.MD.2": "Measure and estimate liquid volumes and masses of objects using grams, kilograms, and liters, and solve one-step problems.",
  "3.MD.3": "Draw scaled picture graphs and scaled bar graphs and solve one- and two-step problems using the information.",
  "3.MD.4": "Generate measurement data by measuring lengths using rulers marked with halves and fourths of an inch and show the data on a line plot.",
  "3.MD.5": "Recognize area as an attribute of plane figures and understand concepts of area measurement.",
  "3.MD.6": "Measure areas by counting unit squares in square centimeters, square meters, square inches, square feet, and improvised units.",
  "3.MD.7": "Relate area to the operations of multiplication and addition.",
  "3.MD.8": "Solve real-world and mathematical problems involving perimeters of polygons, including the relationship between perimeter and area.",
  "3.G.1": "Understand that shapes in different categories may share attributes that define a larger category, such as quadrilaterals.",
  "3.G.2": "Partition shapes into parts with equal areas and express the area of each part as a unit fraction of the whole.",
}

G3_SUBPARTS = {
  "3.NF.2a": "Represent 1/b on a number line by partitioning the interval from 0 to 1 into b equal parts.",
  "3.NF.2b": "Represent a/b on a number line by marking off a lengths of 1/b from 0.",
  "3.NF.3a": "Understand two fractions as equivalent if they are the same size or the same point on a number line.",
  "3.NF.3b": "Recognize and generate simple equivalent fractions and explain why they are equivalent.",
  "3.NF.3c": "Express whole numbers as fractions and recognize fractions equivalent to whole numbers.",
  "3.NF.3d": "Compare two fractions with the same numerator or the same denominator and record the result with >, =, or <.",
  "3.MD.5a": "Understand that a square with side length 1 unit has one square unit of area.",
  "3.MD.5b": "Understand that a plane figure covered by n unit squares without gaps or overlaps has an area of n square units.",
  "3.MD.7a": "Find the area of a rectangle by tiling it and show that the area is the same as multiplying the side lengths.",
  "3.MD.7b": "Multiply side lengths to find areas of rectangles in real-world and mathematical problems.",
  "3.MD.7c": "Use tiling to show that the area of a rectangle with side lengths a and b + c is a x b + a x c.",
  "3.MD.7d": "Recognize area as additive and find areas of rectilinear figures by decomposing them into non-overlapping rectangles.",
}

G4 = {
  "4.OA.1": "Interpret a multiplication equation as a comparison, such as 35 = 5 x 7 meaning 35 is five times as many as seven.",
  "4.OA.2": "Multiply or divide to solve word problems involving multiplicative comparison, distinguishing it from additive comparison.",
  "4.OA.3": "Solve multistep word problems with the four operations, including problems in which remainders must be interpreted, and assess reasonableness.",
  "4.OA.4": "Find all factor pairs for a whole number from 1 to 100, recognize multiples, and determine whether a number is prime or composite.",
  "4.OA.5": "Generate a number or shape pattern from a given rule and identify features of the pattern not explicit in the rule.",
  "4.NBT.1": "Recognize that a digit in one place represents ten times what it represents in the place to its right.",
  "4.NBT.2": "Read and write multi-digit whole numbers in numerals, number names, and expanded form, and compare them using >, =, and <.",
  "4.NBT.3": "Use place-value understanding to round multi-digit whole numbers to any place.",
  "4.NBT.4": "Fluently add and subtract multi-digit whole numbers using the standard algorithm.",
  "4.NBT.5": "Multiply a whole number of up to four digits by a one-digit number, and multiply two two-digit numbers, using place-value strategies.",
  "4.NBT.6": "Find whole-number quotients and remainders with up to four-digit dividends and one-digit divisors using place-value strategies.",
  "4.NF.1": "Explain why a/b equals (n x a)/(n x b) using visual fraction models and use the principle to generate equivalent fractions.",
  "4.NF.2": "Compare two fractions with different numerators and different denominators using common denominators, common numerators, or benchmarks.",
  "4.NF.3": "Understand a fraction a/b with a greater than 1 as a sum of fractions 1/b.",
  "4.NF.4": "Apply and extend previous understandings of multiplication to multiply a fraction by a whole number.",
  "4.NF.5": "Express a fraction with denominator 10 as an equivalent fraction with denominator 100 and add fractions with denominators 10 and 100.",
  "4.NF.6": "Use decimal notation for fractions with denominators 10 or 100.",
  "4.NF.7": "Compare two decimals to hundredths by reasoning about their size and record the result with >, =, or <.",
  "4.MD.1": "Know relative sizes of measurement units within one system and express measurements in a larger unit in terms of a smaller unit.",
  "4.MD.2": "Use the four operations to solve word problems involving distance, time, liquid volume, mass, and money, including simple fractions and decimals.",
  "4.MD.3": "Apply the area and perimeter formulas for rectangles in real-world and mathematical problems.",
  "4.MD.4": "Make a line plot to display a data set of measurements in fractions of a unit and solve problems using the line plot.",
  "4.MD.5": "Recognize angles as geometric shapes formed wherever two rays share a common endpoint and understand concepts of angle measurement.",
  "4.MD.6": "Measure angles in whole-number degrees using a protractor and sketch angles of a specified measure.",
  "4.MD.7": "Recognize angle measure as additive and solve addition and subtraction problems to find unknown angles.",
  "4.G.1": "Draw points, lines, line segments, rays, angles, and perpendicular and parallel lines, and identify these in two-dimensional figures.",
  "4.G.2": "Classify two-dimensional figures based on the presence of parallel or perpendicular lines or angles of a specified size.",
  "4.G.3": "Recognize a line of symmetry for a two-dimensional figure, identify line-symmetric figures, and draw lines of symmetry.",
}

G4_SUBPARTS = {
  "4.NF.3a": "Understand addition and subtraction of fractions as joining and separating parts referring to the same whole.",
  "4.NF.3b": "Decompose a fraction into a sum of fractions with the same denominator in more than one way.",
  "4.NF.3c": "Add and subtract mixed numbers with like denominators.",
  "4.NF.3d": "Solve word problems involving addition and subtraction of fractions with like denominators.",
  "4.NF.4a": "Understand a fraction a/b as a multiple of 1/b.",
  "4.NF.4b": "Understand a multiple of a/b as a multiple of 1/b and use this to multiply a fraction by a whole number.",
  "4.NF.4c": "Solve word problems involving multiplication of a fraction by a whole number.",
  "4.MD.5a": "Understand that an angle turning through 1/360 of a circle is called a one-degree angle.",
  "4.MD.5b": "Understand that an angle turning through n one-degree angles has a measure of n degrees.",
}

MATHEMATICAL_PRACTICES = {
  "MP.1": "Make sense of problems and persevere in solving them",
  "MP.2": "Reason abstractly and quantitatively",
  "MP.3": "Construct viable arguments and critique the reasoning of others",
  "MP.4": "Model with mathematics",
  "MP.5": "Use appropriate tools strategically",
  "MP.6": "Attend to precision",
  "MP.7": "Look for and make use of structure",
  "MP.8": "Look for and express regularity in repeated reasoning",
}

# Sub-parts are mapped to the parent standard the daily lessons carry, so that
# coverage of a parent code can be reported at sub-part granularity.
SUBPART_PARENT = {}
for _k in list(G3_SUBPARTS) + list(G4_SUBPARTS):
    SUBPART_PARENT[_k] = _k[:-1]

CATALOG = {3: G3, 4: G4}
SUBPARTS = {3: G3_SUBPARTS, 4: G4_SUBPARTS}

SOURCES = [
  {"title": "Michigan K-12 Standards: Mathematics (Michigan Department of Education)",
   "url": "https://www.michigan.gov/mde/-/media/Project/Websites/mde/Literacy/Content-Standards/Math_Standards.pdf",
   "role": "Source of record for every Grade 3 and Grade 4 code and paraphrase in this catalog."},
  {"title": "Michigan Academic Standards (MDE service page)",
   "url": "https://www.michigan.gov/mde/services/academic-standards",
   "role": "Provenance page that links the mathematics standards document."},
  {"title": "Michigan Mathematics Standards and Resources",
   "url": "https://www.michigan.gov/mde/services/academic-standards/mmc/curriculum/math",
   "role": "Cited by Manuel Academy v1.0.0; resolves, but the Academic Standards page is what actually serves the document."},
]


def validate_code(code):
    """Return True when a content code exists in the verified catalog."""
    if code.startswith("MP."):
        return code in MATHEMATICAL_PRACTICES
    return code in G3 or code in G4 or code in G3_SUBPARTS or code in G4_SUBPARTS
