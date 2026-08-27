# Kubernetes IAM Extension for Podman Desktop

A Podman Desktop extension for managing Kubernetes cluster users and their role assignments.

Users are not managed directly by the cluster, but they are referenced in RoleBinding and ClusterRoleBinding resources. This extension extracts user information from these bindings and provides a convenient interface to manage role assignments.

## Features

- List all users referenced in RoleBindings and ClusterRoleBindings across the cluster
- Click on a user to view and manage their Roles and ClusterRoles assignments
- Generate client credentials for a user and add them to your local kubeconfig

## Generating credentials for a user

For a given user, the extension can issue a client certificate and register it as a new context in your kubeconfig:

1. A private key and a certificate signing request are generated locally for the user's name.
2. A `CertificateSigningRequest` is created in the cluster, approved, and then deleted once the certificate has been issued.
3. A new user entry and a new context (named after the current context and the user) are appended to the kubeconfig file currently used by Podman Desktop. The existing contexts are left untouched.

The issued certificate is valid for 24 hours by default.

This requires the `openssl` command to be available on your machine, and a cluster user allowed to create and approve `CertificateSigningRequest` resources.

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
