PRIZM_SPEC_VERSION: 2
PURPOSE: AI-only documentation framework for vibe coding projects
AUDIENCE: AI agents (not humans)
FORMAT: KEY: value pairs, ALL CAPS section headers, arrow pointers
FILE_EXT: .prizm
DOC_ROOT: .prizm-docs/
LICENSE: MIT

---

# SECTION 1: OVERVIEW

WHAT: Prizm is a self-maintaining documentation system where AI reads, generates, updates, and loads project context progressively.
WHY: Reduce AI hallucinations, minimize token waste, ensure AI has accurate project knowledge at all times.
HOW: Three-level progressive loading (L0 -> L1 -> L2) with auto-update before every commit.

CORE_PRINCIPLES:
- Token efficiency over human readability
- Progressive disclosure (load only what is needed)
- Self-updating (docs stay fresh via commit-time hooks)
- Universal (language and framework agnostic)
- Append-only history (decisions and changelog never lose information)
- Size-enforced (hard limits per level prevent bloat)
- Lazy L2 generation (detail docs created on first modification or deep read, not during init)
- Rules hierarchy (root.prizm RULES are authoritative, module RULES supplement only)

---

# SECTION 2: ARCHITECTURE

## 2.1 Progressive Loading Levels

LEVELS:
- L0: Root index. ALWAYS loaded at session start. Max 4KB.
  FILE: .prizm-docs/root.prizm
  CONTAINS: project meta, module index with pointers, build commands, tech stack, top rules

- L1: Module index. Loaded ON DEMAND when AI works in a module area. Max 3KB each.
  FILE: .prizm-docs/<mirrored-path>.prizm (mirrors source directory structure)
  CONTAINS: module responsibility, subdirs with pointers, key files, interfaces, dependencies, rules

- L2: Detail doc. Loaded when AI modifies files in that sub-module OR needs deep understanding. Max 5KB each.
  FILE: .prizm-docs/<mirrored-path>/<submodule>.prizm
  CONTAINS: full file inventory, domain-specific sections, decisions log, traps, rejected approaches

- Changelog: Append-only change log. Loaded at L0. No size limit but keep last 50 entries.
  FILE: .prizm-docs/changelog.prizm

## 2.2 Directory Layout

STRUCTURE: Mirrors source tree under .prizm-docs/

EXAMPLE (Go project):
  .prizm-docs/
    root.prizm                            # L0
    changelog.prizm                       # L0
    internal/
      logic.prizm                         # L1 for internal/logic/
      model.prizm                         # L1 for internal/model/
      repo.prizm                          # L1 for internal/repo/
      service.prizm                       # L1 for internal/service/
      common.prizm                        # L1 for internal/common/
      logic/
        statemachine.prizm                # L2 for internal/logic/statemachine/
        session.prizm                     # L2 for internal/logic/session/
        ivr.prizm                         # L2 for internal/logic/ivr/
      repo/
        rpc.prizm                         # L2 for internal/repo/rpc/
        store.prizm                       # L2 for internal/repo/store/
      service/
        http.prizm                        # L2 for internal/service/http/
        sso.prizm                         # L2 for internal/service/sso/

EXAMPLE (JS/TS project):
  .prizm-docs/
    root.prizm                            # L0
    changelog.prizm                       # L0
    src/
      components.prizm                    # L1 for src/components/
      hooks.prizm                         # L1 for src/hooks/
      services.prizm                      # L1 for src/services/
      components/
        auth.prizm                        # L2 for src/components/auth/
        dashboard.prizm                   # L2 for src/components/dashboard/

EXAMPLE (Python project):
  .prizm-docs/
    root.prizm                            # L0
    changelog.prizm                       # L0
    app/
      models.prizm                        # L1 for app/models/
      views.prizm                         # L1 for app/views/
      services.prizm                      # L1 for app/services/
      services/
        payment.prizm                     # L2 for app/services/payment/

## 2.3 Git Configuration

COMMIT: .prizm-docs/ MUST be committed to git alongside source code
RATIONALE: .prizm-docs/ is shared project knowledge that all team members (human and AI) benefit from.

---

# SECTION 3: DOCUMENT FORMAT SPECIFICATION

## 3.1 L0: root.prizm

TEMPLATE:

  PRIZM_VERSION: 2
  PROJECT: <name>
  LANG: <primary language>
  FRAMEWORK: <primary framework or "none">
  BUILD: <build command>
  TEST: <test command>
  ENTRY: <entry point file(s)>
  UPDATED: <YYYY-MM-DD>

  ARCHITECTURE: <layer1> -> <layer2> -> <layer3> -> ...
  LAYERS:
  - <layer-name>: <one-line description>

  TECH_STACK:
  - runtime: <list>
  - deps: <key external dependencies>
  - infra: <infrastructure: databases, queues, caches, etc.>

  MODULE_INDEX:
  - <source-path>: <file-count> files. <one-line description>. -> .prizm-docs/<mirrored-path>.prizm

  ENTRY_POINTS:
  - <name>: <file-path> (<protocol/port if applicable>)

  RULES:
  - MUST: <project-wide mandatory rule>
  - NEVER: <project-wide prohibition>
  - PREFER: <project-wide preference>

  PATTERNS:
  - <pattern-name>: <one-line description of code pattern used across project>

  DECISIONS:
  - [YYYY-MM-DD] <project-level architectural decision and rationale>
  - REJECTED: <rejected approach + why>

