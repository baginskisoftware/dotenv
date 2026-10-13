import type { StandardSchemaDictionary } from "@core/defs/dictionary";
import type { StandardSchemaV1 } from "@standard-schema/spec";

// general purpose
export type ExtendsFormat = readonly OutputFormat[];
export type PrefixFormat = string | undefined;
export type ContextMode = "server" | "client";

// environment
export type EnvKey<Prefix extends PrefixFormat = PrefixFormat> =
  `${Prefix}${string}`;
export type EnvValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

// shapes
export type OutputFormat = Record<string, unknown>;
export type InputFormat = Record<string, EnvValue>;
export type Dictionary = StandardSchemaDictionary;

/**
 * Produces a compiler-time diagnostic when the condition evaluates to "false".
 * @template Condition The condition the evaluate.
 * @template Message Diagnostic message to surface on failure.
 */
export type Assert<
  Condition extends boolean,
  Message extends string,
> = Condition extends true ? unknown : Message;

/**
 * Extends a type into a plain object representation.
 * @template Shape The shape to simplify.
 */
export type Simplify<Shape> = {
  [Key in keyof Shape]: Shape[Key];
};

/**
 * Produces a type that makes all properties of "Obj" impossible to assign.
 * @template Obj The object type whose properties should be invalidated.
 */
export type Impossible<Obj extends object> = Partial<Record<keyof Obj, never>>;

/**
 * Reduces a tuple of object types into a single merged object type.
 * Later objects take precedence over earlier objects for overlapping keys.
 * @template Tuple The tuple of object types to merge.
 */
export type Reduce<Tuple extends Readonly<object[]>> =
  Tuple extends Readonly<
    [infer Head extends object, ...infer Rest extends Readonly<object[]>]
  >
    ? Head & Omit<Reduce<Rest>, keyof Head>
    : object;

/**
 * Extracts keys whose values included "undefined".
 * @template Obj The object type to inspect.
 */
type UndefinedKeys<Obj> = {
  [Key in keyof Obj]-?: undefined extends Obj[Key] ? Key : never;
}[keyof Obj];

/**
 * Makes properties whose values included "undefined" optional.
 * @template Shape The object shape to transform.
 */
export type UndefinedOptional<Shape> = Simplify<
  Partial<Pick<Shape, UndefinedKeys<Shape>>> & Omit<Shape, UndefinedKeys<Shape>>
>;

/**
 * Represents a Standard Schema that validates an object an produces an
 * environment-compatible output object.
 * @template Output The output type produced after validation.
 */
export type ObjectSchema<Output extends OutputFormat = OutputFormat> =
  StandardSchemaV1<object, Output>;
