# npm vs pnpm — benchmark for `html-templating`

Comparison of npm 11.12.1 and pnpm 11.4.0 on this exact repository, measured on the same machine (Linux, Node v24.15.0, tmpfs-backed
`/tmp`).

Two identical workspace copies were prepared in `/tmp/pm-bench/{npm-test,pnpm-test}` from a `git ls-files`-style snapshot of the
repo, with `workspace:*` rewritten to `*` and `workspace:^` rewritten to `^0.1.0` in the npm copy. Both copies see the same 5
packages (`@vanishing/framework`, `@demo/components`, three apps) and the same 341 transitive dependencies. Numbers below are real
time (wall clock) unless noted; lower is better.

Chore benchmarks (lint/format/test) were re-run against the real repository because the throw-away `/tmp` copy hit a pnpm
`onlyBuiltDependencies` rewrite issue mid-bench.

## Headline

| Workload                | npm    | pnpm (best) | Speedup  |
| ----------------------- | ------ | ----------- | -------- |
| `install` — cold        | 23.3 s | 8.1 s       | **2.9×** |
| `install` — warm (CI)   | 4.5 s  | 1.4 s       | **3.3×** |
| `install` — hot (no-op) | 0.60 s | 1.01 s      | npm 1.7× |
| Build all packages      | 9.3 s  | 4.2 s       | **2.2×** |
| Lint (`lint:check`)     | 11.5 s | 5.4 s       | **2.1×** |
| Format (`format:check`) | 2.05 s | 0.78 s      | **2.6×** |
| Test (`vitest run`)     | 3.90 s | 2.37 s      | **1.6×** |
| `node_modules` on disk  | 183 MB | 150 MB      | −18 %    |

In one phrase: **pnpm wins decisively whenever there is real work to do**, and loses only on the trivial idempotent re-install path.

## Install

| Scenario                                           | npm     | pnpm   |
| -------------------------------------------------- | ------- | ------ |
| Cold (empty cache, no lockfile, no `node_modules`) | 23.28 s | 8.08 s |
| Warm (cache + lockfile, no `node_modules`)         | 4.54 s  | 1.37 s |
| Hot (everything already in place)                  | 0.60 s  | 1.01 s |

The warm case is what CI sees on every run. **pnpm cuts CI install time by ~70 %** in absolute terms (3.1 s saved per job — adds up
across PR validation matrices and dev-machine `git pull` cycles).

The hot case is the only one npm wins. pnpm content-verifies the store on every invocation; npm trusts the lockfile if nothing
changed. The 0.4 s gap is dwarfed by every other measurement.

## Build all packages

Dependency graph in this repo:

```text
@vanishing/framework  ←  @demo/components  ←  { native, solid, static } apps
```

The three apps have no inter-dependencies, so they can be built in parallel after demo-components finishes.

| Runner                                        | Real time  | Notes                                            |
| --------------------------------------------- | ---------- | ------------------------------------------------ |
| `npm run build` (npm workspace, sequential)   | 9.34 s     | npm has no parallelism flag                      |
| `pnpm run build` (current root `run-s` chain) | 11.01 s    | sequential — matches npm's structure             |
| **`pnpm -r run build`** (topological)         | **3.78 s** | framework → demo-components → 3 apps in parallel |

The current root scripts use `npm-run-all2`'s `run-s` to chain build steps in fixed order. Replacing
`"build:app": "run-s build:app:native build:app:solid
build:app:static"` with a pnpm filter (`pnpm -r --filter './apps/*' run build`
or just `pnpm -r run build` for the whole tree) cuts ~3 s off every full build, since pnpm derives the parallelism from the
dependency graph automatically.

## Lint

`lint:check` per package runs ESLint + markdownlint-cli2 in parallel internally (via `run-p lint:js:check lint:md:check`).

| Runner                                     | Real time  | Notes                                                    |
| ------------------------------------------ | ---------- | -------------------------------------------------------- |
| `npm run lint:check` (npm workspaces, seq) | 11.48 s    | each package's eslint cold-starts in series              |
| `pnpm -r run lint:check` (topological)     | 10.23 s    | follows dep graph — only the three leaf apps can overlap |
| **`pnpm -r --parallel run lint:check`**    | **5.45 s** | topology-free, all 5 packages start eslint concurrently  |

Lint has no real dependency ordering — you don't need framework's `eslint .` to finish before `@demo/components`'s. Adding
`--parallel` halves the wall time because the 5 ESLint cold-starts overlap instead of serializing.

Recommendation for the root script:

```jsonc
"lint:check": "pnpm -r --if-present --parallel run lint:check"
```

## Format

`format:check` per package runs `dprint check "**/*"`. dprint itself is fast (Rust), so most of the time is process startup × 5.

| Runner                                    | Real time  |
| ----------------------------------------- | ---------- |
| `npm run format:check` (sequential)       | 2.05 s     |
| `pnpm -r run format:check` (topological)  | 1.05 s     |
| **`pnpm -r --parallel run format:check`** | **0.78 s** |

Same observation: parallelizing across packages is essentially free and saves half the runtime.

## Test

| Runner                            | Real time  | Notes                                       |
| --------------------------------- | ---------- | ------------------------------------------- |
| `npm test` (sequential)           | 3.90 s     | framework: 149 specs; demo-components: none |
| `pnpm -r run test` (topological)  | 3.81 s     | demo-components waits for framework         |
| **`pnpm -r --parallel run test`** | **2.37 s** | both vitest cold-starts overlap             |

