import { getHelloWorld } from '@bit-tasks/test-scope.get-hello-world';

/**
 * renders a "hello world"
 */

export function HelloWorld() {
  return <div>{getHelloWorld()}</div>;
}