CONSTRAINTS:
- Max 4KB (roughly 100 lines)
- Every line must be a KEY: value pair or a list item
- MODULE_INDEX must have arrow pointer (->) for every entry
- RULES limited to 5-10 most critical conventions
- No prose paragraphs
- root.prizm RULES are AUTHORITATIVE: they override any conflicting L1/L2 RULES

## 3.2 L1: module.prizm

TEMPLATE:

  MODULE: <source-path>
  FILES: <count>
  RESPONSIBILITY: <one-line>
  UPDATED: <YYYY-MM-DD>

  SUBDIRS:
  - <name>/: <one-line description>. -> .prizm-docs/<child-path>.prizm

  KEY_FILES:
  - <filename>: <role/purpose>

  INTERFACES:
  - <function/method signature>: <what it does>

  DEPENDENCIES:
  - imports: <internal modules this module uses>
  - imported-by: <internal modules that depend on this>
  - external: <third-party packages used>

  RULES:
  - MUST: <module-specific mandatory rule>
  - NEVER: <module-specific prohibition>
  - PREFER: <module-specific preference>

  TRAPS:
  - <what looks safe but is dangerous> | FIX: <correct approach>

  DECISIONS:
  - <what was decided> — <rationale>

  DATA_FLOW:
  - <numbered step describing how data moves through this module>

CONSTRAINTS:
- Max 3KB
- INTERFACES lists only PUBLIC/EXPORTED signatures
- DEPENDENCIES has 3 sub-categories (imports, imported-by, external)
- SUBDIRS entries must have arrow pointer (->) if L2 doc exists
- KEY_FILES lists only the most important files (max 10-15)
- RULES may only SUPPLEMENT root.prizm RULES with module-specific exceptions, never contradict them

## 3.3 L2: detail.prizm

TEMPLATE:

  MODULE: <source-path>
  FILES: <comma-separated list of all files>
  RESPONSIBILITY: <one-line>
  UPDATED: <YYYY-MM-DD>

  <DOMAIN-SPECIFIC SECTIONS>
  (AI generates these based on what the module does. Examples below.)

  KEY_FILES:
  - <filename>: <detailed description, line count, complexity notes>

  DEPENDENCIES:
  - uses: <external lib>: <why/how used>
  - imports: <internal module>: <which interfaces consumed>

  DECISIONS:
  - [YYYY-MM-DD] <decision made within this module and rationale>
  - REJECTED: <approach that was tried/considered and abandoned + why>

  TRAPS:
  - <gotcha: something that looks correct but is wrong or dangerous>
  - <non-obvious coupling, race condition, or side effect>

  CHANGELOG:
  - YYYY-MM-DD | <verb>: <description of recent change to this module>

DOMAIN_SPECIFIC_SECTION_EXAMPLES:
- For state machines: STATES, TRIGGERS, TRANSITIONS
- For API handlers: ENDPOINTS, REQUEST_FORMAT, RESPONSE_FORMAT, ERROR_CODES
- For data stores: TABLES, QUERIES, INDEXES, CACHE_KEYS
- For config modules: CONFIG_KEYS, ENV_VARS, DEFAULTS
- For UI components: PROPS, EVENTS, SLOTS, STYLES

CONSTRAINTS:
- Max 5KB
- DOMAIN-SPECIFIC SECTIONS are flexible, not prescribed
- DECISIONS is append-only (never delete, archive if >20 entries)
- TRAPS section is CRITICAL for preventing AI from making known mistakes
- REJECTED entries prevent AI from re-proposing failed approaches
- FILES lists all files, not just key ones
- RULES may only SUPPLEMENT root.prizm RULES with module-specific exceptions, never contradict them

## 3.4 changelog.prizm

TEMPLATE:

  CHANGELOG:
  - YYYY-MM-DD | <module-path> | <verb>: <one-line description>

VERBS: add, update, fix, remove, refactor, rename, deprecate
RETENTION: Keep last 50 entries. Archive older entries to changelog-archive.prizm if needed.

EXAMPLE:
  CHANGELOG:
  - 2026-03-02 | internal/logic/timer | add: retry logic with exponential backoff
  - 2026-03-01 | internal/service/sso | update: create_robot handler validates chatbot config
  - 2026-02-28 | internal/model/chatbot | add: DeepSeek provider model definition
  - 2026-02-27 | internal/repo/rpc | fix: Hunyuan API timeout not respected

---

# SECTION 4: FORMAT CONVENTIONS

