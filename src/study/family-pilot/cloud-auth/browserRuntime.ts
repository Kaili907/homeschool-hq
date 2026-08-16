import { getSupabaseClient } from '../../../auth/supabaseSession'
import { createHostedSyncRpcAdapter } from '../../hosted-sync/v2/client'
import { BrowserFamilyCloudCheckpointRepositoryR1 } from './browserCheckpointRepository'
import { resolveFamilyCloudBrowserConfigurationR1, type FamilyCloudBrowserConfigurationR1 } from './browserConfiguration'
import {
  createSupabaseFamilyCloudRemoteDirectory,
  createSupabaseHostedSyncAuthorization,
  establishSupabaseFamilyHousehold,
} from './browserTransport'
import { HostedFamilyCloudLocalDataPortR1 } from './hostedLocalDataPort'
import { createSupabaseFamilyCloudAuth, createSupabaseFamilyHouseholdAuthority } from './supabase'
import type { FamilyCloudAuthRuntime } from './types'

const DEVICE_KEY = 'manuel-academy.family-cloud.device-ref.r1'
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/u

function browserDeviceRef(): string {
  const storage = window.localStorage
  const held = storage.getItem(DEVICE_KEY)
  if (held && REF.test(held)) return held
  const created = `device:${crypto.randomUUID()}`
  storage.setItem(DEVICE_KEY, created)
  if (storage.getItem(DEVICE_KEY) !== created) throw new Error('Family Cloud device identity did not verify.')
  return created
}

export interface FamilyCloudBrowserRuntimeCompositionR1 {
  readonly configuration: FamilyCloudBrowserConfigurationR1
  readonly auth: FamilyCloudAuthRuntime
}

/** The one real browser composition. Calling it while disabled is refused. */
export function createFamilyCloudBrowserRuntimeR1(
  configuration = resolveFamilyCloudBrowserConfigurationR1(),
): FamilyCloudBrowserRuntimeCompositionR1 {
  if (!configuration.enabled) throw new Error(`Family Cloud browser runtime is disabled: ${configuration.reason}`)
  const client = getSupabaseClient(configuration.url, configuration.anonKey)
  if (!client) throw new Error('Family Cloud browser auth client configuration was refused.')
  const deviceRef = browserDeviceRef()
  const repository = new BrowserFamilyCloudCheckpointRepositoryR1(deviceRef)
  const directory = createSupabaseFamilyCloudRemoteDirectory({
    client,
    localLearners: (householdRef) => repository.listBootstrapLearners(householdRef),
    householdTimeZone: (householdRef) => repository.readHouseholdTimeZone(householdRef),
  })
  const rpc = createHostedSyncRpcAdapter({ authorization: createSupabaseHostedSyncAuthorization(client) })
  const localData = new HostedFamilyCloudLocalDataPortR1({ directory, repository, client: rpc, deviceRef })
  const authority = createSupabaseFamilyHouseholdAuthority({
    url: configuration.url,
    anonKey: configuration.anonKey,
    bootstrap: (context, signal) => establishSupabaseFamilyHousehold(client, context, signal),
  })
  return Object.freeze({
    configuration,
    auth: createSupabaseFamilyCloudAuth({ localData, client, authority }),
  })
}
