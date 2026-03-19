# App Planning Reference Guide

This guide provides structured templates, decision matrices, and patterns for each phase of the app planning process. It is intended as a practical reference for the AI during interactive planning sessions.

---

## 1. App Vision Template

Use this template to capture the app vision during the initial planning phase.

```markdown
# App Vision: [APP_NAME]

## Problem Statement
[What problem does this app solve?]

## Target Users
- Primary: [Who are the main users?]
- Secondary: [Any secondary user types?]

## Core Value Proposition
[What makes this app valuable? What's the "elevator pitch"?]

## Key Differentiators
[What sets this apart from existing solutions?]
```

### Guidance

- **Problem Statement**: Should describe a real pain point in 1-3 sentences. Avoid vague statements like "improve productivity." Be specific about who suffers and why.
- **Target Users**: Identify at least one primary user persona. Secondary users are optional but useful for prioritization decisions later.
- **Core Value Proposition**: Should be expressible in one sentence. If it takes a paragraph, the scope is likely too broad.
- **Key Differentiators**: List 1-3 concrete differentiators. If none exist, reconsider whether the app needs to be built.

---

## 2. Tech Stack Decision Matrix

Use these tables to guide tech stack selection based on project requirements.

### Frontend Frameworks

| Framework | Best For | Ecosystem |
|-----------|----------|-----------|
| Next.js 14+ | Full-stack React, SSR, API routes | React ecosystem, Vercel |
| Nuxt 3 | Full-stack Vue, SSR | Vue ecosystem |
| SvelteKit | Performance-focused, smaller teams | Svelte ecosystem |
| Remix | Nested routes, data loading | React ecosystem |

### Backend Frameworks

| Framework | Best For | Language |
|-----------|----------|----------|
| Express.js | Flexible, minimal | Node.js/TS |
| FastAPI | High-perf APIs, Python ML | Python |
| NestJS | Enterprise, structured | Node.js/TS |
| Django | Batteries-included, admin | Python |
| Go (Gin/Echo) | High concurrency | Go |

### Databases

| Database | Best For | Type |
|----------|----------|------|
| PostgreSQL | Complex queries, ACID | Relational |
| MySQL | Read-heavy, simple | Relational |
| MongoDB | Flexible schema, documents | Document |
| SQLite | Embedded, prototyping | Relational |
| Redis | Caching, sessions, pub/sub | Key-Value |

### Design Systems

| System | Best For | Framework |
|--------|----------|-----------|
| shadcn/ui | Modern, customizable | React/Next.js |
| Ant Design | Enterprise, data-heavy | React |
| Material UI | Google-style, full-featured | React |
| Vuetify | Material Design for Vue | Vue |
| Tailwind CSS | Utility-first, any framework | Any |

### Common Service Patterns

| Need | Options |
|------|---------|
| Auth | NextAuth.js, Auth0, Clerk, Supabase Auth, custom JWT |
| Real-time | WebSocket, Socket.io, SSE, Supabase Realtime |
| File Storage | S3, Cloudflare R2, Supabase Storage |
| Email | SendGrid, Resend, Postmark |
| Payments | Stripe, LemonSqueezy |
| Search | Algolia, Meilisearch, Elasticsearch |

### Selection Heuristics

- If the user has no strong preference, default to **Next.js + PostgreSQL + shadcn/ui + Tailwind CSS** as a general-purpose stack.
- If the project involves ML/AI backends, prefer **FastAPI** on the backend.
- If the project requires high concurrency with minimal resource usage, consider **Go**.
- If rapid prototyping is the goal, consider **SQLite** initially with a migration path to PostgreSQL.
- Always ask about deployment preferences (Vercel, AWS, self-hosted) as this influences framework choice.

---

## 3. Feature Decomposition Patterns

Use these patterns as starting points when breaking an app into features. Adapt them to the specific project.

### Pattern A: CRUD-Based App

Examples: CMS, project management tools, inventory systems.

```
F-001: Infrastructure Setup (no deps)
F-002: User Authentication (deps: F-001)
F-003: Core Entity CRUD (deps: F-002)
F-004: Entity Relationships (deps: F-003)
F-005: Search & Filtering (deps: F-003)
F-006: Notifications (deps: F-003)
F-007: Admin Dashboard (deps: F-004, F-005)
F-008: Analytics & Reporting (deps: F-007)
```

