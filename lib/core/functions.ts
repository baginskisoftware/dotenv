import type {
  Dictionary,
  ExtendsFormat,
  InputFormat,
  ObjectSchema,
  OutputFormat,
  PrefixFormat,
} from "@core/defs/common";
import type {
  InferOutput,
  StandardSchemaDictionary,
} from "@core/defs/dictionary";
import type { EnvOptions } from "@core/defs/options";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Detects whether the current runtime is server-side JavaScript runtime.
 * Supports Node, Bun, and Deno while treating browser-like runtimes as
 * client-side environments.
 */
export function detectServerRuntime(): boolean {
  if (typeof globalThis === "undefined") return false;
  if ("Bun" in globalThis) return true;
  if ("Deno" in globalThis) return true;

  if (
    "process" in globalThis &&
    typeof globalThis.process === "object" &&
    globalThis.process !== null &&
    "versions" in globalThis &&
    typeof globalThis.process.versions === "object" &&
    globalThis.process.versions !== null &&
    "node" in globalThis.process.versions
  ) {
    return true;
  }
  return typeof window === "undefined";
}

/**
 * Selects only the requested keys from an object.
 * @template Obj Source object.
 * @param object Object to filter.
 * @param keys Keys to retain.
 * @returns Object containing only the selected keys.
 */
export function pickObject<Obj extends object>(
  object: Obj,
  keys: ReadonlySet<string>,
): OutputFormat {
  return Object.fromEntries(
    Object.entries(object).filter(([key]) => keys.has(key)),
  );
}

/**
 * Selects only the requested keys from a environment extension.
 * @param extendsList Extensions to filter.
 * @param keys Keys to retain.
 * @returns Object containing only the selected keys.
 */
export function pickExtends<Extends extends ExtendsFormat>(
  extendsList: Extends,
  keys: ReadonlySet<string>,
): Extends {
  return Object.freeze(
    extendsList
      .map((extension) => pickObject(extension, keys))
      .filter((extension) => Object.keys(extension).length > 0),
  ) as Extends;
}

/**
 * Resolves a runtime environment from the provided options.
 * @template Prefix Configured client variable prefix.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 * @template Extends Environment extensions.
 * @template FinalSchema Final environment schema.
 * @param options Environment creation options.
 * @returns Environment variables to validate.
 */
export function resolveRuntimeEnvironment<
  Prefix extends PrefixFormat,
  Shared extends Dictionary,
  Server extends Dictionary,
  Client extends Dictionary,
  Extends extends ExtendsFormat,
  FinalSchema extends ObjectSchema,
>(
  options: EnvOptions<Prefix, Shared, Server, Client, Extends, FinalSchema>,
): Record<string, unknown> {
  if ("runtimeEnvStrict" in options) {
    return options.runtimeEnvStrict ?? process.env;
  }
  if ("runtimeEnv" in options) {
    return options.runtimeEnv;
  }
  return process.env;
}

/**
 * Normalizes the runtime environment according to the configured options.
 * @param runtimeEnv Runtime environment.
 * @param emptyStringAsUndefined Whether empty strings should be removed.
 * @returns Normalized runtime environment.
 */
export function normalizeRuntimeEnvironment(
  runtimeEnv: Record<string, unknown>,
  emptyStringAsUndefined?: boolean,
): Record<string, unknown> {
  if (!emptyStringAsUndefined) return runtimeEnv;
  return Object.fromEntries(
    Object.entries(runtimeEnv).filter(
      ([_, value]) => value !== "" && value !== undefined,
    ),
  );
}

/**
 * Retrieves a schema from a dictionary while preserving key interface.
 * @template Dict Schema dictionary containing the validator.
 * @template Key Key used to retrieve the schema.
 * @param dictionary The schema dictionary.
 * @param key Property key whose schema should be retreived.
 * @returns Schema from dictionary.
 */
function getDictionarySchema<
  Dict extends StandardSchemaDictionary,
  Key extends keyof Dict,
>(dictionary: Dict, key: Key): Dict[Key] {
  return dictionary[key];
}

/**
 * Ensures that a validation result is synchronous.
 * Throws when the provided value is promise-like.
 * @template Sync Expected synchronous value type.
 * @param value Validation result.
 * @param message Error message.
 * @throws {Error} When a promise-like value is provided.
 */
export function ensureSynchronous<Sync>(
  value: Sync | Promise<Sync>,
  message: string,
): asserts value is Sync {
  if (typeof value === "object" && value !== null && "then" in value) {
    throw new Error(message);
  }
}

/**
 * Validates an object using a schema dictionary.
 * @template Dict Schema dictionary.
 * @param dictionary Property validators.
 * @param input Object to validate.
 * @returns Validation result.
 */
export function parseWithDictionary<Dict extends StandardSchemaDictionary>(
  dictionary: Dict,
  input: InputFormat,
): StandardSchemaV1.Result<InferOutput<Dict>> {
  const output: Partial<InferOutput<Dict>> = {};
  const issues: StandardSchemaV1.Issue[] = [];

  for (const key of Object.keys(dictionary) as Array<keyof Dict>) {
    const schema = getDictionarySchema(dictionary, key);
    const result = schema["~standard"].validate(input[String(key)]);

    ensureSynchronous(
      result,
      `Validation for '${String(key)}' must be synchronous.`,
    );

    if (result.issues) {
      issues.push(
        ...result.issues.map((issue) => ({
          ...issue,
          path: [key, ...(issue.path ?? [])],
        })),
      );
      continue;
    }
    output[key] = result.value;
  }
  return issues.length > 0
    ? { issues }
    : { value: output as InferOutput<Dict> };
}
