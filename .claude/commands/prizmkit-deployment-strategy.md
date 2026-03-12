---
description: [Tier 2] Deployment planning with rollback procedures for blue-green/canary/rolling strategies. Planning only, cannot execute. (project)
---

# PrizmKit Deployment Strategy

Plan comprehensive deployment strategies with rollback procedures tailored to your project's infrastructure.

## Commands

### `/prizmkit-deploy`-plan

Generate a deployment plan with rollback procedures.

**STEPS:**

1. Read project context from `.prizm-docs/` (architecture, tech stack, infrastructure references)
2. Ask user: deployment target
   - Cloud provider (AWS, GCP, Azure)
   - Container orchestration (Kubernetes, Docker Swarm, ECS)
   - Bare metal / VM-based
   - Serverless (Lambda, Cloud Functions, Vercel)
3. Ask user: strategy preference
   - **Blue-green**: Zero-downtime with full environment swap
   - **Canary**: Gradual traffic shift to new version
   - **Rolling**: Incremental instance replacement
   - **Recreate**: Stop old, start new (accepts brief downtime)
4. Generate `deployment-plan.md` containing:
   - **Pre-deployment checklist**:
     - All tests passing on target branch
     - Database migrations prepared and tested
     - Backups completed (database, config, artifacts)
     - Monitoring and alerting confirmed operational
     - Communication sent to stakeholders
   - **Deployment steps**: Specific commands for the chosen strategy and target
   - **Health check configuration**: Endpoints, thresholds, intervals
   - **Rollback procedure**: Step-by-step commands to revert to previous version
   - **Monitoring points**: What to watch during and after deployment
   - **Post-deployment verification**:
     - Smoke test endpoints
     - Key metric baselines to compare
     - User-facing feature verification
5. Generate rollback script (`rollback.sh`) if applicable:
   - Automated rollback with safety checks
   - Confirmation prompts before destructive operations
   - Logging of rollback actions
6. Write to `.prizmkit/deployment-plan.md`

## Path References

All internal asset paths MUST use `.claude/commands/prizmkit-deployment-strategy` placeholder for cross-IDE compatibility.

## Output

- `.prizmkit/deployment-plan.md`: Complete deployment procedure
- `rollback.sh` (if applicable): Executable rollback script
