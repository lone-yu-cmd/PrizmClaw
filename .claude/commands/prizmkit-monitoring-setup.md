---
description: [Tier 2] Generate monitoring config templates for Prometheus/Grafana/CloudWatch/etc. Cannot test or validate actual metrics collection. (project)
---

# PrizmKit Monitoring Setup

Generate comprehensive monitoring, alerting, and log collection configurations for your project's observability stack.

## Commands

### `/prizmkit-monitoring`

Generate monitoring and observability configurations.

**STEPS:**

1. Read `.prizm-docs/root.prizm` for tech stack and architecture (services, databases, external dependencies)
2. Ask user: monitoring stack
   - Prometheus + Grafana
   - ELK (Elasticsearch, Logstash, Kibana)
   - CloudWatch (AWS)
   - Datadog
   - Other (specify)
3. Identify key metrics to monitor:
   - **Application (RED metrics)**:
     - Request **R**ate: requests per second by endpoint
     - **E**rror rate: 4xx/5xx responses, exception counts
     - **D**uration: latency percentiles (p50, p95, p99)
   - **System**:
     - CPU utilization and saturation
     - Memory usage and swap
     - Disk I/O and space
     - Network throughput and errors
   - **Business**:
     - Feature-specific metrics derived from spec (signups, transactions, etc.)
     - SLA/SLO compliance indicators
   - **Database**:
     - Connection pool utilization
     - Query latency by type (read/write)
     - Replication lag
     - Slow query count
4. Generate monitoring configs:
   - **Metrics collection**: Scrape configs, exporters, or agent configurations
   - **Alert rules** with severity levels:
     - Critical: immediate page (service down, data loss risk)
     - Warning: investigate soon (degraded performance, approaching limits)
     - Info: awareness (deployment events, scaling events)
   - **Dashboard definition**: JSON/YAML for Grafana or equivalent
     - Overview dashboard: service health at a glance
     - Detail dashboard: per-service deep dive
   - **Log format and collection config**:
     - Structured log format recommendation
     - Log shipping configuration
     - Log retention policy
5. Generate health check endpoint code if not existing:
   - Liveness probe: process is running
   - Readiness probe: dependencies are available
   - Startup probe: initialization complete
6. Write configs to standard locations:
   - Prometheus: `monitoring/prometheus.yml`, `monitoring/alerts.yml`
   - Grafana: `monitoring/dashboards/`
   - Application: health check endpoint in source code

## Path References

All internal asset paths MUST use `.claude/commands/prizmkit-monitoring-setup` placeholder for cross-IDE compatibility.

## Output

- Monitoring configuration files in `monitoring/` directory
- Alert rule definitions
- Dashboard JSON/YAML files
- Health check endpoint code (if generated)
