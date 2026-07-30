import type { SegmentDefinition, SubjectId } from "../prototype/src/content";

export interface TeachingBoardProps {
  readonly subjectId: SubjectId;
  readonly segment: SegmentDefinition;
}

function FractionBar({
  pieces,
  shaded,
  label,
  tone = "orange",
}: {
  readonly pieces: number;
  readonly shaded: number;
  readonly label: string;
  readonly tone?: "orange" | "blue";
}) {
  return (
    <div className="fraction-model">
      <div className="fraction-model__bar" aria-hidden="true">
        {Array.from({ length: pieces }, (_, index) => (
          <span
            className="fraction-model__piece"
            data-shaded={index < shaded}
            data-tone={tone}
            key={index}
          />
        ))}
      </div>
      <strong>{label}</strong>
    </div>
  );
}

function MathVisual({ segment }: { readonly segment: SegmentDefinition }) {
  switch (segment.boardKind) {
    case "fraction-compare":
      return (
        <div className="board-visual board-visual--fractions">
          <FractionBar pieces={2} shaded={1} label="1/2" />
          <span className="board-equation" aria-hidden="true">
            =
          </span>
          <FractionBar pieces={4} shaded={2} label="2/4" tone="blue" />
          <p className="sr-only">
            A bar split into two with one part shaded covers the same amount as a bar split
            into four with two parts shaded.
          </p>
        </div>
      );
    case "fraction-build":
      return (
        <div className="board-visual board-visual--stacked">
          <FractionBar pieces={4} shaded={3} label="3/4" />
          <div className="board-connector" aria-hidden="true">
            split every piece in two
          </div>
          <FractionBar pieces={8} shaded={6} label="6/8" tone="blue" />
          <p className="sr-only">
            Three of four pieces and six of eight pieces cover the same amount.
          </p>
        </div>
      );
    case "fraction-exit":
      return (
        <div className="board-visual board-visual--equation">
          <span className="fraction-number">
            <b>2</b>
            <i />
            <b>3</b>
          </span>
          <span aria-hidden="true">× ?</span>
          <span aria-hidden="true">=</span>
          <span className="fraction-number fraction-number--mystery">
            <b>?</b>
            <i />
            <b>6</b>
          </span>
          <p className="sr-only">
            Two thirds equals an unknown numerator over six.
          </p>
        </div>
      );
    default:
      return (
        <div className="board-visual board-visual--equation">
          <span className="fraction-number">
            <b>{segment.id === "guided-practice" ? "4" : "2"}</b>
            <i />
            <b>{segment.id === "guided-practice" ? "6" : "5"}</b>
          </span>
          <span aria-hidden="true">=</span>
          <span className="fraction-number fraction-number--mystery">
            <b>?</b>
            <i />
            <b>{segment.id === "guided-practice" ? "3" : "10"}</b>
          </span>
          <p className="sr-only">{segment.prompt}</p>
        </div>
      );
  }
}

function ReadingVisual({ segment }: { readonly segment: SegmentDefinition }) {
  if (segment.boardKind === "context-map") {
    return (
      <div className="context-map" aria-label="Context clue map">
        <span>idea one</span>
        <strong>however</strong>
        <span>contrasting idea</span>
      </div>
    );
  }

  const fragments =
    segment.id === "visual-lesson"
      ? [
          ["Mara was ", false],
          ["reluctant", true],
          [" to step onto the wobbly bridge. She ", false],
          ["hung back", true],
          [" while the others crossed.", false],
        ]
      : segment.id === "guided-practice"
        ? [
            ["The puppy was ", false],
            ["timid", true],
            [" at first, ", false],
            ["hiding behind the chair", true],
            [", but soon it crept forward.", false],
          ]
        : segment.id === "exit-ticket"
          ? [
              ["The glass ornament was ", false],
              ["fragile", true],
              [", so Emi ", false],
              ["wrapped it in three layers", true],
              [" of soft paper.", false],
            ]
          : [
              ["After the long hike, Leila felt ", false],
              ["weary", true],
              [". She ", false],
              ["dropped her backpack and sank onto a bench", true],
              [".", false],
            ];

  return (
    <blockquote className="reading-passage">
      {fragments.map(([text, highlighted], index) =>
        highlighted ? <mark key={index}>{text}</mark> : <span key={index}>{text}</span>,
      )}
      <footer>
        <span aria-hidden="true">word</span> + <span aria-hidden="true">nearby evidence</span> ={" "}
        <strong>meaning that fits</strong>
      </footer>
    </blockquote>
  );
}

export function TeachingBoard({ subjectId, segment }: TeachingBoardProps) {
  if (segment.boardKind === "reflection") {
    return (
      <div className="reflection-visual" role="img" aria-label="Three calm check-in signals">
        <span>Confidence</span>
        <span>Effort</span>
        <span>Frustration</span>
      </div>
    );
  }

  return (
    <section className="teaching-board" aria-label="Visual teaching board">
      <div className="teaching-board__label">
        <span className="teaching-board__signal" aria-hidden="true" />
        Visual teaching board
      </div>
      {subjectId === "math" ? (
        <MathVisual segment={segment} />
      ) : (
        <ReadingVisual segment={segment} />
      )}
    </section>
  );
}

export default TeachingBoard;