HEADERS: ALL CAPS followed by colon (MODULE:, FILES:, RESPONSIBILITY:, etc.)
VALUES: Single space after colon, value on same line (KEY: value)
LISTS: Dash-space prefix for items within a section (- item)
POINTERS: Arrow notation (->) to reference other .prizm files
DATES: [YYYY-MM-DD] in square brackets for timestamps
CHANGELOG_SEPARATOR: Pipe (|) between date, module, and description
NESTING: Indent 2 spaces for sub-keys within a section
COMMENTS: None. Every line carries information. No comments in .prizm files.

---

# SECTION 5: PATH MAPPING RULES

## 5.1 Mapping Algorithm

RULE: Mirror the source directory tree under .prizm-docs/
RULE: L1 file for directory D = .prizm-docs/<D>.prizm
RULE: L2 file for subdirectory D/S = .prizm-docs/<D>/<S>.prizm
RULE: Root index = .prizm-docs/root.prizm (always)
RULE: Changelog = .prizm-docs/changelog.prizm (always)

## 5.2 Examples

SOURCE_PATH                   L1_PRIZM_FILE                            L2_PRIZM_FILES
internal/logic/               .prizm-docs/internal/logic.prizm         .prizm-docs/internal/logic/*.prizm
internal/logic/session/       (described in L1 logic.prizm SUBDIRS)    .prizm-docs/internal/logic/session.prizm
internal/repo/store/          (described in L1 repo.prizm SUBDIRS)     .prizm-docs/internal/repo/store.prizm
src/components/               .prizm-docs/src/components.prizm         .prizm-docs/src/components/*.prizm
src/components/auth/          (described in L1 components.prizm)       .prizm-docs/src/components/auth.prizm
app/services/                 .prizm-docs/app/services.prizm           .prizm-docs/app/services/*.prizm

## 5.3 Discovery Rule

FOR any source file at path P:
  1. Walk up directory tree to find the first ancestor D where .prizm-docs/<D>.prizm exists
  2. That file is the L1 doc for this source file
  3. If P is inside a subdirectory S of D, check if .prizm-docs/<D>/<S>.prizm exists for L2
  4. If no .prizm doc found, the module is undocumented (may need prizmkit-prizm-docs Update operation)

---

# SECTION 6: PROGRESSIVE LOADING PROTOCOL

## 6.1 When to Load

ON_SESSION_START:
  ALWAYS: Read .prizm-docs/root.prizm (L0) if it exists
  PURPOSE: Get the project map, understand architecture, know where to look

ON_TASK_RECEIVED:
  IF task references specific file or directory:
    LOAD: L1 for the containing module
  IF task is broad (e.g., "refactor auth", "improve performance"):
    LOAD: L1 for all matching modules from MODULE_INDEX
  IF task is exploratory (e.g., "explain the codebase", "how does X work"):
    LOAD: L0 only, then navigate via pointers as needed
  IF task is cross-cutting (e.g., "add logging everywhere"):
    LOAD: L1 for affected modules, check DEPENDENCIES.imported-by

ON_FILE_MODIFICATION:
  BEFORE editing any source file:
    LOAD: L2 for the containing sub-module (if exists and not already loaded)
    READ: TRAPS section (prevent known mistakes)
    READ: DECISIONS section (understand prior choices)
    READ: REJECTED entries (avoid re-proposing failed approaches)

ON_DEEP_READ:
  WHEN AI needs deep understanding of a module WITHOUT modifying it:
    LOAD: L2 for the containing sub-module (if exists)
    IF L2 does not exist: GENERATE L2 from source code analysis, then load it
    USE_CASES: code review, architecture analysis, dependency tracing, explaining complex logic
    RATIONALE: Deep reads benefit from the same structured context as modifications

## 6.2 Loading Rules

NEVER: Load all L1 and L2 docs at session start (defeats progressive loading)
NEVER: Load L2 for modules not being modified or deeply analyzed (wastes context window)
NEVER: Skip L0 (it is the map for everything else)
PREFER: Load L1 before L2 (understand module context before diving into details)
PREFER: Load minimum docs needed for the task
BUDGET: Typical task should consume 3000-5000 tokens of prizm docs total

---

# SECTION 7: AUTO-UPDATE PROTOCOL

## 7.1 Trigger

WHEN: Before every commit (detected automatically via hook, or manually via prizmkit-prizm-docs Update operation)
GOAL: Keep prizm docs synchronized with source code

## 7.2 Update Decision Logic

ALGORITHM: prizm_update

1. GET_CHANGES:
   Run: git diff --cached --name-status
   If nothing staged: Run: git diff --name-status
   Result: List of (status, file_path) pairs

2. MAP_TO_MODULES:
   FOR EACH changed file:
     Find its module by matching against MODULE_INDEX in root.prizm
     Group changes by module

3. CLASSIFY_CHANGES:
   FOR EACH changed file:
     A (added): May need new entries in KEY_FILES, INTERFACES
     D (deleted): Remove from KEY_FILES, update FILES count
     M (modified): Check if public interfaces or dependencies changed
     R (renamed): Update all path references in affected docs

4. UPDATE_DOCS:
   FOR EACH affected module:
     a. IF L2 doc exists for this module:
        UPDATE: KEY_FILES (add/remove/modify)
        UPDATE: INTERFACES (if signatures changed)
        UPDATE: DEPENDENCIES (if imports changed)
        APPEND: CHANGELOG entry
        UPDATE: UPDATED timestamp
     b. IF L1 doc exists:
        UPDATE: FILES count
        UPDATE: KEY_FILES (if major files added/removed)
        UPDATE: INTERFACES (if public API changed)
        UPDATE: DEPENDENCIES (if module-level deps changed)
        UPDATE: UPDATED timestamp
     c. UPDATE root.prizm (L0):
        UPDATE: MODULE_INDEX file counts
        ONLY IF: module added, removed, or project-wide structural change
        UPDATE: UPDATED timestamp

5. SKIP_CONDITIONS:
   SKIP if: Only internal implementation changed (no interface/dependency change)
   SKIP if: Only comments, whitespace, or formatting changed
   SKIP if: Only test files changed (unless test patterns doc exists)
   SKIP if: Only .prizm files changed (avoid circular updates)

6. CREATE_NEW_DOCS:
   IF new directory with 3+ source files appears AND matches no existing module:
     CREATE: L1 doc immediately
     ADD: entry to MODULE_INDEX in root.prizm
     DEFER: L2 creation to first modification or deep read

7. SIZE_ENFORCEMENT:
   AFTER each update, check file sizes:
   L0 > 4KB: Consolidate MODULE_INDEX entries, remove lowest-value RULES
   L1 > 3KB: Move implementation details to L2, keep only signatures in INTERFACES
   L2 > 5KB: Split into sub-module docs or archive old CHANGELOG entries

8. STAGE_DOCS:
   Run: git add .prizm-docs/
   (Prizm docs are committed alongside source code changes)

## 7.3 Changelog Update

ALWAYS append to .prizm-docs/changelog.prizm after any doc update.
FORMAT: - YYYY-MM-DD | <module-path> | <verb>: <one-line description>
VERBS: add, update, fix, remove, refactor, rename, deprecate

---

# SECTION 8: ANTI-PATTERNS

WHAT_NOT_TO_PUT_IN_PRIZM_DOCS:

NEVER: Prose paragraphs or explanatory text (use KEY: value or bullet lists)
NEVER: Code snippets longer than 1 line (reference file_path:line_number instead)
NEVER: Human-readable formatting (emoji, ASCII art, markdown tables, horizontal rules)
NEVER: Duplicate information across levels (L0 summarizes, L1 details, L2 deep-dives)
NEVER: Implementation details in L0 or L1 (those belong in L2 only)
NEVER: Stale information (update or delete, never leave outdated entries)
NEVER: Full file contents or large code blocks (summarize purpose and interfaces)
NEVER: TODO items or future plans (those belong in issue trackers)
NEVER: Session-specific context or conversation history (docs are session-independent)
NEVER: Flowcharts, diagrams, mermaid blocks, or ASCII art (wastes tokens, AI cannot parse visually)
NEVER: Markdown headers (## / ###) inside .prizm files (use ALL CAPS KEY: format instead)
NEVER: Rewrite entire .prizm files on update (modify only affected sections)

---

# SECTION 9: INITIALIZATION PROCEDURE

## 9.1 Algorithm

OPERATION: Init (invoked via prizmkit-prizm-docs skill)
PRECONDITION: No .prizm-docs/ directory exists (or user confirms overwrite)

ALGORITHM: prizm_init

INPUT: Project root directory
OUTPUT: .prizm-docs/ with root.prizm, changelog.prizm, and L1 docs for discovered modules

STEPS:

1. DETECT_PROJECT:
   SCAN project root for build system files:
   - go.mod -> Go
   - package.json -> JavaScript/TypeScript
   - requirements.txt, pyproject.toml, setup.py -> Python
   - Cargo.toml -> Rust
   - pom.xml, build.gradle -> Java
   - *.csproj, *.sln -> C#
   IDENTIFY: primary language, framework, build command, test command
   FIND: entry points by convention:
   - Go: main.go, cmd/*/main.go
   - JS/TS: package.json "main"/"bin", index.ts, index.js
   - Python: __main__.py, manage.py, app.py
   - Rust: main.rs, lib.rs
   - Java: *Application.java, Main.java

