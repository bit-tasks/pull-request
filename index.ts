import * as core from "@actions/core";
import { context } from "@actions/github";
import { exec } from "@actions/exec";
import run, { ExecFunction } from "./scripts/pull-request";

try {
  const wsDir: string = core.getInput("ws-dir") || process.env.WSDIR || "./";
  const stdExec: ExecFunction = (
    command: string,
    options?: { cwd: string }
  ): Promise<number> => exec(command, [], options);
  const laneName = `pr-${context?.payload?.pull_request?.number}` || "pr-testlane";

  run(stdExec, laneName, wsDir).then((): void => {
    const laneLink = `https://bit.cloud/${process.env.ORG}/${process.env.SCOPE}/~lane/${laneName}`;
    core.setOutput('Bit Lane URL', laneLink);
  });

} catch (error) {
  core.setFailed((error as Error).message);
}
