import type {
  ContextMode,
  Dictionary,
  EnvKey,
  ExtendsFormat,
  OutputFormat,
  PrefixFormat,
  Reduce,
  Simplify,
  UndefinedOptional,
} from "@core/defs/common";
import type {
  InferOutput,
  StandardSchemaDictionary,
} from "@core/defs/dictionary";

/**
 * Extracts environment keys based on the execution context.
 * @template Dictionary Environment schema definition.
 * @template Prefix Connfigured client variable prefix.
 * @template Mode Execution context mode.
 */
type PrefixedRuntimeKeys<
  Dictionary extends StandardSchemaDictionary,
  Prefix extends PrefixFormat,
  Mode extends ContextMode,
> = Extract<
  {
    [Key in keyof Dictionary]: Prefix extends string
      ? Key extends EnvKey<Prefix>
        ? Mode extends "client"
          ? Key
          : never
        : Mode extends "server"
          ? Key
          : never
      : Mode extends "server"
        ? Key
        : never;
  }[keyof Dictionary],
  string
>;

/**
 * Represents all environment keys required for strict runtime validation.
 * @template Prefix Configured client variable prefix.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 */
export type RuntimeEnvStrictKeys<
  Prefix extends PrefixFormat,
  Shared extends Dictionary,
  Server extends Dictionary,
  Client extends Dictionary,
> =
  | Extract<keyof Shared, string>
  | PrefixedRuntimeKeys<Server, Prefix, "server">
  | PrefixedRuntimeKeys<Client, Prefix, "client">;

/**
 * Resolves an environment extension into its concrete object shape.
 * @template Extend Extension value to resolve.
 */
export type ResolveExtend<Extend> = Extend extends (
  ...args: never[]
) => infer Result
  ? Result extends object
    ? Result
    : never
  : Extend extends object
    ? Extend
    : never;

/**
 * Merges shared, server and client schema outputs into a single environment shape.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 */
export type MergeSchemas<
  Shared extends Dictionary,
  Server extends Dictionary,
  Client extends Dictionary,
> = UndefinedOptional<InferOutput<Server & Client & Shared>>;

/**
 * Merges all extended environment objects into a single environment shape.
 * Earlier extensions take precedence over later extensions.
 * @template Extends Environment extensions to merge.
 */
type MergeExtends<Extends extends ExtendsFormat> = Readonly<
  Reduce<{ [Key in keyof Extends]: ResolveExtend<Extends[Key]> }>
>;

/**
 * Marges two object types while giving precedence to the base objeect.
 * @template Base Object type with higher precedence.
 * @template Override Object type with lower precedence.
 */
type MergeFirstWins<Base extends object, Override extends object> = Base &
  Omit<Override, keyof Base>;

/**
 * Represents the final environment shape, including declared variables and
 * extended environment presets.
 * @template Environment Declared environment output type.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 * @template Extends Environment extensions.
 */
export type DefineEnv<
  Environment extends OutputFormat,
  Shared extends Dictionary,
  Server extends Dictionary,
  Client extends Dictionary,
  Extends extends ExtendsFormat,
> = Simplify<
  MergeFirstWins<MergeSchemas<Shared, Server, Client>, MergeExtends<Extends>> &
    Environment
>;
