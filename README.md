# Kubernetes IAM Extension for Podman Desktop

A Podman Desktop extension for managing Kubernetes RBAC resources (Roles, RoleBindings, ClusterRoles, ClusterRoleBindings) across contexts.

## Features

- View and manage Kubernetes Roles and ClusterRoles
- View and manage RoleBindings and ClusterRoleBindings
- Create, edit, and delete RBAC resources through a user-friendly interface
- Multi-context support

## Installation

Install the extension in Podman Desktop using one of the following OCI images:

| Channel | Image | Description |
|---------|-------|-------------|
| Release | `ghcr.io/feloy/podman-desktop-extension-kubernetes-iam:latest` | Latest stable release |
| Release (pinned) | `ghcr.io/feloy/podman-desktop-extension-kubernetes-iam:<version>` | Specific release version |
| Development | `ghcr.io/feloy/podman-desktop-extension-kubernetes-iam:next` | Latest build from `main` branch |
| Pull Request | `ghcr.io/feloy/podman-desktop-extension-kubernetes-iam/pr:<commit-sha>` | Build from a specific PR |

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
