import * as core from "@actions/core";
import { context } from "@actions/github";
import run from "./scripts/pull-request";

try {
  const githubToken = process.env.GITHUB_TOKEN;
  const wsDir: string = core.getInput("ws-dir") || process.env.WSDIR || "./";
  const versionLabels: boolean = core.getInput("version-labels") === "true" ? true : false;
  const versionLabelsColors = {
    major:  core.getInput("version-labels-color-major"),
    minor:  core.getInput("version-labels-color-minor"),
    patch:  core.getInput("version-labels-color-patch")
  };
  const args = process.env.LOG ? [`--log=${process.env.LOG}`] : [];
  const prNumber = context?.payload?.pull_request?.number;
  const { owner, repo } = context?.repo;

  if (!githubToken) {
    throw new Error("GitHub token not found");
  }

  if (!prNumber) {
    throw new Error("Pull Request number is not found");
  }

  const laneName = `pr-${prNumber?.toString()}`;
  run(githubToken, repo, owner, prNumber, laneName, versionLabels, versionLabelsColors, wsDir, args);
} catch (error) {
  core.setFailed((error as Error).message);
}
