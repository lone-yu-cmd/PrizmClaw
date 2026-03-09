---
name: prizmkit-ci-cd-generator
tier: 2
description: [Tier 2] Generate CI/CD pipeline config templates for GitHub Actions/GitLab CI/Jenkins. Cannot validate or test pipelines. (project)
---

# PrizmKit CI/CD Generator

Generate production-ready CI/CD pipeline configurations derived from your project's tech stack context.

## Commands

### prizmkit.ci-cd

Generate a CI/CD pipeline configuration for the project.

**STEPS:**

1. Read `.prizm-docs/root.prizm` for tech stack context (LANG, FRAMEWORK, BUILD, TEST)
2. Ask user: target platform
   - GitHub Actions
   - GitLab CI
   - Jenkins
   - Other (specify)
3. Ask user: environments to configure (dev, staging, production)
4. Generate pipeline config with stages:
   - **Install dependencies**: Use project's package manager (npm, pip, cargo, etc.)
   - **Lint/format check**: Run linter and formatter configured in project
   - **Run tests**: Execute test suite with coverage reporting
   - **Build artifact**: Compile/bundle project output
   - **Deploy**: Per-environment deployment steps
5. Include in generated config:
   - Dependency caching (language-appropriate cache keys)
   - Artifact management (build outputs, test reports)
   - Environment variable placeholders with descriptive comments
6. Write config to standard location:
   - GitHub Actions: `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`
   - GitLab CI: `.gitlab-ci.yml`
   - Jenkins: `Jenkinsfile`
7. Add environment-specific secrets as placeholders with `# TODO: Configure in CI/CD settings` comments
8. Generate a README section documenting the CI/CD setup:
   - Pipeline overview
   - Required secrets and environment variables
   - How to trigger deployments
   - How to add new stages

## Path References

All internal asset paths MUST use `${SKILL_DIR}` placeholder for cross-IDE compatibility.

## Output

- Pipeline configuration file(s) in the appropriate standard location
- README section or standalone CI/CD documentation
