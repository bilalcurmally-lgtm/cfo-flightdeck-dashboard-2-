import {
  createInMemoryWorkspaceStore,
  WORKSPACE_SNAPSHOT_VERSION,
  type WorkspaceSnapshot,
  type WorkspaceStore,
} from "./workspace-store";

const DEFAULT_DB_NAME = "billu-workspace";
const OBJECT_STORE_NAME = "workspace";
const SNAPSHOT_KEY = "snapshot";
const DB_VERSION = 1;

export interface DurableWorkspaceStore {
  store: WorkspaceStore;
  durable: boolean;
}

export interface CreateIndexedDbWorkspaceStoreOptions {
  factory?: IDBFactory;
  dbName?: string;
}

function emptySnapshot(): WorkspaceSnapshot {
  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    categoryOverrides: {},
    decisions: {},
    imports: [],
  };
}

function isValidSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const snap = value as WorkspaceSnapshot;
  return (
    typeof snap.version === "number" &&
    snap.categoryOverrides !== null &&
    typeof snap.categoryOverrides === "object" &&
    snap.decisions !== null &&
    typeof snap.decisions === "object"
  );
}

function openDatabase(factory: IDBFactory, dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = factory.open(dbName, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          db.createObjectStore(OBJECT_STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to open IndexedDB"));
      };

      request.onblocked = () => {
        reject(new Error("IndexedDB open blocked"));
      };
    } catch (error) {
      reject(error);
    }
  });
}

function readSnapshot(db: IDBDatabase): Promise<WorkspaceSnapshot> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(OBJECT_STORE_NAME, "readonly");

      tx.onerror = () => {
        resolve(emptySnapshot());
      };

      const objectStore = tx.objectStore(OBJECT_STORE_NAME);
      const request = objectStore.get(SNAPSHOT_KEY);

      request.onsuccess = () => {
        const value = request.result;
        resolve(isValidSnapshot(value) ? value : emptySnapshot());
      };

      request.onerror = () => {
        resolve(emptySnapshot());
      };
    } catch {
      resolve(emptySnapshot());
    }
  });
}

function writeSnapshot(db: IDBDatabase, snapshot: WorkspaceSnapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(OBJECT_STORE_NAME, "readwrite");

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        reject(tx.error ?? new Error("IndexedDB transaction failed"));
      };

      const objectStore = tx.objectStore(OBJECT_STORE_NAME);
      const request = objectStore.put(snapshot, SNAPSHOT_KEY);

      request.onerror = () => {
        reject(request.error ?? new Error("IndexedDB put failed"));
      };
    } catch (error) {
      reject(error);
    }
  });
}

function wrapWithWriteThrough(
  mirror: WorkspaceStore,
  persist: (snapshot: WorkspaceSnapshot) => Promise<void>,
): WorkspaceStore {
  let persistQueue = Promise.resolve();

  const enqueuePersist = () => {
    const snapshot = mirror.snapshot();
    persistQueue = persistQueue
      .then(() => persist(snapshot))
      .catch(() => {
        // Write-through failures must not surface to callers.
      });
  };

  return {
    getCategoryOverride(signature) {
      return mirror.getCategoryOverride(signature);
    },

    setCategoryOverride(signature, override) {
      mirror.setCategoryOverride(signature, override);
      enqueuePersist();
    },

    clearCategoryOverride(signature) {
      mirror.clearCategoryOverride(signature);
      enqueuePersist();
    },

    getDecision(signature) {
      return mirror.getDecision(signature);
    },

    setDecision(signature, decision) {
      mirror.setDecision(signature, decision);
      enqueuePersist();
    },

    clearDecision(signature) {
      mirror.clearDecision(signature);
      enqueuePersist();
    },

    snapshot() {
      return mirror.snapshot();
    },

    load(snapshot) {
      mirror.load(snapshot);
      enqueuePersist();
    },

    addImport(snapshot, options) {
      mirror.addImport(snapshot, options);
      enqueuePersist();
    },
  };
}

export async function createIndexedDbWorkspaceStore(
  options?: CreateIndexedDbWorkspaceStoreOptions,
): Promise<DurableWorkspaceStore> {
  const factory =
    options?.factory ?? (typeof indexedDB !== "undefined" ? indexedDB : undefined);
  const dbName = options?.dbName ?? DEFAULT_DB_NAME;

  if (!factory) {
    return {
      store: createInMemoryWorkspaceStore(),
      durable: false,
    };
  }

  try {
    const db = await openDatabase(factory, dbName);
    const initial = await readSnapshot(db);
    const mirror = createInMemoryWorkspaceStore(initial);
    const store = wrapWithWriteThrough(mirror, (snapshot) => writeSnapshot(db, snapshot));

    return { store, durable: true };
  } catch {
    return {
      store: createInMemoryWorkspaceStore(),
      durable: false,
    };
  }
}