import { exec } from "@actions/exec";
import { getOctokit } from "@actions/github";
import * as core from "@actions/core";
import { scopeQuery } from "./graphql";

const createSnapMessageText = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number
) => {
  const octokit = getOctokit(githubToken);

  let messageText = "CI";

  const { data: pr } = await octokit.rest.pulls.get({
    owner: owner,
    repo: repo,
    pull_number: prNumber,
  });

  const prTitle = pr.title;
  core.info("PR title: " + prTitle);

  if (prTitle) {
    messageText = prTitle;
  } else {
    const { data: commits } = await octokit.rest.pulls.listCommits({
      owner: owner,
      repo: repo,
      pull_number: prNumber,
    });

    if (commits.length > 0) {
      messageText = commits[commits.length - 1].commit.message;
      core.info("Last commit message: " + messageText);
    }
  }

  core.info("Snap message Text: " + messageText);
  return messageText;
};

const postOrUpdateComment = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  laneName: string
) => {
  const laneLink = `https://bit.cloud/${process.env.ORG}/${process.env.SCOPE}/~lane/${laneName}`;
  let commentIntro = `⚠️ Please review the changes in the Bit lane: ${laneLink}`;

  const octokit = getOctokit(githubToken);
  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existingComment = comments.data.find(
    (comment) =>
      comment.body?.includes("https://bit.cloud") &&
      comment.user?.login === "github-actions[bot]"
  );

  if (existingComment) {
    const updatedBody = `${commentIntro}\n\n_Lane updated: ${getHumanReadableTimestamp()}_`;
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: updatedBody,
    });
  } else {
    const newBody = `${commentIntro}\n\n_Lane created: ${getHumanReadableTimestamp()}_`;
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: newBody,
    });
  }
};

const getHumanReadableTimestamp = () => {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  };

  return new Date().toLocaleString("en-US", options as any) + " UTC";
};

export default async function run(
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  laneName: string,
  wsDir: string,
  args: string[],
  build: boolean,
  strict: boolean
) {
  const org = process.env.ORG;
  const scope = process.env.SCOPE;
  const token = process.env.BIT_CONFIG_USER_TOKEN || "";

  const scopeErrorMessage = `Scope: ${org}.${scope} does not exist or you don't have access to it`;

  try {
    const jsonData = await scopeQuery(`${org}.${scope}`, token);
    if (!jsonData?.data?.getScope?.id) {
      throw new Error(scopeErrorMessage);
    }
  } catch (error) {
    throw new Error(scopeErrorMessage);
  }

  const messageText = await createSnapMessageText(githubToken, repo, owner, prNumber);

  const cliArgs: string[] = [
    "ci",
    "pr",
    "--lane",
    laneName,
    "--message",
    messageText,
  ]

  if (build) {
    cliArgs.push("--build");
  }
  if (strict) {
    cliArgs.push("--strict");
  }

  cliArgs.push(...args);


  await exec(
    "bit",
    cliArgs,
    {
      cwd: wsDir,
    }
  );

  postOrUpdateComment(githubToken, repo, owner, prNumber, laneName);
}
