# Kubernetes IAM Extension for Podman Desktop

A Podman Desktop extension for managing Kubernetes cluster users and their role assignments.

Users are not managed directly by the cluster, but they are referenced in RoleBinding and ClusterRoleBinding resources. This extension extracts user information from these bindings and provides a convenient interface to manage role assignments.

## Features

- List all users referenced in RoleBindings and ClusterRoleBindings across the cluster
- Click on a user to view and manage their Roles and ClusterRoles assignments
- Build kubeconfig files for users

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
