import type { Job } from '@/api/upwork'
import { proposalUrl, viewUrl } from '@/utils/upworkUrls'
import { DBSchema, openDB } from 'idb'

export type StoredJob = {
  ciphertext: string
  title: string
  type: string
  description: string
  experienceLevel: string | null
  weeklyHours: string | null
  durationLabel: string | null
  durationCode: string | null
  proposalsTier: string | null
  fixedPriceAmount: number | null
  hourlyBudgetMin: number | null
  hourlyBudgetMax: number | null
  clientPaymentVerificationStatus: number | null
  clientTotalFeedback: number | null
  clientTotalSpent: number | null
  clientCountry: string | null
  jobUrl: string
  proposalUrl: string
  skills: string[]
  renewedOn: string | null
  createdOn: string | null
  firstSeenAt: string
  updatedAt: string
}

interface JobHistoryDB extends DBSchema {
  jobs: {
    key: string
    value: StoredJob
    indexes: { firstSeenAt: string }
  }
}

const DB_NAME = 'uptoolkit'
const STORE_NAME = 'jobs'

const dbPromise = openDB<JobHistoryDB>(DB_NAME, 1, {
  upgrade(db) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'ciphertext' })
    store.createIndex('firstSeenAt', 'firstSeenAt')
  },
})

// Upwork's feeds return this inconsistently cased depending on which feed a
// job came from (e.g. "INTERMEDIATE" from one, "Intermediate" from another)
// — normalize so filtering by experience level doesn't silently miss rows.
const normalizeExperienceLevel = (value: string | null) =>
  value ? value.trim().toUpperCase().replace(/\s+/g, '_') : value

const toNumber = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? null : Number(value)

const skillNames = (attrs: Job['attrs']) => [
  ...new Set(
    (attrs ?? [])
      .map((attr) => attr?.prettyName)
      .filter((name): name is string => Boolean(name))
  ),
]

const toStoredJob = (job: Job, previous: StoredJob | undefined): StoredJob => {
  const now = new Date().toISOString()

  return {
    ciphertext: job.ciphertext,
    title: job.title,
    type: job.type,
    description: job.description,
    experienceLevel: normalizeExperienceLevel(job.tierText),
    weeklyHours: job.engagement,
    durationLabel: job.durationLabel,
    durationCode: job.duration,
    proposalsTier: job.proposalsTier,
    fixedPriceAmount: toNumber(job.amount?.amount),
    hourlyBudgetMin: toNumber(job.hourlyBudget?.min),
    hourlyBudgetMax: toNumber(job.hourlyBudget?.max),
    clientPaymentVerificationStatus: job.client?.paymentVerificationStatus ?? null,
    clientTotalFeedback: job.client?.totalFeedback ?? null,
    clientTotalSpent: toNumber(job.client?.totalSpent),
    clientCountry: job.client?.location?.country ?? null,
    jobUrl: viewUrl(job.ciphertext),
    proposalUrl: proposalUrl(job.ciphertext),
    skills: skillNames(job.attrs),
    renewedOn: job.renewedOn ? String(job.renewedOn) : null,
    createdOn: job.createdOn ? String(job.createdOn) : null,
    firstSeenAt: previous?.firstSeenAt ?? now,
    updatedAt: now,
  }
}

const saveJobs = async (jobs: Job[]): Promise<void> => {
  if (!jobs.length) return

  const db = await dbPromise

  // Read every "previous" record first, in its own read-only transaction.
  // Interleaving a get() and put() with an `await` in between inside one
  // shared transaction is unsafe: IndexedDB auto-commits a transaction the
  // moment nothing else keeps it pending, which can happen in that gap
  // (especially with a single job) — the subsequent put() then throws.
  const readTx = db.transaction(STORE_NAME, 'readonly')
  const previousByCiphertext = new Map<string, StoredJob>()

  await Promise.all([
    ...jobs.map(async (job) => {
      const previous = await readTx.store.get(job.ciphertext)
      if (previous) previousByCiphertext.set(job.ciphertext, previous)
    }),
    readTx.done,
  ])

  // Then write everything in one transaction, issuing all put() calls
  // synchronously (no await between them) so the transaction stays alive
  // until every request settles.
  const writeTx = db.transaction(STORE_NAME, 'readwrite')

  await Promise.all([
    ...jobs.map((job) =>
      writeTx.store.put(toStoredJob(job, previousByCiphertext.get(job.ciphertext)))
    ),
    writeTx.done,
  ])
}

const getAll = async (): Promise<StoredJob[]> => {
  const db = await dbPromise
  const jobs = await db.getAllFromIndex(STORE_NAME, 'firstSeenAt')
  return jobs.reverse()
}

export default { saveJobs, getAll }
