import type { ReflectionField, ReflectionState } from "../prototype/src/sessionStore";

export interface ReflectionCheckProps {
  readonly value: ReflectionState;
  readonly onChange: (field: ReflectionField, value: string) => void;
}

const CHECKS: ReadonlyArray<{
  field: ReflectionField;
  legend: string;
  description: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}> = [
  {
    field: "confidence",
    legend: "How confident do you feel?",
    description: "Confidence is what you understand right now.",
    options: [
      { value: "not-yet", label: "Not yet" },
      { value: "getting-there", label: "Getting there" },
      { value: "ready", label: "Ready to explain" },
    ],
  },
  {
    field: "effort",
    legend: "How much effort did you use?",
    description: "Effort is energy, not correctness.",
    options: [
      { value: "light", label: "Light" },
      { value: "steady", label: "Steady" },
      { value: "a-lot", label: "A lot" },
    ],
  },
  {
    field: "frustration",
    legend: "How frustrated do you feel?",
    description: "It is safe to say the task felt hard.",
    options: [
      { value: "calm", label: "Calm" },
      { value: "some", label: "Some frustration" },
      { value: "high", label: "High frustration" },
    ],
  },
];

export function ReflectionCheck({ value, onChange }: ReflectionCheckProps) {
  return (
    <div className="reflection-check">
      {CHECKS.map((check) => (
        <fieldset className="check-scale" key={check.field}>
          <legend>{check.legend}</legend>
          <p>{check.description}</p>
          <div className="check-scale__options">
            {check.options.map((option) => {
              const id = `${check.field}-${option.value}`;
              return (
                <label className="check-scale__option" key={option.value} htmlFor={id}>
                  <input
                    checked={value[check.field] === option.value}
                    id={id}
                    name={check.field}
                    onChange={() => onChange(check.field, option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default ReflectionCheck;
