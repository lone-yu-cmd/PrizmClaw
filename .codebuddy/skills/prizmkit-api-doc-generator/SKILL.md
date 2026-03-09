---
name: prizmkit-api-doc-generator
tier: 2
description: [Tier 2] Extract API documentation from source code into OpenAPI/Markdown. May miss undocumented or dynamically generated endpoints. (project)
---

# PrizmKit API Doc Generator

Generate API documentation from source code by scanning routes, controllers, and handlers. Produces OpenAPI 3.0 specs or Markdown reference docs.

## Commands

### prizmkit.api-docs [api-directory]

Generate API documentation from source code.

**STEPS:**

1. Read `.prizm-docs/` for project tech stack (framework, language, API style: REST / GraphQL / gRPC)
2. Scan API source files (routes, controllers, handlers):
   - Detect routing patterns based on framework:
     - Express/Fastify: `app.get()`, `router.post()`, etc.
     - Django/Flask: `@app.route()`, `urlpatterns`
     - Spring: `@GetMapping`, `@PostMapping`, etc.
     - Go: `http.HandleFunc`, gorilla/mux, chi routes
   - If `api-directory` is specified, limit scan to that directory
3. Extract for each endpoint:
   - **HTTP method and path**: GET /api/users/:id
   - **Request parameters**:
     - Path parameters (with types)
     - Query parameters (with types and defaults)
     - Request body schema (from types, validation decorators, or inline definitions)
   - **Response body schemas**: Success and error response structures
   - **Authentication requirements**: Which auth mechanism is required (JWT, API key, session, none)
   - **Error responses**: Common error codes and their meanings (400, 401, 403, 404, 500)
   - **Description**: From JSDoc comments, docstrings, or function/handler names
4. Generate documentation in requested format:
   - **OpenAPI 3.0 YAML** (default): Full spec with schemas, security definitions, and server info
   - **Markdown API reference**: Human-readable endpoint documentation
   - **Both**: Generate both formats
5. Include examples for each endpoint:
   - Sample request (curl command)
   - Sample success response (JSON)
   - Sample error response (JSON)
6. Write to `docs/api/` directory:
   - `docs/api/openapi.yaml` for OpenAPI spec
   - `docs/api/API_REFERENCE.md` for Markdown docs

## Path References

All internal asset paths MUST use `${SKILL_DIR}` placeholder for cross-IDE compatibility.

## Output

- `docs/api/openapi.yaml`: OpenAPI 3.0 specification
- `docs/api/API_REFERENCE.md`: Markdown API reference
