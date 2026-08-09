import type { CredentialStorage } from './vault'

export class MemoryCredentialStorage implements CredentialStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  entries(): readonly (readonly [string, string])[] {
    return [...this.values.entries()]
  }
}
