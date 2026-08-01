export interface ProviderBuildEnvironment {
  readonly production: boolean
  readonly development: boolean
  readonly test: boolean
  readonly proxyRequested: boolean
  readonly browserKeysRequested: boolean
}

export interface ProviderBuildPolicy {
  readonly gatewayRequired: boolean
  readonly browserProviderKeysAllowed: boolean
  readonly directProviderRequestsAllowed: boolean
}

/** Production is gateway-only; browser keys are an explicit local/test seam. */
export function resolveProviderBuildPolicy(environment: ProviderBuildEnvironment): ProviderBuildPolicy {
  if (environment.production) {
    return {
      gatewayRequired: true,
      browserProviderKeysAllowed: false,
      directProviderRequestsAllowed: false,
    }
  }
  const localKeys = environment.test || (environment.development && environment.browserKeysRequested)
  return {
    gatewayRequired: environment.proxyRequested,
    browserProviderKeysAllowed: localKeys,
    directProviderRequestsAllowed: localKeys,
  }
}

export const PROVIDER_BUILD_POLICY = resolveProviderBuildPolicy({
  production: import.meta.env.PROD,
  development: import.meta.env.DEV,
  test: import.meta.env.MODE === 'test',
  proxyRequested: import.meta.env.VITE_USE_PROXY === 'true',
  browserKeysRequested: import.meta.env.VITE_ALLOW_BROWSER_PROVIDER_KEYS === 'true',
})
