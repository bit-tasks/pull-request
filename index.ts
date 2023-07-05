import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { exec } from "@actions/exec";
import run, { ExecFunction } from "./scripts/pull-request";

try {
  const wsDir: string = core.getInput("ws-dir") || process.env.WSDIR || "./";
  const stdExec: ExecFunction = (
    command: string,
    options?: { cwd: string }
  ): Promise<number> => exec(command, [], options);
  const prNumber = context?.payload?.pull_request?.number;
  const laneName = `pr-${prNumber?.toString()}` || "pr-testlane";

  if (!prNumber) {
    throw new Error("Pull Request number is not found");
  }

  run(stdExec, laneName, wsDir).then((): void => {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error("GitHub token not found");
    }
    const octokit = getOctokit(githubToken);
    const { owner, repo } = context.repo;
    const laneLink = `https://new.bit.cloud/${process.env.ORG}/${process.env.SCOPE}/~lane/${laneName}`;
    const commentBody = `⚠️ Please review the changes in the Bit lane: ${laneLink}`;

    octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });
  });
  
} catch (error) {
  core.setFailed((error as Error).message);
}
