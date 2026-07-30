import { storage } from '#imports'
import { FeedType } from '@/api/upwork'
import isFunction from 'lodash/isFunction'
import { v4 } from 'uuid'
import { ErrorType } from './errors'
import extension from './extension'

const namespace = 'sync:__STATE'
export type DarkMode = 'true' | 'false' | 'system'

export type Schedule = {
  id: string
  days: number[]
  from: string
  to: string
}

export type CheckMode = 'automatic' | 'manual'

/**
 * Global state persisted in cloud storage
 */
export type GlobalState = {
  instanceId: string
  enabled: boolean
  darkMode: DarkMode
  // @deprecated
  readAlertIds: string[]
  feedType: FeedType
  lastLoginAttemptAt: number | null
  lastCaptchaAttemptAt: number | null
  lastCycleStartedAt: number
  lastCycleError: ErrorType | null

  readAlerts: {
    id: string
    read_at: number
  }[]

  soundSettings: {
    volume: number
    enabled: boolean
  }

  schedulingEnabled: boolean
  schedules: Schedule[]
  usTimeFormat: boolean

  usernameHash: string | null

  checkMode: CheckMode
  checkIntervalMinutes: number
  automationConsentAcknowledged: boolean
}

const getDefaultState = (): GlobalState => ({
  instanceId: v4(),
  enabled: true,
  darkMode: 'system',
  readAlerts: [],
  readAlertIds: [],
  lastLoginAttemptAt: null,
  lastCaptchaAttemptAt: null,
  feedType: FeedType.MyFeed,

  lastCycleError: null,
  lastCycleStartedAt: 0,

  soundSettings: {
    volume: 100,
    enabled: !extension.debugEnabled,
  },

  schedulingEnabled: false,
  schedules: [],
  usTimeFormat: false,

  usernameHash: null,

  checkMode: 'automatic',
  checkIntervalMinutes: 15,
  automationConsentAcknowledged: false,
})

const get = async (): Promise<GlobalState> => {
  // Merged with defaults on every read (not just on the onInstalled/"update"
  // event) so a profile that predates a newly-added field — e.g. an existing
  // install, or a dev reload that doesn't fire onInstalled — still gets a
  // real value instead of `undefined` for that field.
  const storedState = await storage.getItem<Partial<GlobalState>>(namespace, {
    fallback: {},
  })

  return { ...getDefaultState(), ...storedState }
}

const save = async (
  arg: Partial<GlobalState> | ((previousState: GlobalState) => GlobalState)
): Promise<GlobalState> => {
  const updatedState = isFunction(arg)
    ? arg(await get())
    : { ...(await get()), ...arg }

  await storage.setItem<GlobalState>(namespace, updatedState)
  return updatedState
}

const addEventListener = (
  callback: (newState: GlobalState | null, oldState: GlobalState | null) => void
) => storage.watch<GlobalState>(namespace, callback)

export default {
  addEventListener,
  getDefaultState,
  get,
  save,
}
