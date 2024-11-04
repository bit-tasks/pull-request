import { getHelloWorld } from './get-hello-world.js';

export function GreetsInEnglish() {
  return <div>{getHelloWorld('en')}</div>;
}

export function GreetsInSpanish() {
  return <div>{getHelloWorld('es')}</div>;
}
