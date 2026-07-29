import jobHistory, { StoredJob } from '@/utils/jobHistory'
import { Clear, Refresh } from '@mui/icons-material'
import {
  Autocomplete,
  Box,
  Chip,
  Container,
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
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'

const ALL = '__all__'

const cell = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : value

const formatDate = (value: string | null) =>
  value ? format(new Date(value), 'MMM d, yyyy HH:mm') : '—'

const Dashboard = () => {
  const [jobs, setJobs] = useState<StoredJob[] | null>(null)
  const [selectedJob, setSelectedJob] = useState<StoredJob | null>(null)

  const [search, setSearch] = useState('')
  const [type, setType] = useState(ALL)
  const [experienceLevel, setExperienceLevel] = useState(ALL)
  const [skill, setSkill] = useState<string | null>(null)
  const [country, setCountry] = useState(ALL)
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  const load = () => jobHistory.getAll().then(setJobs)

  useEffect(() => {
    load()

    // Poll instead of a one-time load — IndexedDB has no change-notification
    // API, so this is what makes the table reflect new jobs automatically
    // instead of requiring a manual refresh.
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

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
    const query = search.trim().toLowerCase()

    return (jobs ?? []).filter((job) => {
      if (
        query &&
        !job.title.toLowerCase().includes(query) &&
        !job.description.toLowerCase().includes(query)
      ) {
        return false
      }

      if (type !== ALL && job.type !== type) return false
      if (experienceLevel !== ALL && job.experienceLevel !== experienceLevel) return false
      if (skill && !job.skills.includes(skill)) return false
      if (country !== ALL && job.clientCountry !== country) return false

      const firstSeen = new Date(job.firstSeenAt)
      if (dateFrom && isBefore(firstSeen, startOfDay(dateFrom))) return false
      if (dateTo && isAfter(firstSeen, endOfDay(dateTo))) return false

      return true
    })
  }, [jobs, search, type, experienceLevel, skill, country, dateFrom, dateTo])

  const hasActiveFilters =
    search || type !== ALL || experienceLevel !== ALL || skill || country !== ALL || dateFrom || dateTo

  const clearFilters = () => {
    setSearch('')
    setType(ALL)
    setExperienceLevel(ALL)
    setSkill(null)
    setCountry(ALL)
    setDateFrom(null)
    setDateTo(null)
  }

  if (jobs === null) return null

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Toolbar disableGutters sx={{ mb: 2, gap: 2 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          Live Job Dashboard
        </Typography>

        <Chip
          label={`${filteredJobs.length} / ${jobs.length}`}
          size="small"
          color={hasActiveFilters ? 'primary' : 'default'}
        />

        <Box sx={{ flexGrow: 1 }} />

        <Tooltip title="Refresh now (auto-refreshes every 5s anyway)">
          <IconButton onClick={load}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Toolbar>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
          }}
        >
          <TextField
            size="small"
            label="Search title/description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 240 }}
          />

          <Select
            size="small"
            value={type}
            onChange={(e) => setType(e.target.value)}
            sx={{ minWidth: 160 }}
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
            sx={{ minWidth: 180 }}
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
            sx={{ minWidth: 200 }}
            renderInput={(params) => <TextField {...params} label="Skill" />}
          />

          <Select
            size="small"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            sx={{ minWidth: 160 }}
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
            slotProps={{ textField: { size: 'small', sx: { minWidth: 170 } } }}
          />

          <DatePicker
            label="First seen to"
            value={dateTo}
            onChange={setDateTo}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 170 } } }}
          />

          {hasActiveFilters && (
            <Tooltip title="Clear filters">
              <IconButton onClick={clearFilters} size="small">
                <Clear />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>

      {jobs.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="textSecondary">
            No jobs saved yet. This fills in automatically as the extension
            fetches new jobs — check back after the next fetch cycle.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
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
              // column's data ever needs to be, so ellipsis was cutting the
              // label itself off rather than just long data values.
              '& th': {
                whiteSpace: 'normal',
                lineHeight: 1.3,
                verticalAlign: 'bottom',
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 220 }}>Title</TableCell>
                <TableCell sx={{ width: 90 }}>Type</TableCell>
                <TableCell sx={{ width: 260 }}>Description</TableCell>
                <TableCell sx={{ width: 130 }}>Experience level</TableCell>
                <TableCell sx={{ width: 190 }}>Weekly hours</TableCell>
                <TableCell sx={{ width: 160 }}>Duration label</TableCell>
                <TableCell sx={{ width: 110 }}>Duration code</TableCell>
                <TableCell sx={{ width: 130 }}>Proposals tier</TableCell>
                <TableCell sx={{ width: 100 }}>Fixed price</TableCell>
                <TableCell sx={{ width: 90 }}>Hourly min</TableCell>
                <TableCell sx={{ width: 90 }}>Hourly max</TableCell>
                <TableCell sx={{ width: 120 }}>Payment verified</TableCell>
                <TableCell sx={{ width: 110 }}>Client feedback</TableCell>
                <TableCell sx={{ width: 130 }}>Client spent</TableCell>
                <TableCell sx={{ width: 170 }}>Client country</TableCell>
                <TableCell sx={{ width: 70 }}>Job URL</TableCell>
                <TableCell sx={{ width: 90 }}>Proposal URL</TableCell>
                <TableCell sx={{ width: 220 }}>Skills</TableCell>
                <TableCell sx={{ width: 185 }}>Renewed on</TableCell>
                <TableCell sx={{ width: 185 }}>Created on</TableCell>
                <TableCell sx={{ width: 185 }}>First seen</TableCell>
                <TableCell sx={{ width: 185 }}>Updated at</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.ciphertext} hover>
                  <TableCell
                    onClick={() => setSelectedJob(job)}
                    sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {job.title}
                  </TableCell>
                  <TableCell>{job.type}</TableCell>
                  <TableCell
                    onClick={() => setSelectedJob(job)}
                    sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {job.description}
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
      )}

      <Dialog open={Boolean(selectedJob)} onClose={() => setSelectedJob(null)} maxWidth="sm" fullWidth>
        {selectedJob && (
          <>
            <DialogTitle>{selectedJob.title}</DialogTitle>
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
                dangerouslySetInnerHTML={{ __html: selectedJob.description }}
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
    </Container>
  )
}

export default Dashboard
