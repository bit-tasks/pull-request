export type ExecFunction = (command: string, options?: {cwd: string}) => Promise<number>;

const run: (exec: ExecFunction, laneName: string, wsdir: string) => Promise<void> = async (exec, lane, wsdir) => {
  await exec('bit status --strict', { cwd: wsdir });
  await exec('bit build', { cwd: wsdir });

  await exec(`bit lane create PR#-${lane}`, { cwd: wsdir });
  await exec('bit snap -m "CI"', { cwd: wsdir });
  await exec('bit export', { cwd: wsdir });
}

export default run;