2. DISCOVER_MODULES:
   SCAN source directories, preserving the tree structure (DO NOT FLATTEN):

   a. IDENTIFY TOP-LEVEL modules: directories directly under project root (or directly under src/ for src-based layouts) that either:
      - Contain 3+ source files of the primary language, OR
      - Contain sub-directories that each have 3+ source files
      RESULT: top_modules = [dev-pipeline, src, internal, app, ...]

   b. IDENTIFY SUB-MODULES: for each top-level module M, find directories INSIDE M that contain 3+ source files
      RESULT: sub_modules[M] = [scripts, lib, templates, ...]  (relative names, not full paths)

   c. HIERARCHY RULE: if directory X lives inside top-level module M, X is a sub-module of M — NOT a separate top-level module.
      WRONG: dev-pipeline/scripts/ treated as top-level module -> .prizm-docs/scripts.prizm
      CORRECT: dev-pipeline/scripts/ is a sub-module of dev-pipeline -> .prizm-docs/dev-pipeline/scripts.prizm

   d. MODULE_INDEX in root.prizm lists ONLY top-level modules from step 2a.
      Sub-modules appear in their parent's L1 doc SUBDIRS section, not in MODULE_INDEX.

   - EXCLUDE: vendor/, node_modules/, .git/, build/, dist/, __pycache__/, target/, bin/
   IF top-level module count > 30: ASK user for include/exclude patterns

