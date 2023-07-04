import * as core from "@actions/core";
const { context, getOctokit } = require('@actions/github');
import { exec } from "@actions/exec";
import run, { ExecFunction } from "./scripts/pull-request";

try {
  const wsDir: string = core.getInput("ws-dir") || process.env.WSDIR || "./";
  const stdExec: ExecFunction = (command: string, options?: {cwd: string}): Promise<number> => exec(command, [], options);
  const laneName = `pr-${context?.payload?.pull_request?.number.toString()}` || "pr-testlane";
  
  run(stdExec, laneName, wsDir).then((): void => {
    const githubToken = process.env.GITHUB_TOKEN;
    const octokit = getOctokit(githubToken);
    const { owner, repo } = context.repo;
    const prNumber = context.payload.pull_request.number;
    const laneLink = `https://bit.cloud/${process.env.ORG}/${process.env.SCOPE}/~lane/${laneName}`
    const commentBody = `Link to lane: ${laneLink}`;
    octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody
    });
  });
} catch (error) {
  core.setFailed((error as Error).message);
}
