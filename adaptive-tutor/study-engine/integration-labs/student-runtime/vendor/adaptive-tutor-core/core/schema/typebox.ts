export const OptionalKind = Symbol("optional");

export interface TSchema<T = unknown> {
  readonly static?: T;
  readonly [OptionalKind]?: true;
  [key: string]: unknown;
}

export type Static<T extends TSchema> = T extends TSchema<infer S> ? S : never;

type OptionalKeys<P extends Record<string, TSchema>> = {
  [K in keyof P]: P[K] extends { readonly [OptionalKind]: true } ? K : never;
}[keyof P];

type RequiredKeys<P extends Record<string, TSchema>> = Exclude<keyof P, OptionalKeys<P>>;

type ObjectStatic<P extends Record<string, TSchema>> = {
  [K in RequiredKeys<P>]: Static<P[K]>;
} & {
  [K in OptionalKeys<P>]?: Static<P[K]>;
};

type UnionStatic<T extends readonly TSchema[]> = Static<T[number]>;
type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
  arg: infer I,
) => void
  ? I
  : never;
type CompositeStatic<T extends readonly TSchema[]> = UnionToIntersection<Static<T[number]>>;

function withOptions<T extends TSchema>(schema: T, options?: Record<string, unknown>): T {
  return Object.assign(schema, options ?? {});
}

export const Type = {
  String(options?: Record<string, unknown>): TSchema<string> {
    return withOptions({ type: "string" }, options);
  },
  Number(options?: Record<string, unknown>): TSchema<number> {
    return withOptions({ type: "number" }, options);
  },
  Integer(options?: Record<string, unknown>): TSchema<number> {
    return withOptions({ type: "integer" }, options);
  },
  Boolean(options?: Record<string, unknown>): TSchema<boolean> {
    return withOptions({ type: "boolean" }, options);
  },
  Null(options?: Record<string, unknown>): TSchema<null> {
    return withOptions({ type: "null" }, options);
  },
  Literal<const L extends string | number | boolean | null>(
    value: L,
    options?: Record<string, unknown>,
  ): TSchema<L> {
    const type = value === null ? "null" : typeof value;
    return withOptions({ const: value, type }, options);
  },
  Optional<T extends TSchema>(schema: T): T & { readonly [OptionalKind]: true } {
    Object.defineProperty(schema, OptionalKind, { value: true, enumerable: false });
    return schema as T & { readonly [OptionalKind]: true };
  },
  Array<T extends TSchema>(items: T, options?: Record<string, unknown>): TSchema<Array<Static<T>>> {
    return withOptions({ type: "array", items }, options);
  },
  Object<const P extends Record<string, TSchema>>(
    properties: P,
    options?: Record<string, unknown>,
  ): TSchema<ObjectStatic<P>> {
    const required = Object.entries(properties)
      .filter(([, schema]) => schema[OptionalKind] !== true)
      .map(([key]) => key);
    return withOptions(
      {
        type: "object",
        properties,
        required,
      },
      options,
    );
  },
  Union<const T extends readonly TSchema[]>(
    schemas: T,
    options?: Record<string, unknown>,
  ): TSchema<UnionStatic<T>> {
    return withOptions({ anyOf: schemas }, options);
  },
  Composite<const T extends readonly TSchema[]>(
    schemas: T,
    options?: Record<string, unknown>,
  ): TSchema<CompositeStatic<T>> {
    const objectSchemas = schemas.filter((schema) => schema.type === "object");
    if (objectSchemas.length === schemas.length) {
      const properties = Object.assign(
        {},
        ...objectSchemas.map((schema) =>
          typeof schema.properties === "object" && schema.properties !== null
            ? schema.properties
            : {},
        ),
      );
      const required = [
        ...new Set(
          objectSchemas.flatMap((schema) =>
            Array.isArray(schema.required) ? (schema.required as string[]) : [],
          ),
        ),
      ];
      const additionalProperties =
        options?.additionalProperties ??
        (objectSchemas.some((schema) => schema.additionalProperties === false) ? false : undefined);
      return withOptions(
        {
          type: "object",
          properties,
          required,
          ...(additionalProperties === undefined ? {} : { additionalProperties }),
        },
        options,
      ) as TSchema<CompositeStatic<T>>;
    }
    return withOptions({ allOf: schemas }, options) as TSchema<CompositeStatic<T>>;
  },
};
