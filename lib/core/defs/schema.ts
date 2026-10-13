import type {
  Assert,
  Dictionary,
  EnvKey,
  PrefixFormat,
  UndefinedOptional,
} from "@core/defs/common";
import type {
  InferOutput,
  StandardSchemaDictionary,
} from "@core/defs/dictionary";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Determinates whether a property key belongs to the client namespace defined
 * by the given prefix.
 * @template Key Environment variable key to evaluate.
 * @template Prefix Configured client variable prefix.
 */
type IsClientkey<Key, Prefix extends string> =
  Key extends EnvKey<Prefix> ? true : false;

/**
 * Validates whether a key belongs to the client namespace.
 * @template Key Environment variable key to validate.
 * @template Prefix Configured client variable prefix.
 */
type AssertClientKey<Key, Prefix extends PrefixFormat> = Prefix extends string
  ? Assert<
      IsClientkey<Key, Prefix>,
      `'${Extract<Key, string>}' is not prefixed with '${Prefix}'`
    >
  : unknown;

/**
 * Validates whether a property key is allowed in the server namespace.
 * @template Key Environment variable key to validate.
 * @template Prefix Configured client variable prefix.
 */
type AssertServerKey<Key, Prefix extends PrefixFormat> = Prefix extends string
  ? Assert<
      IsClientkey<Key, Prefix> extends true ? false : true,
      `'${Extract<Key, string>}' should not be prefixed with '${Prefix}'`
    >
  : unknown;

/**
 * Maps a client schema.
 * @template Prefix Configured client variable prefix.
 * @template Dicitonary Client environment schema.
 */
export type ClientSchema<
  Prefix extends PrefixFormat,
  Dictionary extends StandardSchemaDictionary,
> = {
  [Key in keyof Dictionary]: Dictionary[Key] & AssertClientKey<Key, Prefix>;
};

/**
 * Maps a server schema.
 * @template Prefix Configured client variable prefix.
 * @template Dicitonary Server environment schema.
 */
export type ServerSchema<
  Prefix extends PrefixFormat,
  Dicitonary extends StandardSchemaDictionary,
> = {
  [Key in keyof Dicitonary]: Dicitonary[Key] & AssertServerKey<Key, Prefix>;
};

/**
 * Represents a combined environment schema.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 */
export type CombinedSchema<
  Shared extends Dictionary,
  Server extends Dictionary,
  Client extends Dictionary,
> = StandardSchemaV1<
  object,
  UndefinedOptional<InferOutput<Server & Client & Shared>>
>;
