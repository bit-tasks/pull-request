import { exec, ExecOptions } from "@actions/exec";
import { getOctokit } from "@actions/github";
import * as core from "@actions/core";

const run = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  laneName: string,
  wsdir: string
) => {
  const org = process.env.ORG;
  const scope = process.env.SCOPE;
  let commentBody = "";

  let statusRaw = "";
  const options: ExecOptions = {
    cwd: wsdir,
    listeners: {
      stdout: (data: Buffer) => {
        statusRaw += data.toString();
      },
    },
  };

  await exec("bit status --json", [], options);
  const status = JSON.parse(statusRaw.trim());

  if (status.newComponents?.length || status.modifiedComponents?.length) {
    await exec("bit status --strict", [], { cwd: wsdir });
    await exec(`bit lane create ${laneName}`, [], { cwd: wsdir });
    await exec('bit snap -m "CI"', [], { cwd: wsdir });
    try {
      await exec(
        `bit lane remove ${org}.${scope}/${laneName} --remote --silent`,
        [],
        { cwd: wsdir }
      );
    } catch (error) {
      console.log(`Cannot remove bit lane: ${error}. Lane may not exist`);
    }
    await exec("bit export", [], { cwd: wsdir });

    const laneLink = `https://new.bit.cloud/${process.env.ORG}/${process.env.SCOPE}/~lane/${laneName}`;
    commentBody = `⚠️ Please review the changes in the Bit lane: ${laneLink}`;
  } else {
    commentBody = `No component was added or modified in the pull request!`;
    core.info(commentBody);
  }

  const octokit = getOctokit(githubToken);
  const timestamp = getHumanReadableTimestamp();
  commentBody += `\n\n_Last updated: ${timestamp}_`;

  const comments = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
  });

  const existingComment = comments.data.find(
    (comment) =>
      (comment.body?.startsWith("No component was added or modified") ||
        comment.body?.includes("https://new.bit.cloud")) &&
      comment.user?.login === owner
  );

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: commentBody,
    });
    return;
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
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
    hour12: true,
  };

  return new Date().toLocaleString("en-US", options as any);
};

export default run;