3. CREATE_DIRECTORY_STRUCTURE:
   Create .prizm-docs/ directory
   For each top-level module M that has sub-modules: create .prizm-docs/<M>/ directory
   RULE: .prizm-docs/ directory tree must mirror the source directory tree exactly
   EXAMPLE:
     source: dev-pipeline/scripts/  -> prizm: .prizm-docs/dev-pipeline/scripts.prizm
     source: dev-pipeline/lib/      -> prizm: .prizm-docs/dev-pipeline/lib.prizm
     source: dev-pipeline/          -> prizm: .prizm-docs/dev-pipeline.prizm
   NEVER create .prizm-docs/scripts.prizm for a directory that lives at dev-pipeline/scripts/

4. GENERATE_ROOT (L0):
   Fill: PROJECT, LANG, FRAMEWORK, BUILD, TEST, ENTRY from step 1
   Build: MODULE_INDEX — list ONLY top-level modules from step 2a, one entry per module with pointer to .prizm-docs/<M>.prizm
   NEVER list sub-modules in MODULE_INDEX (sub-modules are navigated via L1 SUBDIRS pointers)
   Extract: RULES from existing README, .editorconfig, linter configs
   Extract: PATTERNS from common code patterns observed in step 2
   Set: PRIZM_VERSION: 2, UPDATED: today's date

5. GENERATE_L1_DOCS:
   FOR EACH top-level module M in MODULE_INDEX:
     SCAN M directory:
     - Count all source files (direct files only, not recursive)
     - Identify exported/public interfaces (language-specific: exported funcs in Go, export in JS/TS, public in Java, pub in Rust)
     - Trace import/require/use statements for DEPENDENCIES
     - List sub-modules from step 2b in SUBDIRS with pointers: .prizm-docs/<M>/<sub>.prizm
     - Identify 5-10 most important files for KEY_FILES
     WRITE: .prizm-docs/<M>.prizm

   FOR EACH sub-module S of top-level module M:
     SCAN M/S directory:
     - Count all source files in S
     - Identify exported/public interfaces within S
     - Trace dependencies within S
     - Identify key files in S
     WRITE: .prizm-docs/<M>/<S>.prizm
     NOTE: This is still an L1 doc (module index level), written at the mirrored sub-path

6. SKIP_L2:
   DO NOT generate L2 docs during initialization.
   RATIONALE: L2 requires deep code understanding. Generating shallow L2 docs during init would produce misleading content and create false confidence. L2 docs are generated lazily when AI first modifies files in a sub-module or performs a deep read (ON_DEEP_READ trigger).

7. CREATE_CHANGELOG:
   Write .prizm-docs/changelog.prizm with single entry:
   - YYYY-MM-DD | root | add: initialized prizm documentation framework

8. VALIDATE:
   CHECK: All generated files are within size limits (L0 <= 4KB, L1 <= 3KB)
   CHECK: Every MODULE_INDEX pointer resolves to an existing .prizm file
   CHECK: No circular dependencies in DEPENDENCIES sections
   CHECK: UPDATED timestamps are set on all files
   CHECK: KEY: value format compliance (no prose, no code blocks, no markdown headers)
   CHECK: No anti-patterns per Section 8

9. CONFIGURE_HOOK:
   Add UserPromptSubmit hook to .codebuddy/settings.json (see Section 11)

10. REPORT:
    Output summary: modules discovered, L1 docs generated, files excluded, warnings

## 9.2 Post-Init Behavior

After initialization, L2 docs are created incrementally:

ON_MODIFY trigger:
- First time AI modifies a file in sub-module S within module M:
  IF .prizm-docs/<M>/<S>.prizm does not exist:
    AI reads the source files in S, generates L2 doc, then proceeds with modification
- This ensures L2 docs have real depth, written when AI has actual context

ON_DEEP_READ trigger:
- When AI needs to deeply understand a module but not modify it (e.g., code review, architecture analysis, dependency tracing, explaining complex logic):
  IF .prizm-docs/<M>/<S>.prizm does not exist:
    AI reads the source files in S, generates L2 doc for future reference
