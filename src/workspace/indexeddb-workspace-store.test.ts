import { describe, it, expect } from "vitest";
import { createIndexedDbWorkspaceStore } from "./indexeddb-workspace-store";
import { WORKSPACE_SNAPSHOT_VERSION } from "./workspace-store";

const SIG_A = "txn_aaaaaaaaaaaaaaaa";
const SIG_B = "txn_bbbbbbbbbbbbbbbb";
const OBJECT_STORE_NAME = "workspace";
const SNAPSHOT_KEY = "snapshot";

type FakeRequest<T> = EventTarget & {
  result: T;
  error: DOMException | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  readyState: IDBRequestReadyState;
};

type FakeOpenRequest = FakeRequest<IDBDatabase> & {
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null;
  onblocked: ((event: Event) => void) | null;
};

function createFakeEvent(target: EventTarget): Event {
  return { target } as Event;
}

function createFakeRequest<T>(result: T): FakeRequest<T> {
  return {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
    readyState: "done",
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

function succeedRequest<T>(request: FakeRequest<T>): void {
  queueMicrotask(() => {
    request.onsuccess?.(createFakeEvent(request));
  });
}

function failRequest<T>(request: FakeRequest<T>, message: string): void {
  queueMicrotask(() => {
    request.error = new DOMException(message, "AbortError");
    request.onerror?.(createFakeEvent(request));
  });
}

function createFakeObjectStore(
  storage: Map<string, unknown>,
  failWrites: boolean,
  onTransactionComplete: () => void,
): IDBObjectStore {
  return {
    get(key: IDBValidKey) {
      const request = createFakeRequest(storage.get(String(key)));
      queueMicrotask(() => {
        request.onsuccess?.(createFakeEvent(request));
      });
      return request as IDBRequest;
    },

    put(value: unknown, key?: IDBValidKey) {
      const request = createFakeRequest<IDBValidKey>(key ?? SNAPSHOT_KEY);

      if (failWrites) {
        failRequest(request, "write rejected");
      } else {
        storage.set(String(key ?? SNAPSHOT_KEY), value);
        queueMicrotask(() => {
          request.onsuccess?.(createFakeEvent(request));
          onTransactionComplete();
        });
      }

      return request as IDBRequest;
    },
  } as IDBObjectStore;
}

function createFakeDatabase(
  storage: Map<string, unknown>,
  failWrites: boolean,
  onWriteComplete: () => void,
): IDBDatabase {
  const objectStoreNames = {
    contains(name: string) {
      return name === OBJECT_STORE_NAME;
    },
  };

  return {
    objectStoreNames,
    transaction(_storeNames: string | string[], _mode?: IDBTransactionMode) {
      let txOnComplete: (() => void) | null = null;
      let txOnError: (() => void) | null = null;

      const tx = {
        objectStore(name: string) {
          if (name !== OBJECT_STORE_NAME) {
            throw new DOMException("Object store not found", "NotFoundError");
          }
          return createFakeObjectStore(storage, failWrites, () => {
            if (!failWrites) {
              txOnComplete?.();
              onWriteComplete();
            } else {
              txOnError?.();
            }
          });
        },
        get oncomplete() {
          return txOnComplete;
        },
        set oncomplete(handler: (() => void) | null) {
          txOnComplete = handler;
        },
        get onerror() {
          return txOnError;
        },
        set onerror(handler: (() => void) | null) {
          txOnError = handler;
        },
      } as IDBTransaction;

      return tx;
    },
    close() {},
  } as unknown as IDBDatabase;
}

function createFakeIdbFactory(options?: { failOpen?: boolean; failWrites?: boolean }) {
  const databases = new Map<string, Map<string, unknown>>();
  let writeChain = Promise.resolve();

  const trackWrite = () => {
    writeChain = writeChain.then(() => new Promise<void>((resolve) => queueMicrotask(resolve)));
  };

  const factory = {
    open(dbName: string) {
      const request = createFakeRequest(undefined as unknown as IDBDatabase) as FakeOpenRequest;
      request.onupgradeneeded = null;
      request.onblocked = null;

      if (options?.failOpen) {
        failRequest(request, "open blocked");
        return request as unknown as IDBOpenDBRequest;
      }

      const storage = databases.get(dbName) ?? new Map<string, unknown>();
      databases.set(dbName, storage);

      const db = createFakeDatabase(storage, options?.failWrites ?? false, trackWrite);
      request.result = db;
      queueMicrotask(() => {
        request.onsuccess?.(createFakeEvent(request));
      });

      return request as unknown as IDBOpenDBRequest;
    },

    deleteDatabase() {
      const request = createFakeRequest(undefined);
      succeedRequest(request);
      return request as unknown as IDBOpenDBRequest;
    },

    cmp() {
      return 0;
    },

    databases() {
      return Promise.resolve([]);
    },
  };

  return {
    factory: factory as unknown as IDBFactory,
    waitForPersistence: async () => {
      await writeChain;
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
    },
  };
}

describe("createIndexedDbWorkspaceStore", () => {
  it("round-trips persisted state across reopen with the same fake factory", async () => {
    const { factory, waitForPersistence } = createFakeIdbFactory();
    const dbName = "test-workspace-roundtrip";

    const first = await createIndexedDbWorkspaceStore({ factory, dbName });
    expect(first.durable).toBe(true);

    first.store.setCategoryOverride(SIG_A, { parent: "Financing", flow: "revenue" });
    first.store.setDecision(SIG_B, { excluded: true });
    await waitForPersistence();

    const second = await createIndexedDbWorkspaceStore({ factory, dbName });
    expect(second.durable).toBe(true);
    expect(second.store.getCategoryOverride(SIG_A)).toEqual({
      parent: "Financing",
      flow: "revenue",
    });
    expect(second.store.getDecision(SIG_B)).toEqual({ excluded: true });
  });

  it("deep-copies values returned from getters so caller mutations do not affect stored state", async () => {
    const { factory } = createFakeIdbFactory();
    const { store } = await createIndexedDbWorkspaceStore({ factory });

    store.setCategoryOverride(SIG_A, { parent: "Food" });
    store.setDecision(SIG_B, { excluded: true });

    const override = store.getCategoryOverride(SIG_A);
    const decision = store.getDecision(SIG_B);
    expect(override).toBeDefined();
    expect(decision).toBeDefined();

    override!.parent = "Mutated";
    decision!.excluded = false;

    expect(store.getCategoryOverride(SIG_A)).toEqual({ parent: "Food" });
    expect(store.getDecision(SIG_B)).toEqual({ excluded: true });
  });

  it("degrades to an in-memory store when no factory is available", async () => {
    const blocked = await createIndexedDbWorkspaceStore({ factory: undefined });
    expect(blocked.durable).toBe(false);

    blocked.store.setCategoryOverride(SIG_A, { parent: "Operating Costs" });
    expect(blocked.store.getCategoryOverride(SIG_A)).toEqual({ parent: "Operating Costs" });

    const failedOpen = await createIndexedDbWorkspaceStore({
      factory: createFakeIdbFactory({ failOpen: true }).factory,
    });
    expect(failedOpen.durable).toBe(false);
    failedOpen.store.setDecision(SIG_B, { excluded: false });
    expect(failedOpen.store.getDecision(SIG_B)).toEqual({ excluded: false });
  });

  it("persists clearCategoryOverride across reopen", async () => {
    const { factory, waitForPersistence } = createFakeIdbFactory();
    const dbName = "test-clear-write-through";

    const first = await createIndexedDbWorkspaceStore({ factory, dbName });
    first.store.setCategoryOverride(SIG_A, { parent: "Financing" });
    await waitForPersistence();

    first.store.clearCategoryOverride(SIG_A);
    await waitForPersistence();

    const second = await createIndexedDbWorkspaceStore({ factory, dbName });
    expect(second.store.getCategoryOverride(SIG_A)).toBeUndefined();
  });

  it("persists load across reopen", async () => {
    const { factory, waitForPersistence } = createFakeIdbFactory();
    const dbName = "test-load-write-through";

    const snapshotA = {
      version: WORKSPACE_SNAPSHOT_VERSION,
      categoryOverrides: { [SIG_A]: { parent: "State A" } },
      decisions: { [SIG_B]: { excluded: true } },
      imports: [],
      rules: [],
      budgets: [],
      expectedIncomeEvents: [],
    };
    const snapshotB = {
      version: WORKSPACE_SNAPSHOT_VERSION,
      categoryOverrides: { [SIG_A]: { parent: "State B", flow: "revenue" as const } },
      decisions: {},
      imports: [],
      rules: [],
      budgets: [],
      expectedIncomeEvents: [],
    };

    const first = await createIndexedDbWorkspaceStore({ factory, dbName });
    first.store.load(snapshotA);
    await waitForPersistence();

    first.store.load(snapshotB);
    await waitForPersistence();

    const second = await createIndexedDbWorkspaceStore({ factory, dbName });
    expect(second.store.getCategoryOverride(SIG_A)).toEqual({ parent: "State B", flow: "revenue" });
    expect(second.store.getDecision(SIG_B)).toBeUndefined();
  });

  it("persists saved classification rules across reopen", async () => {
    const { factory, waitForPersistence } = createFakeIdbFactory();
    const dbName = "test-rules-write-through";

    const first = await createIndexedDbWorkspaceStore({ factory, dbName });
    first.store.setRules([
      {
        id: "stripe-revenue",
        field: "counterparty",
        contains: "stripe",
        override: { flow: "revenue", parent: "Sales" },
        enabled: true,
      },
    ]);
    await waitForPersistence();

    const second = await createIndexedDbWorkspaceStore({ factory, dbName });
    expect(second.store.getRules()).toEqual([
      {
        id: "stripe-revenue",
        field: "counterparty",
        contains: "stripe",
        override: { flow: "revenue", parent: "Sales" },
        enabled: true,
      },
    ]);
  });

  it("swallows write-through failures without throwing from setters", async () => {
    const { factory } = createFakeIdbFactory({ failWrites: true });
    const { store } = await createIndexedDbWorkspaceStore({ factory });

    expect(() => {
      store.setDecision(SIG_B, { excluded: true });
      store.setCategoryOverride(SIG_A, { parent: "Financing" });
    }).not.toThrow();

    expect(store.getDecision(SIG_B)).toEqual({ excluded: true });
    expect(store.getCategoryOverride(SIG_A)).toEqual({ parent: "Financing" });
  });
});
