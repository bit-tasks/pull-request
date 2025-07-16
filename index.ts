import * as core from "@actions/core";
import { context } from "@actions/github";
import run from "./scripts/pull-request";

try {
  const githubToken = process.env.GITHUB_TOKEN;
  const wsDir: string = core.getInput("ws-dir") || process.env.WSDIR || "./";
  const build: boolean = core.getInput("build") === "true" ? true : false;
  const strict: boolean = core.getInput("strict") === "true" ? true : false;

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
  run(githubToken, repo, owner, prNumber, laneName, wsDir, args, build, strict);
} catch (error) {
  core.setFailed((error as Error).message);
}
