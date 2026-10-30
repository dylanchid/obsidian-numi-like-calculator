import { App, Plugin, PluginSettingTab, Setting, Notice, Editor, MarkdownPostProcessorContext, TextComponent, ToggleComponent, DropdownComponent, ButtonComponent } from 'obsidian';
import { create, all, MathJsInstance } from 'mathjs';

// Settings interface and defaults
interface NumiLikeSettings {
  decimalPlaces: number; // number of digits after decimal
  thousandsSeparators: boolean; // format output with , separators
  outputFormat: 'result' | 'expr=result'; // how to render results
  errorStyle: boolean; // prefix with "Error:" and color in code blocks
}

const DEFAULT_SETTINGS: NumiLikeSettings = {
  decimalPlaces: 2,
  thousandsSeparators: true,
  outputFormat: 'expr=result',
  errorStyle: true,
};

type EvalResult = {
  expr: string;
  result?: string;
  error?: string;
};

export default class NumiLikePlugin extends Plugin {
  private math!: MathJsInstance;
  public settings: NumiLikeSettings = DEFAULT_SETTINGS;
  // Persistent session scope for selection evaluations (resets on app reload or via command)
  private sessionScope: Record<string, unknown> = {};

  async onload() {
    // Initialize mathjs instance
    this.math = create(all, {
      number: 'number',
      precision: 64,
    });

    await this.loadSettings();
    this.addSettingTab(new NumiLikeSettingTab(this.app, this));

    // Code block: ```numi
  this.registerMarkdownCodeBlockProcessor('numi', async (source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) => {
      const results = this.evaluateBlock(source);

      // Render with styling and settings
      const pre = el.createEl('pre');
      const code = pre.createEl('code');
    for (const r of results) {
        const lineEl = code.createEl('div');
        if (r.error) {
      const text = this.formatOutput(r.expr, `Error: ${r.error}`);
          lineEl.setText(text);
          if (this.settings.errorStyle) {
            lineEl.style.color = 'var(--text-error, #ff4d4f)';
          }
        } else {
      lineEl.setText(this.formatOutput(r.expr, r.result ?? ''));
        }
      }
    });

    // Command: evaluate current selection and replace it with result
    this.addCommand({
      id: 'evaluate-selection',
      name: 'Evaluate selection (Numi-like)',
  editorCallback: (editor: Editor) => {
        const sel = editor.getSelection();
        if (!sel || !sel.trim()) return;

        const r = this.evaluateLine(sel, this.sessionScope);
        const output = r.error
          ? (this.settings.errorStyle ? `Error: ${r.error}` : r.error)
          : this.formatOutput(r.expr, r.result ?? '');
        editor.replaceSelection(output);
      },
    });

    // Command: reset session scope
    this.addCommand({
      id: 'reset-session-scope',
      name: 'Reset Numi-like session scope',
      callback: () => {
        this.sessionScope = {};
        new Notice('Numi-like session scope reset');
      },
    });
  }

  onunload() {}