### Pattern B: SaaS Platform

Examples: subscription services, multi-tenant tools, B2B products.

```
F-001: Infrastructure + Multi-tenant Setup (no deps)
F-002: User Auth + Organization Management (deps: F-001)
F-003: Core Product Feature (deps: F-002)
F-004: Subscription & Billing (deps: F-002)
F-005: Usage Tracking & Limits (deps: F-003, F-004)
F-006: Admin Portal (deps: F-005)
F-007: API & Integrations (deps: F-003)
F-008: Analytics Dashboard (deps: F-006, F-007)
```

### Pattern C: Social/Community App

Examples: forums, social networks, community platforms.

```
F-001: Infrastructure Setup (no deps)
F-002: User Auth + Profiles (deps: F-001)
F-003: Content Creation (posts/media) (deps: F-002)
F-004: Social Graph (follow/friend) (deps: F-002)
F-005: Feed Algorithm (deps: F-003, F-004)
F-006: Interactions (likes, comments) (deps: F-003)
F-007: Real-time Messaging (deps: F-004)
F-008: Notifications (deps: F-005, F-006, F-007)
F-009: Discovery & Search (deps: F-005)
```

### Pattern D: E-commerce App

Examples: online stores, marketplaces, booking platforms.

```
F-001: Infrastructure Setup (no deps)
F-002: User Auth (deps: F-001)
F-003: Product Catalog (deps: F-001)
F-004: Shopping Cart (deps: F-002, F-003)
F-005: Checkout & Payment (deps: F-004)
F-006: Order Management (deps: F-005)
F-007: Inventory Management (deps: F-003)
F-008: Reviews & Ratings (deps: F-002, F-003)
F-009: Search & Recommendations (deps: F-003, F-008)
F-010: Admin Dashboard (deps: F-006, F-007)
```

### Decomposition Guidelines

- Every app starts with an infrastructure/setup feature (F-001) that has zero dependencies.
- Authentication almost always comes second unless the app is fully public.
- Group related functionality into single features rather than splitting too finely. A feature should represent a coherent unit of user-facing value.
- If a pattern does not match the app being planned, combine elements from multiple patterns or define a custom decomposition from scratch.

---

## 4. Acceptance Criteria Writing Guide

Acceptance criteria define what "done" means for a feature. They should be specific, testable, and unambiguous.

### Format: Given/When/Then

```
Given [precondition/context]
When [action performed]
Then [expected outcome]
```

### Examples by Feature Type

**Authentication:**

- Given a new user, When they submit a valid registration form, Then an account is created and a confirmation email is sent.
- Given a registered user, When they enter correct credentials, Then they are logged in and redirected to the dashboard.
- Given a logged-in user, When their session expires, Then they are redirected to the login page with a message.

**CRUD Operations:**

- Given an authenticated user, When they create a new [entity] with valid data, Then the entity is saved and appears in the list.
- Given an entity list, When the user applies filters, Then only matching entities are displayed.
- Given an entity owner, When they delete the entity, Then it is removed after confirmation.

**Real-time:**

- Given two users viewing the same board, When one makes a change, Then the other sees it within 2 seconds without a page refresh.
- Given a user is offline, When they reconnect, Then missed updates are synced.

### Writing Principles

1. **One behavior per criterion.** Each criterion tests exactly one thing.
2. **No implementation details.** Criteria describe what, not how. Say "user is redirected" not "React Router navigates to /dashboard."
3. **Include edge cases.** Cover invalid input, unauthorized access, empty states, and error conditions.
4. **Be measurable.** Where performance matters, include specific thresholds (e.g., "within 2 seconds").
5. **Keep the count manageable.** A feature with more than 8 acceptance criteria may need to be split into sub-features.

---

## 5. Complexity Estimation Guide

| Complexity | Characteristics | Typical Scope |
|------------|----------------|---------------|
| low | Single module, straightforward CRUD, minimal UI | 1-2 API endpoints, 1-2 pages |
| medium | Multiple modules, business logic, moderate UI | 3-5 API endpoints, 2-4 pages |
| high | Cross-cutting concerns, complex state, advanced UI | 5+ API endpoints, complex interactions |

