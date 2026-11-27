import { useCallback, useEffect, useRef, useState } from 'react';
import { saveLineup } from '../services/lineupService.js';
import { checkBench, benchBlockMessage } from '../utils/squadRules.js';
import { SAVE_STATUS, isBenchBlock, lineupSaveErrorMessage } from '../components/formation/boardSaveState.js';

// Wait after the last change before saving on its own (a burst of changes = one write).
const AUTOSAVE_DELAY_MS = 700;
const SAVED_VISIBLE_MS = 2500;

/**
 * The board's save cycle: autosave after each edit, «Guardar ahora», retry, and the flush before closing or sharing.
 * Saves go through the market function (services/lineupService.js); the client bench check only answers fast.
 * Edit handlers call `markPending()`; the autosave starts when one of `changeDeps` changes after that.
 * `problem` ({ tone, message }) stays until a save succeeds, so it does not blink while the next edit is pending.
 * @param {{ buildPayload: () => object, cart: object[], benchMin: number, showStatusMessage?: Function,
 *   onSaved: (result: object) => void, changeDeps: unknown[] }} options
 */
export function useLineupSave({ buildPayload, cart, benchMin, showStatusMessage, onSaved, changeDeps }) {
  const [status, setStatus] = useState(SAVE_STATUS.idle);
  const [problem, setProblem] = useState(null);
  const pendingRef = useRef(false);
  const timerRef = useRef(null);
  const savedTimerRef = useRef(null);
  const chainRef = useRef(Promise.resolve(true));
  const inFlightRef = useRef(0);
  const lastBlockRef = useRef(null);
  const problemRef = useRef(problem);
  problemRef.current = problem;
  const latest = useRef({});
  latest.current = { buildPayload, cart, benchMin, showStatusMessage, onSaved };

  const markPending = useCallback(() => { pendingRef.current = true; }, []);

  const runSave = useCallback(async ({ manual }) => {
    const { buildPayload: build, cart: squad, benchMin: min, showStatusMessage: notify, onSaved: done } = latest.current;
    const payload = build();
    const bench = checkBench(squad || [], payload.lineup, { benchMin: min });
    if (bench.applies && !bench.ok) {
      const message = benchBlockMessage(bench);
      if (manual || lastBlockRef.current !== message) notify?.('error', `Este once no se va a guardar. ${message}`);
      lastBlockRef.current = message;
      setProblem({ tone: 'warning', message });
      setStatus(SAVE_STATUS.blocked);
      return false;
    }
    setStatus(SAVE_STATUS.saving);
    inFlightRef.current += 1;
    try {
      const result = await saveLineup(payload);
      lastBlockRef.current = null;
      setProblem(null);
      done?.(result);
      if (manual) notify?.('success', 'Táctica guardada.');
      setStatus(timerRef.current ? SAVE_STATUS.pending : SAVE_STATUS.saved);
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setStatus(s => (s === SAVE_STATUS.saved ? SAVE_STATUS.idle : s)), SAVED_VISIBLE_MS);
      return true;
    } catch (error) {
      console.error('Error al guardar la táctica:', error);
      const message = lineupSaveErrorMessage(error);
      const blocked = isBenchBlock(error);
      if (!blocked || manual || lastBlockRef.current !== message) notify?.('error', blocked ? `Este once no se va a guardar. ${message}` : `Error al guardar la táctica: ${message}`);
      lastBlockRef.current = blocked ? message : null;
      setProblem({ tone: blocked ? 'warning' : 'danger', message, canRetry: !blocked });
      setStatus(blocked ? SAVE_STATUS.blocked : SAVE_STATUS.error);
      return false;
    } finally {
      inFlightRef.current -= 1;
    }
  }, []);

  // Saves run one after another, so a slow request never lands after a newer one.
  const enqueue = useCallback(options => {
    chainRef.current = chainRef.current.then(() => runSave(options), () => runSave(options));
    return chainRef.current;
  }, [runSave]);

  useEffect(() => {
    if (!pendingRef.current) return;
    pendingRef.current = false;
    setStatus(SAVE_STATUS.pending);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      enqueue({ manual: false });
    }, AUTOSAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- changeDeps is the caller's list of board values
  }, changeDeps);

  /** Saves now whatever is on the board; resolves true when the server has it. */
  const saveNow = useCallback(({ manual = true } = {}) => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    return enqueue({ manual });
  }, [enqueue]);

  /** Before closing or sharing: saves pending edits; resolves false while the board is still not saved. */
  const flush = useCallback(async () => {
    if (timerRef.current || pendingRef.current) return saveNow({ manual: false });
    const ok = await chainRef.current.catch(() => false);
    return ok !== false && !problemRef.current;
  }, [saveNow]);

  // Closing the board with an autosave waiting still sends it.
  useEffect(() => () => {
    clearTimeout(savedTimerRef.current);
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    runSave({ manual: false });
  }, [runSave]);

  /** An edit waits or a save is in flight: a snapshot from another device must not replace the board now. */
  const isBusy = useCallback(() => Boolean(timerRef.current || pendingRef.current || inFlightRef.current), []);

  return { status, problem, markPending, saveNow, flush, isBusy };
}