  // Settings persistence
  private async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Evaluate a code block with its own per-block scope
  private evaluateBlock(source: string): EvalResult[] {
    const scope: Record<string, unknown> = {};
    const lines = source.split(/\r?\n/);

    const results: EvalResult[] = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (line.length === 0 || line.startsWith('//')) continue;
      const r = this.evaluateLine(line, scope);
      results.push(r);
    }
    return results;
  }

  // Evaluate a single expression with the provided scope
  private evaluateLine(expr: string, scope?: Record<string, unknown>): EvalResult {
    try {
      const normalized = this.preprocess(expr);
      const value = this.math.evaluate(normalized, scope ?? {});
      const formatted = this.formatValue(value);
      return { expr, result: formatted };
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? String(e);
      return { expr, error: msg };
    }
  }

  // Preprocess user-friendly syntax to mathjs-friendly expressions
  private preprocess(input: string): string {
    let s = input;

    // Normalize unicode operators × ÷
    s = s.replace(/\u00d7/g, '*').replace(/\u00f7/g, '/');

    // Remove thousands separators in inputs: 1,234.56 -> 1234.56
    s = s.replace(/(?<=\d),(?=\d)/g, '');

  // Support "X% of Y" => (X / 100) * Y
    s = s.replace(/(\d+(?:\.\d+)?)\s*%\s+of\s+/gi, '($1 / 100) * ');
  // Convert standalone percentages like "8%" => (8 / 100)
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1 / 100)');

    // Strip simple currency symbols ($ € £ ¥)
    s = s.replace(/[$\u20ac\u00a3\u00a5]/g, '');

    // mathjs exposes "minutes" as a function, so normalize common plural unit targets.
    s = s.replace(/\bto\s+(seconds|minutes|hours|days)\b/gi, (_match, unit: string) =>
      `to ${unit.slice(0, -1).toLowerCase()}`);
    s = s.replace(/(\d+(?:\.\d+)?)\s+min\b/gi, '$1 minute');

    return s;
  }

  // Format a value from mathjs according to settings (decimals, separators)
  private formatValue(value: unknown): string {
    // Units: preserve unit string but format numeric part
    const v: any = value as any;
    if (v && typeof v === 'object' && 'isUnit' in v) {
      const unitStr = v.toString(); // e.g., "150 min" or "2.11811023622 inch"
      const m = unitStr.match(/^\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*(.*)$/i);
      if (!m) return unitStr;
      const num = Number(m[1]);
      const unit = m[2] ?? '';
      let numStr = isFinite(num)
        ? num.toFixed(Math.max(0, Math.floor(this.settings.decimalPlaces)))
        : m[1];
      if (this.settings.thousandsSeparators) {
        numStr = this.addThousandsSeparators(numStr);
      }
      return unit.trim().length > 0 ? `${numStr} ${unit}` : numStr;
    }

    // Non-units: use mathjs.format and then optionally add separators
    let out: string;
    try {
      out = this.math.format(v, {
        notation: 'fixed',
        precision: Math.max(0, Math.floor(this.settings.decimalPlaces)),
      } as any);
    } catch {
      out = String(v);
    }
    if (this.settings.thousandsSeparators) out = this.addThousandsSeparators(out);
    return out;
  }

  // Insert thousands separators into all standalone number tokens within a string
  private addThousandsSeparators(s: string): string {
    return s.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi, (num) => {
      // Keep scientific notation segments intact
      const match = /^(-?)(\d+)(?:\.(\d+))?(e[+-]?\d+)?$/i.exec(num);
      if (!match) return num;
      const sign = match[1] ?? '';
      const intPart = match[2] ?? '';
      const frac = match[3] ? `.${match[3]}` : '';
      const exp = match[4] ?? '';
      const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${sign}${withSep}${frac}${exp}`;
    });
  }

  // Format a full line according to outputFormat setting
  private formatOutput(expr: string, result: string): string {
    if (this.settings.outputFormat === 'result') {
      return result;
    }
    // Default: expr = result
    return `${expr} = ${result}`;
  }
}

class NumiLikeSettingTab extends PluginSettingTab {
  plugin: NumiLikePlugin;

  constructor(app: App, plugin: NumiLikePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();


    new Setting(containerEl)
      .setName('Decimal places')
      .setDesc('Number of digits after the decimal point when formatting results')
  .addText((text: TextComponent) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '0';
        text.setValue(String(this.plugin.settings.decimalPlaces));
  text.onChange(async (v: string) => {
          const n = Number(v);
          this.plugin.settings.decimalPlaces = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Thousands separators')
      .setDesc('Format output numbers with commas as thousands separators')
  .addToggle((tg: ToggleComponent) => {
        tg.setValue(this.plugin.settings.thousandsSeparators)
          .onChange(async (val: boolean) => {
            this.plugin.settings.thousandsSeparators = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Output format')
      .setDesc('Choose whether to show only the result or "expr = result"')
  .addDropdown((dd: DropdownComponent) => {
        dd.addOption('result', 'Result only');
        dd.addOption('expr=result', 'Expression = result');
        dd.setValue(this.plugin.settings.outputFormat)
          .onChange(async (val: string) => {
            if (val !== 'result' && val !== 'expr=result') return;
            this.plugin.settings.outputFormat = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Error display style')
      .setDesc('If enabled, errors are prefixed with "Error:" and shown in red in rendered code blocks')
    .addToggle((tg: ToggleComponent) => {
        tg.setValue(this.plugin.settings.errorStyle)
      .onChange(async (val: boolean) => {
            this.plugin.settings.errorStyle = val;
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl('hr');
    new Setting(containerEl)
      .setName('Reset session scope')
      .setDesc('Clears all variables defined via the selection evaluation command')
  .addButton((btn: ButtonComponent) => {
        btn.setButtonText('Reset')
          .onClick(() => {
            (this.plugin as any).sessionScope = {};
            new Notice('Numi-like session scope reset');
          });
      });
  }
}
