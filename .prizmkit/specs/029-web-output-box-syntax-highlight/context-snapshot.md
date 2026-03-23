# Context Snapshot — F-029: Web Output Box Syntax Highlight

## Section 1 — Feature Brief

**Description**: 为 Web 管理台 stdout/stderr 输出框（.output-box）添加基础语法高亮样式。在 public/styles.css 中为 .output-box 内的关键输出模式（错误行、路径、数字）添加颜色区分，提升命令输出的可读性。无后端变更。

**Acceptance Criteria**:
- Given 命令执行完成，When stdout 输出显示在 .output-box，Then 普通文本以默认文字色显示
- Given stderr 有输出，When stderrOutput 框有内容，Then 框体以红色调边框或背景区分
- Given exit code 非零，When exitCodeOutput 显示值，Then 以警告或危险色高亮显示

## Section 2 — Project Structure

public/styles.css — 329 lines, all CSS for web panel
public/js/main.js — 447 lines, frontend JS
public/index.html — contains .output-box elements:
  - #screenshotMeta.output-box (line 56)
  - #exitCodeOutput.output-box (line 70) — shows exit code, default "-"
  - #stdoutOutput.output-box (line 74) — shows stdout
  - #stderrOutput.output-box (line 78) — shows stderr

## Section 3 — Prizm Context

RULES relevant to this feature:
- .status modifier classes pattern: base keeps layout, modifiers override border/background/color
- Error palette: #fef3f2 bg, #f9d3d0 border, var(--danger) color — reused from .message.error
- --warning: #d97706, --danger: #b42318

## Section 4 — Existing Source Files

### public/styles.css (329 lines) — existing .output-box rule (lines 272-282):
```css
.output-box {
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px;
  min-height: 44px;
  background: #fff;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}
```

### public/js/main.js — exec result rendering (lines 430-437):
```js
els.exitCodeOutput.textContent = String(data.exitCode);
els.stdoutOutput.textContent = data.stdout || '(empty)';
els.stderrOutput.textContent = data.stderr || '(empty)';
// error path:
els.exitCodeOutput.textContent = 'error';
els.stdoutOutput.textContent = '';
els.stderrOutput.textContent = message;
```

JS also sets exitCode values: data.exitCode (number) or 'error' (string on fetch error).

## Section 5 — Existing Tests

No tests relevant to CSS-only change. Test command: `node --test tests/**/*.test.js`

## Implementation Log
Files changed/created:
- public/styles.css — added .output-box.error (danger/red palette) and .output-box.exit-error (warning/amber palette) modifier classes
- public/js/main.js — added class reset before each exec run; apply .exit-error on exitCode !== 0; toggle .error on stderrOutput when stderr non-empty

Key decisions:
- .output-box.error reuses existing error palette (#fef3f2/#f9d3d0/--danger) consistent with .message.error and .status.error
- .output-box.exit-error uses amber warning palette (#fffbf0 bg, #fde8bb border, --warning color)
- classList.remove() at exec start ensures clean state on repeated runs
- classList.toggle(class, bool) used in success path; classList.add() in catch path (always error state)
