// general purpouse
export type EnvCollection = Record<string, string>;
export type EnvRecord = Readonly<EnvCollection>;
export type EnvFile =
  | ".env"
  | ".env.local"
  | ".env.dev"
  | ".env.development"
  | ".env.prod"
  | ".env.production"
  | ".env.staging";

// configuration options for env file loading
export type LoadOptions = Readonly<{
  // controls how environment files are parsed
  //
  // - eager: performs slicing during the parsing process. This can be useful
  //          is specific cases, but generally requires more allocations and
  //          processing than "lazy".
  //
  // - lazy:  parses the file without eagerly creating intermediate slices and
  //          performs the required slicing only when the final values is
  //          materialized. This is the recommended mode and is particulary
  //          benefical for applications where cold-start performance is important.
  optimizationMode?: "lazy" | "eager";

  populateProcessEnv?: boolean; // populates runtime env with variables
  ignoreCache?: boolean; // bypasses the internal env file cache
  ignoreBun?: boolean; // ignores bun-specific env handling
  dir?: string; // base directory used to solve env file paths
}>;
