---
description: [Tier 2] Log pattern recognition via text analysis. Identifies error frequencies and correlations from provided log content. (project)
---

# PrizmKit Log Analyzer

Analyze log files to identify anomaly patterns, frequency trends, and error correlations for production issue investigation.

## Commands

### `/prizmkit-analyze`-logs \<log-file-or-directory\>

Analyze log files and produce a structured report of findings.

**STEPS:**

1. Read and parse log files (auto-detect format):
   - JSON structured logs
   - Structured text (key=value pairs)
   - Syslog format
   - Custom formats (infer delimiter and field positions)
2. Extract entries with normalized fields:
   - **Timestamp**: parse to comparable datetime
   - **Level**: DEBUG, INFO, WARN, ERROR, FATAL
   - **Source**: service name, module, class, or file
   - **Message**: the log message body
   - **Metadata**: request ID, user ID, trace ID (if present)
3. Analyze patterns:
   - **Error frequency**: count by type and time window (per minute, per hour)
   - **Correlation**: errors that consistently appear together or in sequence
   - **Anomaly detection**: sudden spikes in error rate, new error types not seen before
   - **Timeline**: when did behavior change relative to deployments or config changes
   - **Request tracing**: follow request IDs across log entries to reconstruct flows
4. Identify top issues:
   - Most frequent errors (by count)
   - Most recent new errors (not seen in earlier log entries)
   - Errors with increasing trend (getting worse over time)
   - Errors correlated with specific endpoints, users, or time windows
5. Generate analysis report:
   - **Timeline of events**: chronological summary of significant changes
   - **Top 10 error patterns**: with frequency, first/last occurrence, and sample messages
   - **Correlation findings**: errors that co-occur or cascade
   - **Anomaly alerts**: unusual patterns that warrant investigation
   - **Recommended investigation priorities**: ranked list of what to look at first

## Path References

All internal asset paths MUST use `.claude/commands/prizmkit-log-analyzer` placeholder for cross-IDE compatibility.

## Output

- Structured analysis report printed to console
- Summary suitable for sharing with team or pasting into incident reports
