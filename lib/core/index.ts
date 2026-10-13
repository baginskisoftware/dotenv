import type {
  Dictionary,
  ExtendsFormat,
  ObjectSchema,
  OutputFormat,
  PrefixFormat,
} from "@core/defs/common";
import type { CreateEnv, EnvOptionsWithServer } from "@core/defs/options";
import type { DefineEnv } from "@core/defs/runtime";
import type { CombinedSchema } from "@core/defs/schema";
import {
  detectServerRuntime,
  ensureSynchronous,
  normalizeRuntimeEnvironment,
  parseWithDictionary,
  pickExtends,
  pickObject,
  resolveRuntimeEnvironment,
} from "@core/functions";
import type { StandardSchemaV1 } from "@standard-schema/spec";

// environment properties ignored by the clien-side access guard
const IGNORED_ENV_PROPERTIES: Set<string> = new Set(["__esModule", "$$typeof"]);

/**
 * Represents a typed environment factory that creates validated environment
 * objects and optionally restricts the result to a selected set of keys.
 */
type EnvFactory<Result extends OutputFormat> = {
  (): Readonly<Result>;
  <const Keys extends Readonly<(keyof Result & string)[]>>(
    keys: Keys,
  ): Readonly<Pick<Result, Keys[number]>>;
};

/**
 * Creates a validated, type-safe environment object.
 * @template Prefix Configured client variable prefix.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 * @template Extends Environment extensions.
 * @template FinalSchema Final environment schema.
 * @param options Environment creation options.
 * @returns Readonly validated environment object.
 * @throws {Error} When validation fails and no custom error handler is provided.
 */
function createEnvironment<
  Prefix extends PrefixFormat = undefined,
  Shared extends Dictionary = NonNullable<unknown>,
  Server extends Dictionary = NonNullable<unknown>,
  Client extends Dictionary = NonNullable<unknown>,
  const Extends extends ExtendsFormat = [],
  FinalSchema extends ObjectSchema = CombinedSchema<Shared, Server, Client>,
>(
  options: EnvOptionsWithServer<
    Prefix,
    Shared,
    Server,
    Client,
    Extends,
    FinalSchema
  >,
): CreateEnv<FinalSchema, Extends> {
  const runtimeEnv: Record<string, unknown> = normalizeRuntimeEnvironment(
    resolveRuntimeEnvironment(options),
    options.emptyStringAsUndefined,
  );

  const {
    client = {},
    server = {},
    shared = {},
    isServer: configuredServer,
    extends: extensions = [],
    onValidationError,
    onInvalidAccess,
    createFinalSchema,
  } = options;

  const isServer: boolean = configuredServer ?? detectServerRuntime();
  const schema = isServer
    ? { ...shared, ...server, ...client }
    : { ...shared, ...client };

  const extendedEnv = Object.assign({}, ...extensions);
  const runtimeWithExtensions = { ...extendedEnv, ...runtimeEnv };
  if (options.skipValidation) {
    return runtimeWithExtensions;
  }

  const finalSchema = createFinalSchema?.(schema as never, isServer);
  const result =
    finalSchema?.["~standard"].validate(runtimeWithExtensions) ??
    parseWithDictionary(schema, runtimeWithExtensions);

  ensureSynchronous(result, "Environment validation must be synchronous.");
  if (result.issues) {
    const handleValidationError =
      onValidationError ??
      ((issues: Readonly<StandardSchemaV1.Issue[]>) => {
        console.error("Invalid environment variables: ", issues);
        throw new Error("Invalid environment varibales");
      });
    return handleValidationError(result.issues);
  }

  const clientPrefix =
    "clientPrefix" in options ? options.clientPrefix : undefined;

  const canAccessServerVariable = (key: string): boolean =>
    Boolean(clientPrefix && !key.startsWith(clientPrefix) && !(key in shared));

  const handleInvalidAccess =
    onInvalidAccess ??
    (() => {
      throw new Error(
        "Attemped to access a server-side environment variable on the client.",
      );
    });

  const environment = Object.freeze({ ...extendedEnv, ...result.value });
  return new Proxy(environment, {
    get(target, property, receiver) {
      if (
        typeof property === "string" &&
        !IGNORED_ENV_PROPERTIES.has(property) &&
        !isServer &&
        canAccessServerVariable(property)
      ) {
        return handleInvalidAccess(property);
      }
      return Reflect.get(target, property, receiver);
    },

    set(_target, property) {
      throw new TypeError(
        typeof property === "string"
          ? `Cannot assign to read only property '${property}'.`
          : "Cannot assign to read only property.",
      );
    },
  });
}

/**
 * Creates a type-safe environment validator with runtime parsing, validation,
 * and compiler-time inference.
 *
 * The schema is infered automatically from the provided configuration.
 * An explicit environment type may be supplied when a specific output
 * contract is required.
 *
 * @template Environment Runtime environment schema.
 * @template Prefix Configured client variable prefix.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 * @template Extends Environment extensions.
 * @template FinalSchema Final environment schema.
 * @param options Environment creation options.
 * @returns Factory function that creates a readonly validated environment object.
 * @throws {Error} When validation fails and no custom validation handler is provided.
 */
export function defineEnvironment<
  Environment extends OutputFormat = NonNullable<unknown>,
  Prefix extends PrefixFormat = undefined,
  Shared extends Dictionary = NonNullable<unknown>,
  Server extends Dictionary = NonNullable<unknown>,
  Client extends Dictionary = NonNullable<unknown>,
  const Extends extends ExtendsFormat = [],
  FinalSchema extends ObjectSchema = CombinedSchema<Shared, Server, Client>,
>(
  options: EnvOptionsWithServer<
    Prefix,
    Shared,
    Server,
    Client,
    Extends,
    FinalSchema
  >,
): EnvFactory<DefineEnv<Environment, Shared, Server, Client, Extends>> {
  type TResult = DefineEnv<Environment, Shared, Server, Client, Extends>;
  function createDefinedEnvironment(): Readonly<TResult>;

  function createDefinedEnvironment<
    const TKeys extends Readonly<(keyof TResult & string)[]>,
  >(keys: TKeys): Readonly<Pick<TResult, TKeys[number]>>;

  function createDefinedEnvironment<
    const TKeys extends Readonly<(keyof TResult & string)[] | undefined>,
  >(keys?: TKeys) {
    if (keys === undefined) return createEnvironment(options);

    const selected = new Set<string>(keys);
    const filteredOptions = {
      ...options,
      shared: options.shared ? pickObject(options.shared, selected) : undefined,
      server: options.server ? pickObject(options.server, selected) : undefined,
      client: options.client ? pickObject(options.client, selected) : undefined,
      extends: options.extends
        ? pickExtends(options.extends, selected)
        : undefined,
    };
    return createEnvironment(filteredOptions as never);
  }
  return createDefinedEnvironment;
}
