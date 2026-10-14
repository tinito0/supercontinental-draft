import { writeBatch } from 'firebase/firestore';

export const FIRESTORE_BATCH_LIMIT = 450;

export async function commitBatchOperations(db, operations, onProgress) {
  const total = operations.length;
  for (let i = 0; i < total; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + FIRESTORE_BATCH_LIMIT);
    chunk.forEach(operation => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      if (operation.type === 'set') batch.set(operation.ref, operation.data, operation.options || {});
    });
    await batch.commit();
    if (typeof onProgress === 'function') {
      onProgress(Math.min(i + chunk.length, total), total);
    }
  }
}

export default commitBatchOperations;
