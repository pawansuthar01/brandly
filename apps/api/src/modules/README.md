# Domain modules

Each domain module owns its controller, DTOs, service, repository/query code,
and tests. Keep cross-cutting concerns in `src/common`; do not create a second
store or place business logic in `main.ts`.
