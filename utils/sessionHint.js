// Pista local de "esta persona tenía sesión iniciada". Las rutas públicas (/ y /login) esperaban a que
// Firebase Auth terminara de inicializar antes de dibujar nada (varios segundos en un celular con 4G);
// si ya consta que no había sesión, no hay nada que esperar. Con sesión previa, o sin dato todavía
// (primera visita o usuarios de antes de esta pista), se sigue esperando para no mostrar el landing un
// instante antes de entrar. Es solo una pista de UI: la sesión real la decide Firebase.
const KEY = 'scl.hadSession';

export function readSessionHint(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(KEY) !== '0';
  } catch {
    return true; // sin storage, el comportamiento seguro es esperar a Auth como antes
  }
}

export function writeSessionHint(hasSession, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, hasSession ? '1' : '0');
  } catch {
    // storage bloqueado: solo se pierde el atajo
  }
}
