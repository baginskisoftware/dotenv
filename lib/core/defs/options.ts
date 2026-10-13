import type {
  Dictionary,
  EnvValue,
  ExtendsFormat,
  Impossible,
  ObjectSchema,
  PrefixFormat,
  Reduce,
  Simplify,
} from "@core/defs/common";
import type { InferOutput } from "@core/defs/dictionary";
import type {
  MergeSchemas,
  ResolveExtend,
  RuntimeEnvStrictKeys,
} from "@core/defs/runtime";
import type { ClientSchema, ServerSchema } from "@core/defs/schema";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Custom schema construction options.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 * @template FinalSchema Final environment schema.
 */
interface CreateSchemaOptions<
  Shared extends Dictionary,
  Server extends Dictionary,
  Client extends Dictionary,
  FinalSchema extends ObjectSchema,
> {
  // creates the final schema from the combined environment schemas
  createFinalSchema?: (
    shape: MergeSchemas<Shared, Server, Client>,
    isServer: boolean,
  ) => FinalSchema;
}

/**
 * Shared environment configuration options.
 * @template Shared Shared environment schema.
 * @template Extends Environment extensions.
 */
interface BaseOptions<
  Shared extends Dictionary,
  Extends extends ExtendsFormat,
> {
  // handles validation failures
  onValidationError?: (issues: Readonly<StandardSchemaV1.Issue[]>) => never;
  // handles access to unavailable environment variable
  onInvalidAccess?: (variable: string) => never;

  emptyStringAsUndefined?: boolean; // converts emprty strings into "undefined"
  skipValidation?: boolean; // disables runtime validation
  extends?: Extends; // additional environment objects
  shared?: Shared; // shared environment variables

  isServer?: boolean; // overrides automatic server detection
}

/**
 * Runtime validation using a unrestricted environment object.
 * @template Shared Shared environment schema.
 * @template Extends Environment extensions.
 */
interface LooseOptions<Shared extends Dictionary, Extends extends ExtendsFormat>
  extends BaseOptions<Shared, Extends> {
  runtimeEnv: Record<string, EnvValue>; // runtime environment object
}

/**
 * Runtime validation requiring all declared variables.
 * @template Prefix Configured client variable prefix.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 * @template Extends Environment extensions.
 */
interface StrictOptions<
  Prefix extends PrefixFormat,
  Shared extends Dictionary,
  Server extends Dictionary,
  Client extends Dictionary,
  Extends extends ExtendsFormat,
> extends BaseOptions<Shared, Extends> {
  runtimeEnvStrict?: Record<
    RuntimeEnvStrictKeys<Prefix, Shared, Server, Client>,
    EnvValue
  >;
}

/**
 * Client environment configuration.
 * @template Prefix Configured client variable prefix.
 * @template Client Client environment schema.
 */
interface ClientOptions<
  Prefix extends PrefixFormat,
  Client extends Dictionary,
> {
  clientPrefix: Prefix; // prefix that identifies clien-side env variables
  client: ClientSchema<Prefix, Client>; // client-side env schema
}

/**
 * Server environment configuration.
 * @template Prefix Configured client variable prefix.
 * @template Client Client environment schema.
 */
interface ServerOptions<
  Prefix extends PrefixFormat,
  Server extends Dictionary,
> {
  // server-side environment schema
  server:
    | ServerSchema<Prefix, Server>
    | StandardSchemaV1<object, InferOutput<Server>>;
}

/**
 * Valid combination of server and client schema options.
 * @template Prefix Configured client variable prefix.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 */
type ServerClientOptions<
  Prefix extends PrefixFormat,
  Server extends Dictionary,
  Client extends Dictionary,
> =
  | (ServerOptions<Prefix, Server> & ClientOptions<Prefix, Client>)
  | (ServerOptions<Prefix, Server> & Impossible<ClientOptions<Prefix, Client>>)
  | (Impossible<ServerOptions<Prefix, Server>> & ClientOptions<Prefix, Client>);

/**
 * Complete configuration for environment creation.
 * @template Prefix Configured client variable prefix.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 * @template Extends Environment extensions.
 * @template FinalSchema Final environment schema.
 */
export type EnvOptions<
  Prefix extends PrefixFormat,
  Shared extends Dictionary,
  Server extends Dictionary,
  Client extends Dictionary,
  Extends extends ExtendsFormat,
  FinalSchema extends ObjectSchema,
> = (
  | (LooseOptions<Shared, Extends> &
      ServerClientOptions<Prefix, Server, Client>)
  | (StrictOptions<Prefix, Shared, Server, Client, Extends> &
      ServerClientOptions<Prefix, Server, Client>)
) &
  CreateSchemaOptions<Shared, Server, Client, FinalSchema>;

/**
 * Complete configuration for environment creation with contextual typing for
 * the server schema.
 * @template Prefix Configured client variable prefix.
 * @template Shared Shared environment schema.
 * @template Server Server environment schema.
 * @template Client Client environment schema.
 * @template Extends Environment extensions.
 * @template FinalSchema Final environment schema.
 */
export type EnvOptionsWithServer<
  Prefix extends PrefixFormat = undefined,
  Shared extends Dictionary = Dictionary,
  Server extends Dictionary = Dictionary,
  Client extends Dictionary = Dictionary,
  Extends extends ExtendsFormat = [],
  FinalSchema extends ObjectSchema = ObjectSchema,
> = EnvOptions<Prefix, Shared, Client, Server, Extends, FinalSchema>;

/**
 * Final environment object returned by "createEnv".
 * @template FinalSchema Final environment schema.
 * @template Extends Environment extensions.
 */
export type CreateEnv<
  FinalSchema extends ObjectSchema,
  Extends extends ExtendsFormat,
> = Readonly<
  Simplify<
    Reduce<
      [
        StandardSchemaV1.InferOutput<FinalSchema>,
        ...Extract<
          {
            [Key in keyof Extends]: ResolveExtend<Extends[Key]>;
          },
          Readonly<ExtendsFormat>
        >,
      ]
    >
  >
>;
