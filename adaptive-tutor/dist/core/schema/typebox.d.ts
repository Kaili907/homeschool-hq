export declare const OptionalKind: unique symbol;
export interface TSchema<T = unknown> {
    readonly static?: T;
    readonly [OptionalKind]?: true;
    [key: string]: unknown;
}
export type Static<T extends TSchema> = T extends TSchema<infer S> ? S : never;
type OptionalKeys<P extends Record<string, TSchema>> = {
    [K in keyof P]: P[K] extends {
        readonly [OptionalKind]: true;
    } ? K : never;
}[keyof P];
type RequiredKeys<P extends Record<string, TSchema>> = Exclude<keyof P, OptionalKeys<P>>;
type ObjectStatic<P extends Record<string, TSchema>> = {
    [K in RequiredKeys<P>]: Static<P[K]>;
} & {
    [K in OptionalKeys<P>]?: Static<P[K]>;
};
type UnionStatic<T extends readonly TSchema[]> = Static<T[number]>;
type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (arg: infer I) => void ? I : never;
type CompositeStatic<T extends readonly TSchema[]> = UnionToIntersection<Static<T[number]>>;
export declare const Type: {
    String(options?: Record<string, unknown>): TSchema<string>;
    Number(options?: Record<string, unknown>): TSchema<number>;
    Integer(options?: Record<string, unknown>): TSchema<number>;
    Boolean(options?: Record<string, unknown>): TSchema<boolean>;
    Null(options?: Record<string, unknown>): TSchema<null>;
    Literal<const L extends string | number | boolean | null>(value: L, options?: Record<string, unknown>): TSchema<L>;
    Optional<T extends TSchema>(schema: T): T & {
        readonly [OptionalKind]: true;
    };
    Array<T extends TSchema>(items: T, options?: Record<string, unknown>): TSchema<Array<Static<T>>>;
    Object<const P extends Record<string, TSchema>>(properties: P, options?: Record<string, unknown>): TSchema<ObjectStatic<P>>;
    Union<const T extends readonly TSchema[]>(schemas: T, options?: Record<string, unknown>): TSchema<UnionStatic<T>>;
    Composite<const T extends readonly TSchema[]>(schemas: T, options?: Record<string, unknown>): TSchema<CompositeStatic<T>>;
};
export {};
//# sourceMappingURL=typebox.d.ts.map