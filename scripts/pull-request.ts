import { exec, ExecOptions } from "@actions/exec";
import { getOctokit } from "@actions/github";
import * as core from "@actions/core";

const run = async (
  githubToken: string,
  repo: string,
  owner: string,
  prNumber: number,
  prAction: string,
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
      console.log(
        `Cannot remove bit lane: ${error}. Lane may not exist`
      );
    }
    await exec("bit export", [], { cwd: wsdir });

    const laneLink = `https://new.bit.cloud/${process.env.ORG}/${process.env.SCOPE}/~lane/${laneName}`;
    commentBody = `⚠️ Please review the changes in the Bit lane: ${laneLink}`;
  } else {
    commentBody = `No component was added or modified in the pull request!`;
    core.info(commentBody);
  }

  const octokit = getOctokit(githubToken);

  if(prAction === 'opened'){
    octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });
  }

};

export default run;
