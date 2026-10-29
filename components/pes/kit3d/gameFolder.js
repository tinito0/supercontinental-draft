// Read-only access to the user's PES 2021 folder (or its content/kit-server folder) for the kit preview.
// Chrome/Edge: File System Access API, the folder handle is remembered in IndexedDB and files are
// read on demand. Other browsers: a folder <input> (webkitdirectory) indexed in memory for the session.
// Nothing read here is uploaded unless the user presses "Compartir texturas" in the viewer.
import { KIT_SERVER_DIR } from '../../../pes/kits/textureLocator.js';

const DB = 'pes-game-folder', STORE = 'handles', KEY = 'root';
let readerStamp = 0; // a new folder → new provider id, so cached lookups of the previous folder are not reused

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { open.result.close(); resolve(req?.result); };
      tx.onerror = () => { open.result.close(); reject(tx.error); };
    };
  });
}

export const canPickFolder = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/** Reader over a FileSystemDirectoryHandle: read(relPath) → Uint8Array | null. */
function handleReader(root) {
  const dirs = new Map([['', root]]);
  async function dir(path) {
    if (dirs.has(path)) return dirs.get(path);
    const i = path.lastIndexOf('/');
    const parent = await dir(i < 0 ? '' : path.slice(0, i));
    let h = null;
    if (parent) { try { h = await parent.getDirectoryHandle(path.slice(i + 1)); } catch { h = null; } }
    dirs.set(path, h);
    return h;
  }
  return {
    name: root.name,
    async read(rel) {
      const i = rel.lastIndexOf('/');
      const d = await dir(i < 0 ? '' : rel.slice(0, i));
      if (!d) return null;
      try { return new Uint8Array(await (await (await d.getFileHandle(rel.slice(i + 1))).getFile()).arrayBuffer()); } catch { return null; }
    },
  };
}

/** Reader over the File list of a folder <input>; paths are matched case-insensitively. */
export function filesReader(fileList) {
  const files = [...fileList];
  const top = files[0]?.webkitRelativePath.split('/')[0] || '';
  const byPath = new Map(files.map(f => [f.webkitRelativePath.split('/').slice(1).join('/').toLowerCase(), f]));
  return {
    name: top,
    async read(rel) {
      const f = byPath.get(rel.toLowerCase());
      return f ? new Uint8Array(await f.arrayBuffer()) : null;
    },
  };
}

/**
 * Kit-server reader: readKit(kit-server relative path). The chosen folder may be the game folder
 * (content/kit-server/map.txt inside) or the kit-server folder itself (map.txt at its root).
 */
export async function kitServerReader(reader) {
  let prefix = null;
  if (await reader.read(`${KIT_SERVER_DIR}/map.txt`)) prefix = `${KIT_SERVER_DIR}/`;
  else if (await reader.read('map.txt')) prefix = '';
  return {
    name: reader.name,
    kind: prefix === null ? 'unknown' : prefix ? 'game' : 'kit-server',
    readKit: prefix === null ? async () => null : rel => reader.read(prefix + rel),
    read: true,
    stamp: ++readerStamp,
  };
}

/** Asks for the game or kit-server folder (Chrome/Edge) and remembers it. */
export async function pickGameFolder() {
  const root = await window.showDirectoryPicker({ id: 'pes2021', mode: 'read' });
  await idb('readwrite', s => s.put(root, KEY));
  return kitServerReader(handleReader(root));
}

/** The remembered folder, if the browser still grants read access without a prompt. */
export async function rememberedGameFolder({ prompt = false } = {}) {
  if (!canPickFolder()) return null;
  let root;
  try { root = await idb('readonly', s => s.get(KEY)); } catch { return null; }
  if (!root) return null;
  let state = await root.queryPermission({ mode: 'read' });
  if (state !== 'granted' && prompt) state = await root.requestPermission({ mode: 'read' });
  return state === 'granted' ? kitServerReader(handleReader(root)) : { pending: true, name: root.name };
}

export const readerFromFiles = fileList => kitServerReader(filesReader(fileList));
