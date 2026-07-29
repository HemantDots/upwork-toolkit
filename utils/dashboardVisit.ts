import { storage } from '#imports'

const namespace = 'local:__DASHBOARD_LAST_VISIT'

const get = () => storage.getItem<string | null>(namespace, { fallback: null })

const save = (value: string) => storage.setItem<string>(namespace, value)

export default { get, save }
