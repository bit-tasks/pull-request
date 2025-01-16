/* a greeting language */
type Language = 'en' | 'es';

/**
 * returns a 'hello world' message, in different languages 1
 */
export function getHelloWorld(language: Language = 'en') {
  if (language === 'es') return '¡Hola mundo!';
  return 'Hello world!';
}
