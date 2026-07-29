import colors from '@/utils/colors'
import dashboardVisit from '@/utils/dashboardVisit'
import jobHistory, { StoredJob } from '@/utils/jobHistory'
import {
  ArrowDownward,
  ArrowUpward,
  Clear,
  Description as DescriptionIcon,
  Refresh,
  TableChart,
} from '@mui/icons-material'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import { Document, HeadingLevel, Packer, Paragraph } from 'docx'
import { useEffect, useMemo, useState } from 'react'

const ALL = '__all__'
const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 250]

type SortableField = Exclude<keyof StoredJob, 'skills'>

const cell = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : value

const formatDate = (value: string | null) =>
  value ? format(new Date(value), 'MMM d, yyyy HH:mm') : '—'

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const parseKeywords = (query: string) =>
  query
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean)

const keywordRegex = (keywords: string[]) =>
  new RegExp(`(${keywords.map(escapeRegExp).join('|')})`, 'gi')

const matchesAnyKeyword = (text: string, keywords: string[]) => {
  if (!keywords.length) return true
  const lower = text.toLowerCase()
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()))
}

// Highlights matches inside an HTML string without corrupting markup — only
// text nodes are touched; the split's tag-capturing group passes `<...>`
// segments straight through untouched.
const highlightHtml = (html: string, query: string, markColor: string) => {
  const keywords = parseKeywords(query)
  if (!keywords.length) return html

  const regex = keywordRegex(keywords)
  return html.replace(/(<[^>]*>)|([^<]+)/g, (match, tag, text) =>
    tag
      ? tag
      : text.replace(
          regex,
          (m: string) =>
            `<mark style="background-color:${markColor};color:inherit;border-radius:2px">${m}</mark>`
        )
  )
}

const Highlight = (props: { text: string; query: string }) => {
  const theme = useTheme()
  const keywords = parseKeywords(props.query)

  if (!keywords.length) return <>{props.text}</>

  const parts = props.text.split(keywordRegex(keywords))
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase())

  return (
    <>
      {parts.map((part, i) =>
        lowerKeywords.includes(part.toLowerCase()) ? (
          <Box
            key={i}
            component="mark"
            sx={{
              backgroundColor: theme.palette.mode === 'dark' ? '#8a6d00' : '#fff59d',
              color: 'inherit',
              borderRadius: '2px',
            }}
          >
            {part}
          </Box>
        ) : (
          part
        )
      )}
    </>
  )
}

