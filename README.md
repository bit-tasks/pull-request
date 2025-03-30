# Verify Components in a Pull Request for CI/CD Pipelines

Verify the pull request along with the modifications for the Bit components.

# GitHub Actions

This task creates a Bit lane and adds the component changes for you to verify any components inside a Pull request.

## Inputs

### `ws-dir`

**Optional** The workspace directory path from the root. Default `"Dir specified in Init Task or ./"`.

### `version-labels`

**Optional:** When set to `true`, this task automatically creates the labels `component-name@major`, `component-name@minor` and `component-name@patch` in the repository for all new and modified components. The default value is `false`. Available in `bit-tasks/pull-request@v2` and later versions.

By default, the label is automatically created in the format `component-name@<version>`. The complete component ID, including the organization and scope (e.g., `bit-tasks.test-scope/ui/hello-world`), is added to the label description. You can add these labels in the Pull Request to control version bumping:

- `component-name@patch` - Forces a patch version bump.
- `component-name@minor` - Forces a minor version bump.
- `component-name@major` - Forces a major version bump.

When modifying or creating labels manually, supported version keywords for component-specific labels are: `major`, `minor`, and `patch`.

#### Example:

- By default, the `patch` label is automatically added as: `ui/button@patch`.
- It can be modified manually to force a minor version bump: `ui/button@minor`.

#### Global Version Overrides

You can create global version labels by adding the label directly enclosed within square brackets (e.g., `[major]`). Supported global version keywords are: `[major]`, `[minor]`, `[patch]`, and `pre-release:<flag>` (e.g., `pre-release:beta`).

**Note:** If you are creating component labels manually, ensure that both the component version (`component-name@<version>`) and the complete component ID (`org.scope/<component-id>`, e.g., `bit-tasks.test-scope/ui/hello-world`) are added as the `name` and `description` of the Pull Request label.

### `version-labels-color-major`

**Optional** Use this parameter to define the color of automatically created major version labels in hexadecimal format (without the`#` prefix). The default value is `f0a09f` (a shade of purple). This is also available in bit-tasks/pull-request@v2 and later versions.

### `version-labels-color-minor`

**Optional** Use this parameter to define the color of automatically created minor version labels in hexadecimal format (without the`#` prefix). The default value is `f0e8bd` (a shade of purple). This is also available in bit-tasks/pull-request@v2 and later versions.

### `version-labels-color-patch`

**Optional** Use this parameter to define the color of automatically created patch version labels in hexadecimal format (without the`#` prefix). The default value is `c2e0c6` (a shade of purple). This is also available in bit-tasks/pull-request@v2 and later versions.

For example:

```
- name: Bit Pull Request
  uses: bit-tasks/pull-request@v2
  with:
    version-labels: true
    version-labels-color-major: 'C2E0C6'
```

### `clear-labels`

**Optional** When set to `true`, this task automatically removes all Bit labels from the repository. The default value is `false`.

## Example usage

**Note:** Use `bit-task/init@v1` as a prior step in your action before running `bit-tasks/pull-request@v2`.

```yaml
name: Test Bit Pull Request
on:
  pull_request:
    types:
      - opened
      - synchronize
permissions:
  pull-requests: write
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      GIT_USER_NAME: ${{ secrets.GIT_USER_NAME }}
      GIT_USER_EMAIL: ${{ secrets.GIT_USER_EMAIL }}
      BIT_CONFIG_ACCESS_TOKEN: ${{ secrets.BIT_CONFIG_ACCESS_TOKEN }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
      - name: Initialize Bit
        uses: bit-tasks/init@v1
        with:
          ws-dir: "<WORKSPACE_DIR_PATH>"
      - name: Bit Pull Request
        uses: bit-tasks/pull-request@v2
        with:
          version-labels: true # Optional: Add version labels to PR
```

# Contributor Guide

Steps to create custom tasks in different CI/CD platforms.

## GitHub Actions

Go to the GithHub action task directory and build using NCC compiler. For example;

```
npm install
npm run build
git commit -m "Update task"
git tag -a -m "action release" v2 --force
git push --follow-tags
```

For more information, refer to [Create a javascript action](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action)