- This ensures L2 docs are available for read-heavy analysis tasks, not just modifications
- RATIONALE: Some tasks require deep understanding without editing (reviewing PRs, answering architecture questions, tracing bugs). Generating L2 during these tasks captures valuable context.

---

# SECTION 10: SKILL DEFINITION

## 10.1 SKILL.md Reference

The Prizm skill is defined at: ${SKILL_DIR}/SKILL.md

OPERATIONS (all invoked via the prizmkit-prizm-docs skill):

  Init       - Bootstrap .prizm-docs/ for a new project (Section 9)
  Update     - Sync docs with code changes (Section 7)
  Status     - Check freshness of all docs
  Rebuild    - Regenerate docs for a specific module
  Validate   - Check format compliance and consistency (Section 10.2)
  Migrate    - Convert existing docs to .prizm-docs/ format (Section 10.3)

## 10.2 Validate Operation

OPERATION: Validate (invoked via prizmkit-prizm-docs skill)
PRECONDITION: .prizm-docs/ directory exists

ALGORITHM: prizm_validate

STEPS:

1. FORMAT_CHECK:
   FOR EACH .prizm file:
     VERIFY: All content uses KEY: value format or dash-prefixed list items
     FLAG: Prose paragraphs (lines without KEY: prefix or - prefix)
     FLAG: Code blocks (``` markers)
     FLAG: Markdown headers (## / ### markers)
     FLAG: Emoji, ASCII art, horizontal rules
     FLAG: Markdown tables

2. SIZE_CHECK:
   VERIFY: root.prizm <= 4KB
   VERIFY: All L1 files <= 3KB
   VERIFY: All L2 files <= 5KB
   REPORT: Files exceeding limits with current size and limit

3. POINTER_CHECK:
   FOR EACH arrow pointer (->) in all .prizm files:
     VERIFY: Target file exists on disk
     REPORT: Broken pointers with source file, line, and missing target

4. TIMESTAMP_CHECK:
   FOR EACH .prizm file:
     VERIFY: UPDATED field exists
     FLAG: Docs with UPDATED older than 30 days as potentially stale
     COMPARE: UPDATED against git log for corresponding source directory

5. COMPLETENESS_CHECK:
   root.prizm MUST have: PRIZM_VERSION, PROJECT, LANG, MODULE_INDEX, RULES
   L1 docs MUST have: MODULE, FILES, RESPONSIBILITY, INTERFACES, DEPENDENCIES
   L2 docs MUST have: MODULE, FILES, KEY_FILES, DEPENDENCIES, TRAPS
   REPORT: Missing required fields per file

6. ANTI_PATTERN_CHECK:
   FLAG: Duplicate information across levels (same content in L0 and L1)
   FLAG: Implementation details in L0 or L1 (belong in L2 only)
   FLAG: TODO items or future plans in any .prizm file
   FLAG: Session-specific context or conversation history

7. RULES_HIERARCHY_CHECK:
   EXTRACT: RULES from root.prizm (authoritative)
   FOR EACH L1/L2 doc with RULES section:
     CHECK: No contradiction with root.prizm RULES
     VERIFY: L1/L2 RULES only add module-specific exceptions
     FLAG: Direct contradictions with root.prizm RULES

OUTPUT: Validation report with PASS/FAIL per check category, issue list with file paths and line references, suggested fixes for common problems.

## 10.3 Migrate Operation

OPERATION: Migrate (invoked via prizmkit-prizm-docs skill)
PRECONDITION: Existing documentation (docs/, docs/AI_CONTEXT/, README.md, ARCHITECTURE.md, etc.). No .prizm-docs/ directory (or user confirms overwrite).

ALGORITHM: prizm_migrate

STEPS:

1. DISCOVER_EXISTING_DOCS:
   SCAN for: docs/, docs/AI_CONTEXT/, README.md, ARCHITECTURE.md, CONTRIBUTING.md, API docs
   CATALOG: List all found documentation files with sizes and types

2. EXTRACT_INFORMATION:
   FROM each doc, extract:
   - Project metadata (name, language, framework, build/test commands)
   - Module descriptions and responsibilities
   - Architecture patterns and layers
   - Rules, conventions, and constraints
   - Decisions and their rationale
   - Dependencies and relationships
   - Known issues and traps

3. MAP_TO_PRIZM_LEVELS:
   Project-wide info -> root.prizm (L0): PROJECT, LANG, FRAMEWORK, RULES, PATTERNS
   Module-level info -> L1 docs: MODULE, RESPONSIBILITY, INTERFACES, DEPENDENCIES
   Detailed module info -> L2 docs: KEY_FILES, TRAPS, domain-specific sections

4. CONVERT_FORMAT:
   Strip markdown formatting (headers, tables, horizontal rules, emphasis)
   Convert prose to KEY: value pairs
   Convert lists to dash-prefixed items
   Convert code blocks to file_path:line_number references
   Condense multi-sentence explanations to single-line values

5. GENERATE_PRIZM_DOCS:
   Follow standard init procedure (Section 9) but seed with extracted information
   Merge source-code-scanned data with documentation-extracted data
   Prefer documentation-extracted RULES (they capture rationale)
   Prefer source-code-scanned INTERFACES and DEPENDENCIES (they are current)

6. VALIDATE:
   Run full validation per Section 10.2
   Flag any content that could not be automatically converted

7. REPORT:
   Output: Source files processed, .prizm files generated, content successfully migrated, content requiring manual review, warnings

---

# SECTION 11: HOOK CONFIGURATION

## 11.1 Mechanism

HOOK_TYPE: command (shell echo, fast and reliable)
EVENT: UserPromptSubmit
BEHAVIOR: When matcher detects commit-related keywords, echoes doc update reminder as stdout
INJECTION: stdout content is injected into AI's context as a system-reminder
NOTE: Previously used type: prompt (LLM-evaluated), but switched to type: command for reliability — prompt type is prone to timeout and JSON format errors

## 11.2 Configuration Template

Place in: .codebuddy/settings.json (project-level)

JSON:
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "(?i)\\b(commit|push|finish|ship|merge|pull request|pr)\\b|提交|推送|收尾|完成任务|合并|发版|发布",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'PRIZMKIT_MAINTENANCE_REQUIRED: Before committing, you MUST run /prizmkit-retrospective. It maintains .prizm-docs/ architecture index — structural sync (KEY_FILES, INTERFACES, DEPENDENCIES) + TRAPS/RULES/DECISIONS injection. After retrospective completes, proceed with /prizmkit-committer for the actual git commit.'"
          }
        ]
      }
    ]
  }
}

## 11.3 How It Works

FLOW:
1. User types prompt (e.g., "commit these changes" or "push to main")
2. UserPromptSubmit hook fires, matcher regex checks for commit-related keywords
3. IF matcher matches: command hook runs echo, stdout is injected as system-reminder
   - AI sees the update instructions and executes them before committing
4. IF matcher does not match: hook does not fire, AI proceeds normally

KEYWORDS_DETECTED: commit, push, finish, done, ship, merge, PR, pull request, /commit, save changes

## 11.4 Adapting for Other AI Tools

The hook configuration above is specific to CodeBuddy Code.
For other AI coding assistants:
- Cursor: Use .cursorrules file to add the auto-update protocol as a rule
- Aider: Use .aider.conf.yml conventions section
- Continue: Use .continue/config.json customInstructions
- Generic: Add the auto-update protocol text to whatever system prompt or rules file the tool supports

The core requirement is: before any commit operation, AI must update affected .prizm-docs/ files.

---

# SECTION 12: LANGUAGE-SPECIFIC INITIALIZATION HINTS

## 12.1 Module Boundary Detection

LANGUAGE          MODULE_BOUNDARY                         ENTRY_POINT_DETECTION
Go                Directories with .go files              main.go, cmd/**/main.go
JavaScript/TS     Directories with index.ts/js/tsx/jsx    package.json main/bin
Python            Directories with __init__.py            __main__.py, manage.py, app.py, wsgi.py
Rust              Directories with mod.rs                 main.rs, lib.rs
Java              src/main/java/* package directories     *Application.java, Main.java
C#                Directories with *.cs files             Program.cs, Startup.cs

## 12.2 Interface Detection

LANGUAGE          EXPORTED_INTERFACE_PATTERN
Go                Capitalized function/type names (func Foo, type Bar)
JavaScript/TS     export/export default declarations
Python            Functions/classes without underscore prefix
Rust              pub fn, pub struct, pub enum, pub trait
Java              public class, public interface, public method
C#                public class, public interface, public method

## 12.3 Dependency Detection

LANGUAGE          IMPORT_PATTERN
Go                import "path/to/package"
JavaScript/TS     import ... from "...", require("...")
Python            import ..., from ... import ...
Rust              use crate::..., use super::..., extern crate
Java              import package.Class
C#                using Namespace

---

# SECTION 13: MINIMAL VIABLE PRIZM

For any project, the minimum viable Prizm setup is:

FILES:
  .prizm-docs/root.prizm        # Project meta + module index (L0)
  .prizm-docs/changelog.prizm   # Change log

This is enough to give AI a project overview and track changes.
L1 and L2 docs can be added incrementally as AI works in specific areas.

BOOTSTRAP:
  Invoke prizmkit-prizm-docs skill (Init operation)

Or manually create these two files following the templates in Section 3.

---

# SECTION 14: VERSION HISTORY

V1 (2026-03-02): Initial specification
- 3-level progressive loading (L0, L1, L2)
- KEY: value format, AI-only audience
- UserPromptSubmit hook with type: prompt for auto-update
- Mirrored directory structure under .prizm-docs/
- Lazy L2 generation strategy
- Universal language support

V2 (2026-03-02): Enhanced specification
- Added ON_DEEP_READ trigger for L2 generation (L2 created during deep analysis, not just modifications)
- Added Validate operation for format compliance and consistency checking
- Added Migrate operation for converting existing docs to .prizm-docs/ format
- Added RULES hierarchy: root.prizm RULES authoritative, L1/L2 supplement only with module-specific exceptions
- Added Section 15: Conflict Resolution for multi-person collaboration merge strategies
- Added Section 16: Version Migration for upgrading between spec versions
- Changed fixed skill path to ${SKILL_DIR} convention for cross-IDE compatibility
- Enhanced Section 9.1 with ON_DEEP_READ trigger alongside ON_MODIFY
- Updated PRIZM_SPEC_VERSION to 2

---

# SECTION 15: CONFLICT RESOLUTION

## 15.1 Multi-Person Collaboration

CONTEXT: When multiple developers (human or AI) work on the same project, .prizm-docs/ files may have merge conflicts since they are committed to git.

## 15.2 Merge Strategies by Section Type

APPEND_ONLY_SECTIONS:
- changelog.prizm: Append-only. Use standard git merge. Both sides' entries are kept. Sort by date descending after merge.
- DECISIONS (in any .prizm file): Append-only. Keep all entries from both sides on merge conflicts.
- REJECTED (in any .prizm file): Append-only. Keep all entries from both sides.
- CHANGELOG (in L2 docs): Append-only. Keep all entries from both sides.

LATEST_WINS_SECTIONS:
- UPDATED: Take the more recent timestamp
- FILES: Take the higher count (or recount from source)
- KEY_FILES: Take the version from the branch with more recent UPDATED timestamp
- INTERFACES: Take the version from the branch with more recent UPDATED timestamp
- DEPENDENCIES: Take the version from the branch with more recent UPDATED timestamp
- MODULE_INDEX: Merge entries from both sides, take latest counts, keep all pointers
- RULES: Take the version from the branch with more recent UPDATED timestamp
- TRAPS: Union of both sides (traps are safety-critical, never discard)

## 15.3 Conflict Resolution Algorithm

ALGORITHM: prizm_merge_conflict

1. DETECT: Identify conflicted .prizm files from git merge markers (<<<<<<<, =======, >>>>>>>)

2. FOR EACH conflicted file:
   a. PARSE both versions (ours and theirs) into sections by ALL CAPS KEY
   b. FOR EACH section:
      IF section is APPEND_ONLY (DECISIONS, REJECTED, CHANGELOG):
        MERGE: Concatenate entries from both versions, deduplicate by content, sort by date
      IF section is LATEST_WINS:
        COMPARE: UPDATED timestamps from both versions
        TAKE: Version with more recent UPDATED timestamp
      IF section is TRAPS:
        UNION: Keep all entries from both versions, deduplicate by content
   c. REASSEMBLE: Write merged sections back to file
   d. VALIDATE: Check size limits and format compliance

3. STAGE: git add resolved .prizm files

4. IF manual intervention needed:
   FLAG: Sections where both versions modified the same KEY: value line with different values
   REPORT: List conflicted keys for human review

## 15.4 Prevention

BEST_PRACTICE: Run prizmkit-prizm-docs Update operation immediately before committing to minimize drift
BEST_PRACTICE: Keep .prizm doc changes small and focused (section-level, not file-level rewrites)
BEST_PRACTICE: Coordinate on MODULE_INDEX changes (adding/removing modules) to avoid structural conflicts

---

# SECTION 16: VERSION MIGRATION

## 16.1 Migration Principles

BACKWARD_COMPATIBLE: V2 can read V1 docs without modification
FORWARD_COMPATIBLE: V1 tools will ignore V2-only fields they do not recognize
MIGRATION_TRIGGER: AI detects PRIZM_VERSION in root.prizm and applies migration if needed

## 16.2 V1 to V2 Migration

TRIGGER: Automatic on first prizmkit-prizm-docs Update or Validate operation after spec upgrade

ALGORITHM: prizm_migrate_v1_to_v2

1. UPDATE_VERSION:
   Change: PRIZM_VERSION: 1 -> PRIZM_VERSION: 2
   In: root.prizm

2. ADD_RULES_HIERARCHY:
   VERIFY: root.prizm has RULES section
   ADD comment-free note: root.prizm RULES are authoritative
   SCAN: L1/L2 docs for RULES sections
   FLAG: Any L1/L2 RULES that contradict root.prizm RULES for manual review

3. VALIDATE:
   Run full Validate operation
   REPORT: Migration results and any issues found

4. UPDATE_CHANGELOG:
   APPEND: - YYYY-MM-DD | root | update: migrated from PRIZM_VERSION 1 to 2

## 16.3 Future Version Migration Pattern

FOR any future version N to N+1:

1. READ: root.prizm PRIZM_VERSION
2. IF version < target: Apply migration steps sequentially (V1->V2, V2->V3, etc.)
3. EACH migration step:
   a. Update PRIZM_VERSION
   b. Add new required fields with sensible defaults
   c. Transform existing fields if format changed
   d. Validate result
   e. Append migration entry to changelog
4. NEVER: Delete existing fields during migration (only add or transform)
5. ALWAYS: Keep backward compatibility (old tools should still parse new format)
