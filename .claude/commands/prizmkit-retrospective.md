---
description: Post-feature retrospective. Extracts lessons from completed features, updates Prizm docs TRAPS and RULES. Invoke after feature completion. (project)
---

# PrizmKit Retrospective

Post-feature retrospective analysis that extracts lessons learned, updates Prizm documentation with discovered traps and rules, and documents improvements for future reference.

### When to Use
- After completing a feature (spec, plan, tasks, implementation all done)
- User says "retrospective", "retro", "lessons learned", "what did we learn"
- Before starting a new major feature (to apply lessons from the last one)

### `/prizmkit-retrospective`

PRECONDITION: Completed feature with spec.md, plan.md, tasks.md in .prizmkit/specs/

### Steps

#### Step 1: Gather Feature Artifacts
Read all feature artifacts from .prizmkit/specs/###-feature-name/:
- spec.md (original requirements and acceptance criteria)
- plan.md (architecture decisions and implementation plan)
- tasks.md (task breakdown and status)
- data-model.md (if exists)
- contracts/ directory (if exists)

#### Step 2: Analyze Implementation
Compare planned vs actual:
- Tasks completed vs skipped — why were tasks skipped?
- Architecture deviations from plan — what changed and why?
- Unexpected challenges encountered — what surprised us?
- Time-intensive areas — what took longer than expected?

#### Step 3: Extract Lessons
Categorize findings:
- **What went well** (reinforce these patterns)
- **What went wrong** (create anti-patterns to avoid)
- **What was surprising** (new patterns to document)
- **What would you do differently** (improvement candidates)

NOTE: If bug fixes were performed during this feature's implementation, they are refinements of the feature itself (completing its intended behavior), NOT separate features. Do not create separate documentation entries or REGISTRY records for bug fixes.

#### Step 4: Generate Retrospective Document
Write retrospective.md in .prizmkit/specs/###-feature-name/:
```markdown
# Retrospective: <feature-name>
Date: YYYY-MM-DD

## Summary Statistics
- Tasks total: N
- Tasks completed: N
- Tasks skipped: N (with reasons)

## Key Decisions
- Decision: <what> | Outcome: <good/bad/neutral> | Lesson: <takeaway>

## Patterns Discovered
- Pattern: <name> | Context: <when to apply> | Benefit: <why>

## Anti-Patterns Discovered
- Anti-pattern: <name> | Context: <when it occurred> | Fix: <what to do instead>

## Improvement Suggestions
- Skill: <skill-name> | Suggestion: <what to improve>
```

#### Step 5: Update Prizm Docs
For each lesson learned, update the relevant `.prizm-docs/` files:
- Add discovered pitfalls to the affected module's TRAPS section
- Add new conventions or rules to the affected module's RULES section
- Append decisions to DECISIONS section with rationale
- Update changelog.prizm with retrospective findings

#### Step 6: Handoff
Suggest next action:
- ``/prizmkit-specify`` — start next feature
- No action needed — just documenting for future reference
