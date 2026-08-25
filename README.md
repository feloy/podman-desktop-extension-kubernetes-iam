# Kubernetes IAM Extension for Podman Desktop

A Podman Desktop extension for managing Kubernetes RBAC resources (Roles, RoleBindings, ClusterRoles, ClusterRoleBindings) across contexts.

## Features

- View and manage Kubernetes Roles and ClusterRoles
- View and manage RoleBindings and ClusterRoleBindings
- Create, edit, and delete RBAC resources through a user-friendly interface
- Multi-context support

## Development

### Prerequisites

- Node.js >= 24.0.0
- pnpm 11.16.0

### Build

```bash
pnpm install
pnpm build
```

### Test

```bash
pnpm test
```

### Watch

```bash
pnpm watch
```

## License

Apache License 2.0