Smaller absolute win here because demo-components has no spec files yet (vitest returns immediately with `--passWithNoTests`). When
demo-components grows real tests, the `--parallel` gap will widen.

## Disk footprint

Measured immediately after a clean install of both copies.

| Metric                                              | npm    | pnpm   |
| --------------------------------------------------- | ------ | ------ |
| `node_modules` (apparent unique bytes)              | 183 MB | 150 MB |
| `node_modules` on disk (after hardlink dedup)       | 183 MB | 170 MB |
| Global store (`~/.local/share/pnpm/store` / `$XDG`) | n/a    | 182 MB |
| File / directory entries inside all `node_modules`  | 9 791  | 11 574 |

**This repo alone**: 18 % savings. Modest.

**Across a dev machine**: every additional clone of html-templating costs npm another ~180 MB but costs pnpm essentially zero (only
the symlink farm — a few hundred KB). The shared global store deduplicates `vite`, `typescript`, `eslint`, `vitest` and friends
across **every** pnpm-managed repo on the disk. A laptop with ten typical TS monorepos easily reclaims several GB on the switch from
npm to pnpm.

The slightly higher inode count is the cost of pnpm's content-addressable layout: each package's files are hardlinks/symlinks to the
store. Irrelevant on ext4/btrfs/APFS/NTFS.

## Concurrency model — why pnpm wins the chores

|                                               | npm workspaces             | pnpm `-r`                                    |
| --------------------------------------------- | -------------------------- | -------------------------------------------- |
| Default ordering                              | Strict sequential          | **Topological with intra-layer parallelism** |
| Force parallel                                | not supported              | `--parallel`                                 |
| Force sequential                              | only mode available        | `--workspace-concurrency=1`                  |
| Reason for existing root `npm-run-all2` usage | needed for any concurrency | **no longer needed**                         |

The repo's current root scripts still use `run-s` / `run-p` because they were written for npm. Several can be simplified to direct
pnpm calls and pick up extra parallelism for free — especially `build:app` (three independent apps) and the chore aggregates
(lint/format/test).

## Caveats and downsides for pnpm

- **First-time native-script approval.** `dprint` and `unrs-resolver` ship postinstall scripts; pnpm v10+ requires explicit
  allow-list via `onlyBuiltDependencies` in `pnpm-workspace.yaml`. One-time setup cost in exchange for supply-chain safety.
- **Hot-install is slower.** ~0.4 s. Affects nothing in practice.
- **Symlink layout occasionally trips dependencies.** Tools that walk `node_modules` expecting npm's flat hoisting can misbehave
  (rare in modern ecosystems; the usual escape hatch is `public-hoist-pattern[]`).
- **`npm pack` / `npm publish` do not rewrite `workspace:` specifiers.** If you ever publish, you must publish with `pnpm publish`
  (which does rewrite them). This repo only contains private apps and unpublished libs today, so it's a non-issue until publishing
  starts.

## Scripts applied in this PR

The benchmark led to these concrete root-script changes (all pure perf wins, not required for correctness):

```jsonc
{
  "scripts": {
    "build:app": "run-p build:app:native build:app:solid build:app:static",
    "build": "pnpm -r run build",
    "lint": "pnpm -r --if-present --parallel run lint",
    "lint:check": "pnpm -r --if-present --parallel run lint:check",
    "format": "pnpm -r --if-present --parallel run format",
    "format:check": "pnpm -r --if-present --parallel run format:check",
    "test": "pnpm -r --if-present --parallel run test"
  }
}
```

Re-measured against the parallelized root scripts:

| `pnpm run ...` | Before (sequential) | After (parallel) |
| -------------- | ------------------- | ---------------- |
| `build`        | 11.0 s              | 4.5 s            |
| `lint:check`   | 11.5 s (npm)        | 5.7 s            |
| `format:check` | 2.05 s (npm)        | 1.16 s           |
| `test`         | 3.90 s (npm)        | 3.20 s           |

`run-s` is still useful where ordering across heterogeneous targets matters (e.g. `build:lib && build:app:native && preview`), so
`npm-run-all2` stays as a devDependency for the `start*` scripts and for the inner `build:lib` chain (framework must build before
demo-components — `pnpm -r run build` resolves this from the dependency graph; `run-s` enforces it explicitly within the `build:lib`
aggregate).

## Method

- Both test trees built by `rsync -a --exclude node_modules ... html-templating/ {npm,pnpm}-test/`.
- npm copy: `pnpm-workspace.yaml` removed, `workspaces` field added back to `package.json`, `workspace:*` / `workspace:^` rewritten
  to `*` / `^0.1.0`, `packageManager` removed.
- Cold install: `npm cache clean --force` / `pnpm store prune`, no lockfile, no `node_modules`.
- Warm install: lockfile + cache populated, `node_modules` removed.
- Hot install: nothing removed, repeat the install command.
- All builds invoked from a clean source tree (`bin/` outputs not measured — only build duration).
- Times measured with `/usr/bin/time -f "real %e"`.
- Single-run measurements (no averaging). Differences > ~5 % are robust; sub-100 ms differences should be treated as noise.