### Complexity Red Flags

Consider splitting a feature if it exhibits any of the following:

- More than 8 acceptance criteria.
- Touches more than 3 distinct modules or layers.
- Requires both frontend and backend architectural decisions.
- Involves third-party service integration AND non-trivial business logic.
- Contains both real-time and batch processing requirements.
- Needs new infrastructure (e.g., message queue, search index) AND application logic.

### Estimation Consistency Rules

- If a feature is marked as "low" complexity, it should not have more than 5 acceptance criteria.
- If a feature is marked as "high" complexity, it should have a clear justification (e.g., "involves payment processing with webhook handling and idempotency").
- When in doubt, estimate higher -- it is better to over-allocate than to under-allocate.

---

## 6. Dependency Graph Rules

These rules ensure the feature dependency graph is valid and buildable.

1. **F-001 has zero dependencies.** The first feature is always infrastructure or project setup. It must be buildable from scratch with no preconditions.

2. **No circular dependencies.** Dependencies MUST form a directed acyclic graph (DAG). If A depends on B and B depends on A, restructure the features.

3. **Minimal dependency sets.** Each feature should depend only on the features it directly needs. Do not add transitive dependencies explicitly. If F-003 depends on F-002 and F-002 depends on F-001, then F-003 does NOT need to list F-001 as a dependency.

4. **Auth comes early.** Most features depend on authentication. Place auth-related features (registration, login, session management) as early in the graph as possible, typically F-002.

5. **Data model before display.** Features that create or define data entities must precede features that display, search, or manipulate that data.

6. **Infrastructure before everything.** Database setup, project scaffolding, CI/CD configuration, and environment setup belong in F-001.

7. **Independent features can be parallel.** If two features share no dependencies on each other, they can be built in parallel. The dependency graph should reflect this by not artificially linking them.

### Validation Checklist

- [ ] F-001 has an empty dependency list.
- [ ] No feature depends on itself.
- [ ] No circular dependency chains exist.
- [ ] Every feature ID referenced in a dependency list is defined in the plan.
- [ ] The graph can be topologically sorted (i.e., there exists a valid build order).

---

## 7. Session Granularity Decision Rules

Session granularity determines whether a feature is implemented in a single coding session or split across multiple sub-feature sessions.

### Decision Table

| Condition | Granularity | Notes |
|-----------|-------------|-------|
| Acceptance criteria <= 5 | `feature` | Single session can handle it |
| Acceptance criteria 6-8 | `feature` or `auto` | Use judgment based on complexity |
| Acceptance criteria > 8 | `auto` | Define sub_features |
| Touches <= 2 modules | `feature` | Focused enough for one session |
| Touches 3+ modules | `auto` | Split by module boundary |
| Complexity "low" | `feature` | Always single session |
| Complexity "high" + many criteria | `auto` | Always consider splitting |

### Sub-Feature Naming Convention

When using `auto` granularity with sub-features, name each sub-feature with the parent feature ID as a prefix:

```
F-003-A: Backend API for [entity] CRUD
F-003-B: Frontend UI for [entity] management
F-003-C: Integration tests for [entity] workflows
```

### Sub-Feature Design Principles

1. **Independently testable.** Each sub-feature should produce a verifiable result on its own. A backend API sub-feature can be tested via API calls without the frontend.

2. **Single concern.** Each sub-feature focuses on one layer or aspect: backend API, frontend UI, data migration, integration, etc.

3. **Clear boundaries.** The interface between sub-features should be well-defined (e.g., API contracts between backend and frontend sub-features).

4. **Ordered when necessary.** Sub-features within a feature may have internal ordering (e.g., backend before frontend), but this should be captured in the sub-feature dependencies.

### When NOT to Split

- If the feature is inherently atomic (e.g., "add a favicon" or "configure environment variables").
- If splitting would create sub-features that are too small to justify a separate session (fewer than 2 acceptance criteria each).
- If the feature involves tightly coupled frontend and backend logic where splitting would require extensive mocking.
