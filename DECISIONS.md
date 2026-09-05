# Architecture Decisions

1. **npm workspaces over Turborepo:** Keeps the initial stack simple, reduces learning curve and overhead, while still providing robust package linking and script running across workspaces.
2. **Non-blocking DB connection on boot:** Health checks must respond even if the database is temporarily unreachable, especially useful during local dev and CI/CD where container startup order varies.
3. **Identical service structure:** Every service shares the same folder structure (controllers, models, routes) to ensure zero cognitive overhead when context switching between microservices.
4. **Shared RBAC Middleware:** Implemented the `requirePermission` middleware as a single shared package (`@college-erp/shared-utils`) rather than duplicating it per service. This prevents security drift. The middleware fetches scope roles dynamically by directly querying the `roleassignments` collection via `mongoose.connection.db`, removing the need for a shared Mongoose schema definition.
