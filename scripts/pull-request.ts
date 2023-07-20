import { exec } from "@actions/exec";

const run = async (laneName: string, wsdir: string) => {
  const org = process.env.ORG;
  const scope = process.env.SCOPE;

  try {
    await exec(
      `bit lane remove ${org}.${scope}/${laneName} --remote --silent`,
      [],
      { cwd: wsdir }
    );
  } catch (error) {
    console.error(
      `Error while removing bit lane: ${error}. Lane may not exist`
    );
  }

  await exec("bit status --strict", [], { cwd: wsdir });
  await exec(`bit lane create ${laneName}`, [], { cwd: wsdir });
  await exec('bit snap -m "CI"', [], { cwd: wsdir });
  await exec("bit export", [], { cwd: wsdir });
};

export default run;
