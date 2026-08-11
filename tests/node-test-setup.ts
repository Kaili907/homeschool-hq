// Supported Node 22 has no global localStorage. Newer Node releases expose an
// experimental getter that is not a usable Storage object without a backing
// file, which makes browser-only safety writes fail for an environmental
// reason. Node tests that exercise storage install their own in-memory shim.
delete (globalThis as unknown as { localStorage?: Storage }).localStorage
