export const OptionalKind = Symbol("optional");
function withOptions(schema, options) {
    return Object.assign(schema, options ?? {});
}
export const Type = {
    String(options) {
        return withOptions({ type: "string" }, options);
    },
    Number(options) {
        return withOptions({ type: "number" }, options);
    },
    Integer(options) {
        return withOptions({ type: "integer" }, options);
    },
    Boolean(options) {
        return withOptions({ type: "boolean" }, options);
    },
    Null(options) {
        return withOptions({ type: "null" }, options);
    },
    Literal(value, options) {
        const type = value === null ? "null" : typeof value;
        return withOptions({ const: value, type }, options);
    },
    Optional(schema) {
        Object.defineProperty(schema, OptionalKind, { value: true, enumerable: false });
        return schema;
    },
    Array(items, options) {
        return withOptions({ type: "array", items }, options);
    },
    Object(properties, options) {
        const required = Object.entries(properties)
            .filter(([, schema]) => schema[OptionalKind] !== true)
            .map(([key]) => key);
        return withOptions({
            type: "object",
            properties,
            required,
        }, options);
    },
    Union(schemas, options) {
        return withOptions({ anyOf: schemas }, options);
    },
    Composite(schemas, options) {
        const objectSchemas = schemas.filter((schema) => schema.type === "object");
        if (objectSchemas.length === schemas.length) {
            const properties = Object.assign({}, ...objectSchemas.map((schema) => typeof schema.properties === "object" && schema.properties !== null
                ? schema.properties
                : {}));
            const required = [
                ...new Set(objectSchemas.flatMap((schema) => Array.isArray(schema.required) ? schema.required : [])),
            ];
            const additionalProperties = options?.additionalProperties ??
                (objectSchemas.some((schema) => schema.additionalProperties === false) ? false : undefined);
            return withOptions({
                type: "object",
                properties,
                required,
                ...(additionalProperties === undefined ? {} : { additionalProperties }),
            }, options);
        }
        return withOptions({ allOf: schemas }, options);
    },
};
