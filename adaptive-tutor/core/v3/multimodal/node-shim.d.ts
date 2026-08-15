declare module "node:assert/strict" {
  interface AssertStrict {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  }

  const assert: AssertStrict;
  export default assert;
}

declare module "node:test" {
  type TestBody = () => void | Promise<void>;
  export default function test(name: string, body: TestBody): void;
}
