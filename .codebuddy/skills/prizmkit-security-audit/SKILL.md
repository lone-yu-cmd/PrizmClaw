---
name: prizmkit-security-audit
tier: 2
description: [Tier 2] AI-assisted security review checklist via static code analysis. Identifies common vulnerability patterns and hardcoded secrets. Not an automated scanner. (project)
---

# PrizmKit Security Audit

Comprehensive security scanner that identifies vulnerabilities, hardcoded secrets, and insecure patterns across the codebase. Generates a severity-rated report with actionable fix suggestions.

### When to Use
- User says "security audit", "security review", "check for vulnerabilities"
- Before deployment or release
- After adding authentication, authorization, or data handling code
- During code review of security-sensitive changes

### prizmkit.security-audit

### Steps

#### Step 1: Load Project Context
Read .prizm-docs/root.prizm for:
- Project tech stack and languages
- Architecture overview
- Module structure

#### Step 2: Scan for Vulnerabilities
Scan code files across these categories:

**Injection**
- SQL injection: raw query concatenation, unsanitized user input in queries
- XSS: unescaped output in templates, innerHTML usage, dangerouslySetInnerHTML
- Command injection: shell exec with user input, unsanitized system calls
- LDAP injection: unescaped LDAP filter construction

**Authentication**
- Weak password handling: plaintext storage, weak hashing (MD5, SHA1)
- Missing auth checks: unprotected routes/endpoints
- Session management: predictable session IDs, missing expiration

**Authorization**
- Broken access control: missing role checks, horizontal privilege escalation
- IDOR: direct object references without ownership validation
- Privilege escalation: admin functions without proper guards

**Data Exposure**
- Hardcoded credentials: API keys, tokens, passwords in source code
- Sensitive data in logs: PII, credentials, tokens logged in plaintext
- Unencrypted sensitive data: passwords, SSN, credit cards stored in plain text

**Configuration**
- Debug mode enabled in production configs
- Default credentials in configuration files
- Insecure defaults: CORS *, permissive CSP, disabled CSRF

**Dependencies**
- Cross-reference package manifests (package.json, requirements.txt, etc.)
- Flag known vulnerable version ranges where identifiable

**Cryptography**
- Weak algorithms: DES, RC4, MD5 for security purposes
- Hardcoded encryption keys or IVs
- Improper random generation: Math.random() for security tokens

**Input Validation**
- Missing validation on user inputs
- Improper sanitization or escaping
- Regex DoS (ReDoS) patterns

#### Step 3: Check Sensitive File Handling
- Verify .gitignore covers: .env, credentials.json, *.pem, *.key, *.p12
- Check for sensitive files already tracked in git
- Flag any secrets that may have been committed historically

#### Step 4: Classify Findings
Rate each finding by severity:
- **CRITICAL**: Actively exploitable, data breach risk, hardcoded production secrets
- **HIGH**: Significant vulnerability requiring immediate attention
- **MEDIUM**: Security weakness that should be addressed
- **LOW**: Minor issue or best practice improvement

Maximum 50 findings per report.

#### Step 5: Generate Report
Output structured security report to conversation (READ-ONLY, no file modifications):

```markdown
# Security Audit Report
Date: YYYY-MM-DD
Project: <project-name>

## Summary
- Critical: N | High: N | Medium: N | Low: N
- Files scanned: N
- Categories checked: N

## Critical Findings
### [C-001] <Title>
- **File**: path/to/file.ext:line
- **Category**: Injection / Auth / etc.
- **Description**: What the issue is
- **Impact**: What could happen if exploited
- **Fix**: How to remediate

## High Findings
...

## Medium Findings
...

## Low Findings
...

## Recommendations
1. Immediate actions (Critical + High)
2. Short-term improvements (Medium)
3. Long-term hardening (Low + best practices)
```

#### Step 6: Suggest Fixes
For CRITICAL and HIGH findings:
- Provide specific code fix suggestions
- Reference security best practices
- Link to relevant documentation where applicable

#### Step 7: Record Findings (Optional)
If `.prizm-docs/` exists:
- Update affected module RULES with security conventions discovered
- Update affected module TRAPS with security pitfalls found
- Track security posture improvements over time via changelog.prizm
