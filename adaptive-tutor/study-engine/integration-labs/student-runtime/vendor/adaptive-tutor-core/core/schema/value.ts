import type { TSchema } from "./typebox.js";

export interface ValueError {
  path: string;
  message: string;
  value: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validate(schema: TSchema, value: unknown, path: string, errors: ValueError[]): void {
  if ("const" in schema && value !== schema.const) {
    errors.push({ path, message: `Expected literal ${String(schema.const)}`, value });
    return;
  }

  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf)) {
    const valid = anyOf.some((candidate) => {
      const nested: ValueError[] = [];
      validate(candidate as TSchema, value, path, nested);
      return nested.length === 0;
    });
    if (!valid) errors.push({ path, message: "Value does not match any allowed schema", value });
    return;
  }

  const allOf = schema.allOf;
  if (Array.isArray(allOf)) {
    for (const candidate of allOf) validate(candidate as TSchema, value, path, errors);
    return;
  }

  const type = schema.type;
  if (type === "string") {
    if (typeof value !== "string") {
      errors.push({ path, message: "Expected string", value });
      return;
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push({ path, message: `Expected at least ${schema.minLength} characters`, value });
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      errors.push({ path, message: `Expected at most ${schema.maxLength} characters`, value });
    }
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, message: `Expected string matching ${schema.pattern}`, value });
    }
    return;
  }

  if (type === "number" || type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value) || (type === "integer" && !Number.isInteger(value))) {
      errors.push({ path, message: type === "integer" ? "Expected integer" : "Expected number", value });
      return;
    }
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push({ path, message: `Expected value >= ${schema.minimum}`, value });
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push({ path, message: `Expected value <= ${schema.maximum}`, value });
    }
    if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
      errors.push({ path, message: `Expected value > ${schema.exclusiveMinimum}`, value });
    }
    return;
  }

  if (type === "boolean") {
    if (typeof value !== "boolean") errors.push({ path, message: "Expected boolean", value });
    return;
  }

  if (type === "null") {
    if (value !== null) errors.push({ path, message: "Expected null", value });
    return;
  }

  if (type === "array") {
    if (!Array.isArray(value)) {
      errors.push({ path, message: "Expected array", value });
      return;
    }
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push({ path, message: `Expected at least ${schema.minItems} items`, value });
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      errors.push({ path, message: `Expected at most ${schema.maxItems} items`, value });
    }
    if (schema.items && isObject(schema.items)) {
      value.forEach((item, index) => validate(schema.items as TSchema, item, `${path}/${index}`, errors));
    }
    return;
  }

  if (type === "object") {
    if (!isObject(value)) {
      errors.push({ path, message: "Expected object", value });
      return;
    }
    const properties = isObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
    for (const key of required) {
      if (!(key in value)) errors.push({ path: `${path}/${key}`, message: "Required property is missing", value: undefined });
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) validate(childSchema as TSchema, value[key], `${path}/${key}`, errors);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) errors.push({ path: `${path}/${key}`, message: "Unexpected property", value: value[key] });
      }
    }
  }
}

export const Value = {
  Check(schema: TSchema, value: unknown): boolean {
    const errors: ValueError[] = [];
    validate(schema, value, "", errors);
    return errors.length === 0;
  },
  *Errors(schema: TSchema, value: unknown): Iterable<ValueError> {
    const errors: ValueError[] = [];
    validate(schema, value, "", errors);
    yield* errors;
  },
};
