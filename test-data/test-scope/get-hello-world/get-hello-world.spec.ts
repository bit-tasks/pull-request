import { getHelloWorld } from './get-hello-world.js';

it('returns the greeting with the default language', () => {
  expect(getHelloWorld()).toBe('Hello world!');
});

it('returns the a greeting in spanish', () => {
  expect(getHelloWorld('es')).toBe('¡Hola mundo!');
});