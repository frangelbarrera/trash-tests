# Benchmarks

Benchmark harness for Trash Tests.

## Scripts

- `pnpm calibrate` — runs the calibration script, reports Pearson correlation.
- `pnpm check-stability` — diffs current scores against the last stability snapshot.

## Results

Historical benchmark runs are stored as CI artifacts in `results/`.

## Adding a benchmark

1. Add a fixture to `../fixtures/` (good, decorative, or edge category).
2. Add a golden score entry to `../fixtures/golden/<category>.scores.json`.
3. Run `pnpm calibrate` to verify the score matches expectations.
4. Run `pnpm check-stability` to update the stability snapshot (CI will fail until done).
