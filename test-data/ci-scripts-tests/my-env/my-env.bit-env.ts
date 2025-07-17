/**
* This env uses bitdev.react/react-env, inspect it's config and API - https://bit.cloud/bitdev/react/react-env
* Learn more on how you can customize your env here - https://bit.dev/docs/react-env/set-up-your-env
*/
import { ReactEnv } from '@bitdev/react.react-env';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const esmRequire = createRequire(import.meta.url);

export class MyEnv extends ReactEnv {

  /* a shorthand name for the env */
  name = 'my-env';

  /* Typescript config. Learn how to replace compiler - https://bit.dev/reference/compiling/set-up-compiler */
  protected tsconfigPath = esmRequire.resolve('./config/tsconfig.json');

  protected tsTypesPath = './types';

  /* ESLint config. Learn how to replace linter - https://bit.dev/reference/linting/set-up-linter */
  protected eslintConfigPath = esmRequire.resolve('./config/eslintrc.cjs');

  /* Prettier config. Learn how to replace formatter - https://bit.dev/reference/formatting/set-up-formatter */
  protected prettierConfigPath = esmRequire.resolve('./config/prettier.config.cjs');

  /* Vitest config. Learn how to replace tester - https://bit.dev/reference/testing/set-up-tester */
  protected vitestConfigPath = esmRequire.resolve('./config/vitest.config.mjs');

  /* component mounting and dev-server config. Learn how to replace dev-server - https://bit.dev/reference/preview/setup-preview */
  protected previewMounter = esmRequire.resolve('./preview/mounter.js');

  /* component docs template. Learn how to replace dev-server - https://bit.dev/reference/preview/setup-preview */
  protected previewDocsTemplate = esmRequire.resolve('./preview/docs.js');

  /* Vite config for the preview. */
  protected previewViteConfig = esmRequire.resolve('./config/vite.config.mjs');

  protected dirName = dirname(fileURLToPath(import.meta.url));
}

export default new MyEnv();
