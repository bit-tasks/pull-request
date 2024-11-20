import { getHelloWorld } from '@bit-tasks/test-scope.get-hello-world';

/**
 * renders a "hello world" text 1
 */

export function HelloWorld() {
  return <div>{getHelloWorld()}</div>;
}
