# Numi-like Calculator (Unofficial)

The TypeScript source is in `src/`. Run `npm ci && npm run build` to generate `main.js`. The build bundles mathjs but does not embed a source map or local filesystem paths.

Evaluate Numi-style expressions in Markdown code blocks.

- `numi` code blocks are evaluated line-by-line with variables that persist within the block.
- Command “Evaluate selection (Numi-like)” evaluates the selection using a persistent session scope.
- Command “Reset Numi-like session scope” clears variables set via the selection command.

This plugin is unofficial and not affiliated with Numi. The plugin is “Numi‑like.”

Attribution and licenses:
- Numi project: https://github.com/nikolaeu/numi (MIT). If any code is copied or adapted from Numi, you must preserve their MIT license and attribution. Include their license header and a clear NOTICE in this repository. Avoid implying official affiliation.
- This plugin uses mathjs (Apache-2.0). See NOTICE for third‑party license details.

## Features

- Variables and assignment inside a block (later lines can use earlier definitions)
- Session scope for the selection command (persists until Obsidian reloads or you reset it)
- Friendly input handling:
   - Unicode operators × ÷
   - Thousands separators in inputs (1,234.56 → 1234.56)
   - “X% of Y” phrasing and standalone percentages like `8%`
   - Strips currency symbols ($ € £ ¥) before math
- Units via mathjs; unit conversions with `to` are preserved

## Settings

Settings → Community Plugins → Numi-like Calculator:

- Decimal places: integer, default 2
- Thousands separators: on/off, default on
- Output format: “Result only” or “expr = result”
- Error display style: prefix with “Error:” and show in red in rendered code blocks

## Examples

```numi
tax = 8%
total = 200
tax * total
50% of 200
2 inch + 3 cm
(2 hour + 30 min) to minutes
```

Renders as (with Output format = “expr = result”):

```
tax = 8% = 0.08
total = 200 = 200.00
tax * total = 16.00
50% of 200 = 100.00
2 inch + 3 cm = 2.12 inch
(2 hour + 30 min) to minutes = 150.00 min
```

Selection command session example:

1) Select: `x = 5` → evaluates and sets session var `x`
2) Select: `x * 3` → `15`
3) Run the command “Reset Numi-like session scope”
4) Select: `x * 3` → `Error: ...` (since session is cleared)

## Install (development)

1. Create a folder in your vault: `.obsidian/plugins/numi-like-calculator`.
2. Put these files there.
3. Run:
    ```bash
    npm install
    npm run dev
    ```
4. In Obsidian, enable the plugin (Settings → Community Plugins → toggle it on).
5. Reload the file or reopen the note to see rendered results.

For production:
```bash
npm run build
```

## MIT License

This plugin's code is MIT-licensed (see LICENSE). If you incorporate code from other MIT-licensed sources, include their license and attribution as required.
