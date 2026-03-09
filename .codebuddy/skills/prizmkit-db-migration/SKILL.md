---
name: prizmkit-db-migration
tier: 2
description: [Tier 2] Database migration script generation with rollback plans. Cannot validate against actual database. (project)
---

# PrizmKit Database Migration

Plan safe database schema changes with forward and backward migration scripts, risk assessment, and verification queries.

## Commands

### prizmkit.db-migrate

Generate a database migration plan with scripts and rollback procedures.

**STEPS:**

1. Read current data model from `.prizmkit/specs/` or `.prizm-docs/` (entity definitions, relationships, constraints)
2. Ask user: describe the schema change needed
   - What tables/collections are affected
   - What is the desired end state
   - Any data transformation requirements
3. Analyze change type:
   - **Additive** (safe): New tables, new nullable columns, new indexes
   - **Destructive** (risky): Drop tables, drop columns, change types with data loss
   - **Transformative** (complex): Rename columns, split/merge tables, data backfill
4. Generate migration plan:
   - **Pre-migration**:
     - Backup command for affected tables
     - List of affected tables and estimated row counts
     - Estimated downtime (if any)
   - **Forward migration**: SQL or ORM migration script
     - Schema DDL statements
     - Data migration DML statements (if applicable)
     - Index creation (CONCURRENTLY where supported)
   - **Backward migration (rollback)**: Reverse SQL or ORM script
     - Reverse DDL statements
     - Data restoration approach
     - MUST be tested before deploying forward migration
   - **Data verification**: Queries to validate migration success
     - Row count comparisons
     - Data integrity checks
     - Constraint validation
5. Risk assessment:
   - **Data loss potential**: NONE / LOW / MEDIUM / HIGH
   - **Downtime estimate**: Zero / Seconds / Minutes / Hours
   - **Recommended deployment strategy**: Online migration vs offline migration
   - **Lock contention risk**: Which tables will be locked and for how long
6. Write migration files to project's migration directory convention (detect from existing migrations or ask user)
7. Generate `migration-plan.md` with complete procedure:
   - Step-by-step execution guide
   - Monitoring queries to run during migration
   - Success criteria
   - Abort conditions

## Path References

All internal asset paths MUST use `${SKILL_DIR}` placeholder for cross-IDE compatibility.

## Output

- Migration script file(s) in the project's migration directory
- Rollback script file(s) alongside migration scripts
- `migration-plan.md`: Complete migration procedure with risk assessment