const formatBudgetPlain = (job: StoredJob) => {
  if (job.fixedPriceAmount) return `$${job.fixedPriceAmount} fixed`
  if (job.hourlyBudgetMin) return `$${job.hourlyBudgetMin}-$${job.hourlyBudgetMax}/hr`
  return '—'
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const CSV_COLUMNS: { header: string; get: (job: StoredJob) => string | number | null }[] = [
  { header: 'Title', get: (j) => j.title },
  { header: 'Type', get: (j) => j.type },
  { header: 'Description', get: (j) => stripHtml(j.description) },
  { header: 'Experience Level', get: (j) => j.experienceLevel },
  { header: 'Weekly Hours', get: (j) => j.weeklyHours },
  { header: 'Duration Label', get: (j) => j.durationLabel },
  { header: 'Duration Code', get: (j) => j.durationCode },
  { header: 'Proposals Tier', get: (j) => j.proposalsTier },
  { header: 'Fixed Price', get: (j) => j.fixedPriceAmount },
  { header: 'Hourly Min', get: (j) => j.hourlyBudgetMin },
  { header: 'Hourly Max', get: (j) => j.hourlyBudgetMax },
  { header: 'Payment Verified', get: (j) => j.clientPaymentVerificationStatus },
  { header: 'Client Feedback', get: (j) => j.clientTotalFeedback },
  { header: 'Client Spent', get: (j) => j.clientTotalSpent },
  { header: 'Client Country', get: (j) => j.clientCountry },
  { header: 'Job URL', get: (j) => j.jobUrl },
  { header: 'Proposal URL', get: (j) => j.proposalUrl },
  { header: 'Skills', get: (j) => j.skills.join('; ') },
  { header: 'Renewed On', get: (j) => j.renewedOn },
  { header: 'Created On', get: (j) => j.createdOn },
  { header: 'First Seen', get: (j) => j.firstSeenAt },
  { header: 'Updated At', get: (j) => j.updatedAt },
]

const escapeCsvValue = (value: string | number | null) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`

const JobsDashboard = () => {
  const theme = useTheme()

  const [jobs, setJobs] = useState<StoredJob[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<StoredJob | null>(null)
  const [lastVisitedAt, setLastVisitedAt] = useState<string | null>(null)

  const [titleSearch, setTitleSearch] = useState('')
  const [descriptionSearch, setDescriptionSearch] = useState('')
  const [type, setType] = useState(ALL)
  const [experienceLevel, setExperienceLevel] = useState(ALL)
  const [skill, setSkill] = useState<string | null>(null)
  const [country, setCountry] = useState(ALL)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  const [sortField, setSortField] = useState<SortableField>('firstSeenAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const load = () =>
    jobHistory
      .getAll()
      .then((data) => {
        setJobs(data)
        setLoadError(null)
      })
      .catch((error) =>
        setLoadError(error instanceof Error ? error.message : String(error))
      )

  useEffect(() => {
    load()

    // Poll instead of a one-time load — IndexedDB has no change-notification
    // API, so this is what makes the table reflect new jobs automatically
    // instead of requiring a manual refresh.
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Capture the *previous* visit before overwriting it — that's the
    // cutoff used to highlight "new since you last looked."
    dashboardVisit.get().then(setLastVisitedAt)
    dashboardVisit.save(new Date().toISOString())
  }, [])

  useEffect(() => {
    setPage(0)
  }, [
    titleSearch,
    descriptionSearch,
    type,
    experienceLevel,
    skill,
    country,
    dateFrom,
    dateTo,
    sortField,
    sortDirection,
  ])

  const { types, experienceLevels, skills, countries } = useMemo(() => {
    const source = jobs ?? []
    return {
      types: [...new Set(source.map((j) => j.type))].sort(),
      experienceLevels: [
        ...new Set(source.map((j) => j.experienceLevel).filter(Boolean)),
      ].sort() as string[],
      skills: [...new Set(source.flatMap((j) => j.skills))].sort(),
      countries: [
        ...new Set(source.map((j) => j.clientCountry).filter(Boolean)),
      ].sort() as string[],
    }
  }, [jobs])

  const filteredJobs = useMemo(() => {
    const titleKeywords = parseKeywords(titleSearch)
    const descriptionKeywords = parseKeywords(descriptionSearch)

    return (jobs ?? []).filter((job) => {
      if (!matchesAnyKeyword(job.title, titleKeywords)) return false
      if (!matchesAnyKeyword(stripHtml(job.description), descriptionKeywords)) return false

      if (type !== ALL && job.type !== type) return false
      if (experienceLevel !== ALL && job.experienceLevel !== experienceLevel) return false
      if (skill && !job.skills.includes(skill)) return false
      if (country !== ALL && job.clientCountry !== country) return false

      const firstSeen = new Date(job.firstSeenAt)
      if (dateFrom && isBefore(firstSeen, startOfDay(dateFrom))) return false
      if (dateTo && isAfter(firstSeen, endOfDay(dateTo))) return false

      return true
    })
  }, [
    jobs,
    titleSearch,
    descriptionSearch,
    type,
    experienceLevel,
    skill,
    country,
    dateFrom,
    dateTo,
  ])

  const sortedJobs = useMemo(() => {
    const factor = sortDirection === 'asc' ? 1 : -1

    return [...filteredJobs].sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]

      if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor

      return String(av).localeCompare(String(bv)) * factor
    })
  }, [filteredJobs, sortField, sortDirection])

  const paginatedJobs = useMemo(() => {
    const start = page * rowsPerPage
    return sortedJobs.slice(start, start + rowsPerPage)
  }, [sortedJobs, page, rowsPerPage])

  const isNewJob = (job: StoredJob) =>
    lastVisitedAt !== null && job.firstSeenAt > lastVisitedAt

  const toggleSort = (field: SortableField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const hasActiveFilters =
    titleSearch ||
    descriptionSearch ||
    type !== ALL ||
    experienceLevel !== ALL ||
    skill ||
    country !== ALL ||
    dateFrom ||
    dateTo

  const clearFilters = () => {
    setTitleSearch('')
    setDescriptionSearch('')
    setType(ALL)
    setExperienceLevel(ALL)
    setSkill(null)
    setCountry(ALL)
    setDateFrom(null)
    setDateTo(null)
  }

  const exportCsv = () => {
    const rows = sortedJobs.map((job) =>
      CSV_COLUMNS.map((col) => escapeCsvValue(col.get(job))).join(',')
    )
    const csv = [CSV_COLUMNS.map((col) => escapeCsvValue(col.header)).join(','), ...rows].join(
      '\n'
    )
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `upwork-jobs-${Date.now()}.csv`)
  }

  const exportDocx = async () => {
    const doc = new Document({
      sections: [
        {
          children: sortedJobs.flatMap((job) => [
            new Paragraph({ text: job.title, heading: HeadingLevel.HEADING_2 }),
            new Paragraph({
              text: `${job.type} • ${job.experienceLevel ?? '—'} • ${formatBudgetPlain(job)} • ${job.clientCountry ?? '—'}`,
            }),
            new Paragraph({ text: stripHtml(job.description) }),
            new Paragraph({ text: `Skills: ${job.skills.join(', ') || '—'}` }),
            new Paragraph({ text: `First seen: ${formatDate(job.firstSeenAt)}` }),
            new Paragraph({ text: job.jobUrl }),
            new Paragraph({ text: '' }),
          ]),
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    downloadBlob(blob, `upwork-jobs-${Date.now()}.docx`)
  }

  const SortableHeader = (props: { field: SortableField; label: string; width: number }) => (
    <TableCell
      sx={{ width: props.width, cursor: 'pointer', userSelect: 'none' }}
      onClick={() => toggleSort(props.field)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {props.label}
        {sortField === props.field &&
          (sortDirection === 'asc' ? (
            <ArrowUpward sx={{ fontSize: 14 }} />
          ) : (
            <ArrowDownward sx={{ fontSize: 14 }} />
          ))}
      </Box>
    </TableCell>
  )

  return (
    <Box>
      <Toolbar disableGutters sx={{ mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Live Job Dashboard
        </Typography>

        {jobs !== null && (
          <Chip
            label={`${filteredJobs.length} / ${jobs.length}`}
            size="small"
            color={hasActiveFilters ? 'primary' : 'default'}
          />
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Button size="small" startIcon={<DescriptionIcon />} onClick={exportCsv} disabled={!jobs?.length}>
          CSV
        </Button>
        <Button size="small" startIcon={<TableChart />} onClick={exportDocx} disabled={!jobs?.length}>
          DOCX
        </Button>

        <Tooltip title="Refresh now (auto-refreshes every 5s anyway)">
          <IconButton onClick={load}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Toolbar>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Couldn't load job data: {loadError}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            gap: 1.5,
            alignItems: 'center',
            pb: 0.5,
          }}
        >
          <TextField
            size="small"
            label="Search title"
            placeholder="e.g. react, vue"
            value={titleSearch}
            onChange={(e) => setTitleSearch(e.target.value)}
            sx={{ minWidth: 170, flexShrink: 0 }}
          />

          <TextField
            size="small"
            label="Search description"
            placeholder="e.g. react, vue"
            value={descriptionSearch}
            onChange={(e) => setDescriptionSearch(e.target.value)}
            sx={{ minWidth: 170, flexShrink: 0 }}
          />

          <Select
            size="small"
            value={type}
            onChange={(e) => setType(e.target.value)}
            sx={{ minWidth: 130, flexShrink: 0 }}
          >
            <MenuItem value={ALL}>All types</MenuItem>
            {types.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>

          <Select
            size="small"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            sx={{ minWidth: 150, flexShrink: 0 }}
          >
            <MenuItem value={ALL}>All experience levels</MenuItem>
            {experienceLevels.map((level) => (
              <MenuItem key={level} value={level}>
                {level}
              </MenuItem>
            ))}
          </Select>

          <Autocomplete
            size="small"
            options={skills}
            value={skill}
            onChange={(e, value) => setSkill(value)}
            sx={{ minWidth: 150, flexShrink: 0 }}
            renderInput={(params) => <TextField {...params} label="Skill" />}
          />

          <Select
            size="small"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            sx={{ minWidth: 130, flexShrink: 0 }}
          >
            <MenuItem value={ALL}>All countries</MenuItem>
            {countries.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </Select>

          <DatePicker
            label="First seen from"
            value={dateFrom}
            onChange={setDateFrom}
            slotProps={{
              textField: { size: 'small', sx: { minWidth: 150, flexShrink: 0 } },
            }}
          />

          <DatePicker
            label="First seen to"
            value={dateTo}
            onChange={setDateTo}
            slotProps={{
              textField: { size: 'small', sx: { minWidth: 150, flexShrink: 0 } },
            }}
          />

          {hasActiveFilters && (
            <Tooltip title="Clear filters">
              <IconButton onClick={clearFilters} size="small" sx={{ flexShrink: 0 }}>
                <Clear />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>

      {jobs === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : jobs.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="textSecondary">
            No jobs saved yet. This fills in automatically as the extension
            fetches new jobs — check back after the next fetch cycle.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table
              size="small"
              sx={{
                tableLayout: 'fixed',
                '& td': {
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
                // Headers wrap instead of truncating — several labels (e.g.
                // "Duration code", "Payment verified") are longer than their
                // column's data ever needs to be, so ellipsis was cutting
                // the label itself off rather than just long data values.
                '& th': {
                  whiteSpace: 'normal',
                  lineHeight: 1.3,
                  verticalAlign: 'bottom',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <SortableHeader field="title" label="Title" width={220} />
                  <SortableHeader field="type" label="Type" width={90} />
                  <SortableHeader field="description" label="Description" width={260} />
                  <SortableHeader field="experienceLevel" label="Experience level" width={130} />
                  <SortableHeader field="weeklyHours" label="Weekly hours" width={190} />
                  <SortableHeader field="durationLabel" label="Duration label" width={160} />
                  <SortableHeader field="durationCode" label="Duration code" width={110} />
                  <SortableHeader field="proposalsTier" label="Proposals tier" width={130} />
                  <SortableHeader field="fixedPriceAmount" label="Fixed price" width={100} />
                  <SortableHeader field="hourlyBudgetMin" label="Hourly min" width={90} />
                  <SortableHeader field="hourlyBudgetMax" label="Hourly max" width={90} />
                  <SortableHeader
                    field="clientPaymentVerificationStatus"
                    label="Payment verified"
                    width={120}
                  />
                  <SortableHeader field="clientTotalFeedback" label="Client feedback" width={110} />
                  <SortableHeader field="clientTotalSpent" label="Client spent" width={130} />
                  <SortableHeader field="clientCountry" label="Client country" width={170} />
                  <TableCell sx={{ width: 70 }}>Job URL</TableCell>
                  <TableCell sx={{ width: 90 }}>Proposal URL</TableCell>
                  <TableCell sx={{ width: 220 }}>Skills</TableCell>
                  <SortableHeader field="renewedOn" label="Renewed on" width={185} />
                  <SortableHeader field="createdOn" label="Created on" width={185} />
                  <SortableHeader field="firstSeenAt" label="First seen" width={185} />
                  <SortableHeader field="updatedAt" label="Updated at" width={185} />
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedJobs.map((job) => (
                  <TableRow
                    key={job.ciphertext}
                    hover
                    sx={
                      isNewJob(job)
                        ? {
                            backgroundColor:
                              theme.palette.mode === 'dark'
                                ? colors.warningDark
                                : colors.warning,
                          }
                        : undefined
                    }
                  >
                    <TableCell
                      onClick={() => setSelectedJob(job)}
                      sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    >
                      <Highlight text={job.title} query={titleSearch} />
                    </TableCell>
                    <TableCell>{job.type}</TableCell>
                    <TableCell
                      onClick={() => setSelectedJob(job)}
                      sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    >
                      <Highlight text={stripHtml(job.description)} query={descriptionSearch} />
                    </TableCell>
                    <TableCell>{cell(job.experienceLevel)}</TableCell>
                    <TableCell>{cell(job.weeklyHours)}</TableCell>
                    <TableCell>{cell(job.durationLabel)}</TableCell>
                    <TableCell>{cell(job.durationCode)}</TableCell>
                    <TableCell>{cell(job.proposalsTier)}</TableCell>
                    <TableCell>{job.fixedPriceAmount ? `$${job.fixedPriceAmount}` : '—'}</TableCell>
                    <TableCell>{job.hourlyBudgetMin ? `$${job.hourlyBudgetMin}` : '—'}</TableCell>
                    <TableCell>{job.hourlyBudgetMax ? `$${job.hourlyBudgetMax}` : '—'}</TableCell>
                    <TableCell>
                      {job.clientPaymentVerificationStatus === 1
                        ? 'Yes'
                        : job.clientPaymentVerificationStatus === 0
                          ? 'No'
                          : '—'}
                    </TableCell>
                    <TableCell>{cell(job.clientTotalFeedback)}</TableCell>
                    <TableCell>
                      {job.clientTotalSpent ? `$${job.clientTotalSpent}` : '—'}
                    </TableCell>
                    <TableCell>{cell(job.clientCountry)}</TableCell>
                    <TableCell>
                      <Link href={job.jobUrl} target="_blank" rel="noopener noreferrer">
                        Open
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={job.proposalUrl} target="_blank" rel="noopener noreferrer">
                        Open
                      </Link>
                    </TableCell>
                    <TableCell sx={{ overflow: 'visible' }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {job.skills.length === 0 && '—'}
                        {job.skills.slice(0, 3).map((s) => (
                          <Chip key={s} size="small" label={s} />
                        ))}
                        {job.skills.length > 3 && (
                          <Tooltip title={job.skills.slice(3).join(', ')}>
                            <Chip size="small" label={`+${job.skills.length - 3}`} />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{formatDate(job.renewedOn)}</TableCell>
                    <TableCell>{formatDate(job.createdOn)}</TableCell>
                    <TableCell>{formatDate(job.firstSeenAt)}</TableCell>
                    <TableCell>{formatDate(job.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={sortedJobs.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(Number(e.target.value))
              setPage(0)
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          />
        </Paper>
      )}

      <Dialog open={Boolean(selectedJob)} onClose={() => setSelectedJob(null)} maxWidth="sm" fullWidth>
        {selectedJob && (
          <>
            <DialogTitle>
              <Highlight text={selectedJob.title} query={titleSearch} />
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip size="small" label={selectedJob.type} />
                {selectedJob.experienceLevel && (
                  <Chip size="small" label={selectedJob.experienceLevel} />
                )}
                {selectedJob.fixedPriceAmount ? (
                  <Chip size="small" label={`$${selectedJob.fixedPriceAmount} fixed`} />
                ) : selectedJob.hourlyBudgetMin ? (
                  <Chip
                    size="small"
                    label={`$${selectedJob.hourlyBudgetMin}-$${selectedJob.hourlyBudgetMax}/hr`}
                  />
                ) : null}
                {selectedJob.clientCountry && (
                  <Chip size="small" label={selectedJob.clientCountry} />
                )}
              </Box>

              <Typography
                component="div"
                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{
                  __html: highlightHtml(
                    selectedJob.description,
                    descriptionSearch,
                    theme.palette.mode === 'dark' ? '#8a6d00' : '#fff59d'
                  ),
                }}
              />

              {selectedJob.skills.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
                  {selectedJob.skills.map((s) => (
                    <Chip key={s} size="small" label={s} />
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Link href={selectedJob.jobUrl} target="_blank" rel="noopener noreferrer">
                  Open job on Upwork
                </Link>
                <Link href={selectedJob.proposalUrl} target="_blank" rel="noopener noreferrer">
                  Open proposal page
                </Link>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  )
}

export default JobsDashboard
