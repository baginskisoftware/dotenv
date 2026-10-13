import type { OutputFormat, Simplify } from "@core/defs/common";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Dicitonary of Standard Schema validators keyed by property name.
 * @template Input Input object shape.
 * @template Output Output object shape.
 */
export type StandardSchemaDictionary<
  Input extends OutputFormat = OutputFormat,
  Output extends OutputFormat = Input,
> = {
  [Key in keyof Input]-?: StandardSchemaV1<
    Input[Key],
    Output[Key & keyof Output]
  >;
};

/** Infers the output object produced by a Standard Schema dictionary. */
export type InferOutput<Dictionary extends StandardSchemaDictionary> =
  Simplify<{
    [Key in keyof Dictionary]: StandardSchemaV1.InferOutput<Dictionary[Key]>;
  }>;
