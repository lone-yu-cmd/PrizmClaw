---
name: prizmkit-dependency-health
tier: 2
description: [Tier 2] Dependency review based on manifest files. Analyzes version patterns; cannot query package registries for real-time vulnerability data. (project)
---

# PrizmKit Dependency Health

Audit project dependencies across all supported ecosystems. Identifies outdated packages, known vulnerabilities, license conflicts, and abandoned projects. Generates a health report with prioritized upgrade recommendations.

### When to Use
- User says "check dependencies", "dependency audit", "are my packages up to date"
- Before a major release or deployment
- Periodically as part of maintenance workflow
- After security advisories are published

### prizmkit.dependency-health

### Steps

#### Step 1: Detect Dependency Files
Scan project root and subdirectories for:
- **Node.js**: package.json + package-lock.json / yarn.lock / pnpm-lock.yaml
- **Python**: requirements.txt / Pipfile / pyproject.toml / setup.py
- **Go**: go.mod / go.sum
- **Rust**: Cargo.toml / Cargo.lock
- **Java**: pom.xml / build.gradle / build.gradle.kts
- **Ruby**: Gemfile / Gemfile.lock
- **PHP**: composer.json / composer.lock
- **.NET**: *.csproj / packages.config

#### Step 2: Analyze Each Dependency
For each dependency found:
- Current version pinned in manifest
- Latest available version (if determinable from lock files or version patterns)
- Major/minor/patch version delta
- Known security advisories (if detectable from version ranges)
- License type and compatibility

#### Step 3: Classify Health Status
- **HEALTHY**: Up to date or within 1 minor version, no known issues
- **STALE**: 1+ major version behind latest
- **VULNERABLE**: Known security advisory for current version
- **ABANDONED**: No updates in 2+ years (based on available metadata)
- **INCOMPATIBLE**: License conflict with project license

#### Step 4: Generate Recommendations
Prioritized by risk:

**Safe Updates** (low risk):
- Patch version bumps (bug fixes only)
- Minor version bumps within same major (backward compatible)

**Breaking Updates** (medium risk):
- Major version bumps — list known breaking changes where identifiable
- Suggest migration steps if available

**Replacements** (high effort):
- For abandoned packages — suggest actively maintained alternatives
- For packages with unresolved vulnerabilities — suggest secure alternatives

#### Step 5: Generate Report
Output health report to conversation (READ-ONLY):

```markdown
# Dependency Health Report
Date: YYYY-MM-DD
Project: <project-name>

## Summary
- Total dependencies: N
- Healthy: N | Stale: N | Vulnerable: N | Abandoned: N

## Ecosystem: <Node.js / Python / etc.>

### Vulnerable (Action Required)
| Package | Current | Latest | Advisory | Severity |
|---------|---------|--------|----------|----------|
| example | 1.2.3   | 1.2.5  | CVE-XXX  | HIGH     |

### Stale (Upgrade Recommended)
| Package | Current | Latest | Versions Behind |
|---------|---------|--------|-----------------|
| example | 2.0.0   | 4.1.0  | 2 major         |

### Abandoned (Consider Replacing)
| Package | Last Update | Suggested Alternative |
|---------|-------------|----------------------|
| example | 2021-01-01  | better-example       |

### Healthy
N packages up to date.

## Recommended Actions
1. Run: <package-manager-specific update commands>
2. Review breaking changes for: <packages>
3. Evaluate replacements for: <packages>
```

#### Step 6: Suggest Update Commands
Provide copy-paste commands for the project's package manager:

**Node.js**:
```bash
npm update                          # safe updates
npm install <pkg>@latest            # major updates (one at a time)
npx npm-check-updates -u            # update all to latest
```

**Python**:
```bash
pip install --upgrade <pkg>         # upgrade specific
pip install -r requirements.txt --upgrade  # upgrade all
```

**Go**:
```bash
go get -u ./...                     # update all
go get <pkg>@latest                 # update specific
go mod tidy                         # clean up
```

Adapt commands to the detected package manager.
