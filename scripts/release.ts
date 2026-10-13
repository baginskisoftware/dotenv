import "bun";
import { resolve } from "node:path";
import { cwd } from "node:process";

// general purpouse
type BuildFormat = {
  enabled: boolean;
  directory: string;
  extension: string;
};

type BuildEntry = {
  entrypoint: string;
  default: boolean;
  name: string;
};

type BuildConfig = {
  outdir: string;
  rootdir: string;
  target: Bun.BuildConfig["target"];
  minify: boolean;
  sourcemap: Bun.BuildConfig["sourcemap"];
  splitting: boolean;
  packages: Bun.BuildConfig["packages"];
  clean: boolean;
  formats: {
    esm: BuildFormat;
    cjs: BuildFormat;
  };
  entries: BuildEntry[];
  declarations: {
    enabled: boolean;
    tsconfig: string;
    directory: string;
    extension: string;
  };
};

type PackageJSON = {
  exports?: Record<string, unknown>;
  [key: string]: unknown;
};

// constants
const ROOT_DIR: string = cwd();
const config: BuildConfig = (await Bun.file(
  resolve(ROOT_DIR, "scripts/bunpack.json"),
).json()) as BuildConfig;

const SOURCE_DIR: string = resolve(ROOT_DIR, config.rootdir);

const isProduction: boolean = Bun.env.NODE_ENV === "production";
const minify: boolean = isProduction ? true : config.minify;

// helpers
async function generateExports(): Promise<void> {
  const packageJsonFile = Bun.file(resolve(ROOT_DIR, "package.json"));
  const packageJson = (await packageJsonFile.json()) as PackageJSON;
  const exports: Record<string, unknown> = {};

  for (const entry of config.entries) {
    const exportName: string = entry.default ? "." : `./${entry.name}`;
    exports[exportName] = {
      types:
        `./${config.outdir}/${config.declarations.directory}` +
        `/${entry.entrypoint.replace(".ts", "")}${config.declarations.extension}`,
      import:
        `./${config.outdir}/${config.formats.esm.directory}` +
        `/${entry.name}${config.formats.esm.extension}`,
      require:
        `./${config.outdir}/${config.formats.cjs.directory}` +
        `/${entry.name}${config.formats.cjs.extension}`,
    };

    packageJson.exports = exports;
    await Bun.write(
      packageJsonFile,
      `${JSON.stringify(packageJson, null, 2)}\n`,
    );
  }
}

// build setup
if (config.clean) {
  await Bun.$`rm -rf ${resolve(ROOT_DIR, config.outdir)}`;
}

const builds: Promise<Bun.BuildOutput>[] = [];
for (const entry of config.entries) {
  // ecmascript module
  if (config.formats.esm.enabled) {
    builds.push(
      Bun.build({
        entrypoints: [resolve(SOURCE_DIR, entry.entrypoint)],
        outdir: resolve(
          ROOT_DIR,
          `${config.outdir}/${config.formats.esm.directory}`,
        ),
        naming: `${entry.name}${config.formats.esm.extension}`,
        format: "esm",
        target: config.target,
        minify,
        sourcemap: config.sourcemap,
        splitting: config.splitting,
        packages: config.packages,
      }),
    );
  }

  // commonjs
  if (config.formats.cjs.enabled) {
    builds.push(
      Bun.build({
        entrypoints: [resolve(SOURCE_DIR, entry.entrypoint)],
        outdir: resolve(
          ROOT_DIR,
          `${config.outdir}/${config.formats.cjs.directory}`,
        ),
        naming: `${entry.name}${config.formats.cjs.extension}`,
        format: "cjs",
        target: config.target,
        minify,
        sourcemap: config.sourcemap,
        splitting: config.splitting,
        packages: config.packages,
      }),
    );
  }
}

// build process
const results = await Promise.all(builds);
const failed: boolean = results.some((result) => !result.success);

if (failed) {
  console.error("Build failed.");
  process.exit(1);
}

if (config.declarations.enabled) {
  const result = await Bun.$`tsc -p ${resolve(
    ROOT_DIR,
    config.declarations.tsconfig,
  )}`.quiet();

  if (result.exitCode !== 0) {
    console.error(result.stderr.toString());
    process.exit(result.exitCode);
  }
}

await generateExports();
console.log(`Build completed${isProduction ? " (production)" : ""}.`);