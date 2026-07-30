import { browser } from '#imports'
import Storage, { StorageInterface } from '@/contexts/storage'
import alerts, { Alert } from '@/utils/alerts'
import colors from '@/utils/colors'
import { ErrorType } from '@/utils/errors'
import extension from '@/utils/extension'
import notifications from '@/utils/notifications'
import { CheckJobsNowResponse, Message } from '@/utils/runtime'
import { AutoMode, CheckCircle, Refresh, TouchApp } from '@mui/icons-material'
import {
  AlertTitle,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Link,
  Alert as MuiAlert,
  Paper,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useSnackbar } from 'notistack'
import { useContext, useEffect, useState } from 'react'
import JobsDashboard from '../JobsDashboard'
import { eventEmitter, Event } from '@/utils/events'

const alertInterval = extension.debugEnabled
  ? 10 * 1000 // 10 seconds
  : 24 * 60 * 60 * 1000 // 24 hours

const Home = () => {
  const { enqueueSnackbar } = useSnackbar()
  const storage = useContext<StorageInterface>(Storage)

  const [unseenIds, setUnseenIds] = useState<string[]>([])
  const [checkingNow, setCheckingNow] = useState(false)

  const [justChosenMode, setJustChosenMode] = useState<
    'automatic' | 'manual' | null
  >(null)

  const [selectedMode, setSelectedMode] = useState<
    'automatic' | 'manual' | null
  >(null)

  const onSubmitCheckMode = async () => {
    if (!selectedMode) {
      return
    }

    await storage.setState({
      checkMode: selectedMode,
      automationConsentAcknowledged: true,
    })
    setJustChosenMode(selectedMode)
  }

  const onCheckNow = async () => {
    setCheckingNow(true)

    try {
      const response = (await browser.runtime.sendMessage({
        type: Message.CHECK_JOBS_NOW,
      })) as CheckJobsNowResponse

      enqueueSnackbar(
        response.success
          ? 'Checked for new jobs'
          : `Failed to check jobs: ${response.error}`,
        { variant: response.success ? 'success' : 'error' }
      )
    } catch (error) {
      enqueueSnackbar(`Failed to check jobs: ${error}`, { variant: 'error' })
    } finally {
      // Simple cooldown so this can't be spam-clicked into its own
      // automated-looking pattern.
      setTimeout(() => setCheckingNow(false), 10000)
    }
  }

  const jobsHash = Array.isArray(storage.jobs)
    ? storage.jobs
        .map((job) => job.ciphertext)
        .sort()
        .join('/')
    : ''

  const lastCycleError = storage.globalState.lastCycleError

  const loginAttempted =
    storage.globalState.lastLoginAttemptAt &&
    storage.globalState.lastLoginAttemptAt + 60000 > Date.now()

  const captchaAttempted =
    storage.globalState.lastCaptchaAttemptAt &&
    storage.globalState.lastCaptchaAttemptAt + 60000 > Date.now()

  const readAlertIds = [
    // Old alerts storage property (readAlertIds), do not use it anywhere else
    ...storage.globalState.readAlertIds,
    ...storage.globalState.readAlerts.map((alert) => alert.id),
  ]

  const unreadAlerts = alerts.filter(
    (alert) => !readAlertIds.includes(alert.id)
  )

  const lastReadAlert =
    storage.globalState.readAlerts.length > 0
      ? storage.globalState.readAlerts.slice(-1)[0]
      : null

  const unreadAlert =
    !lastReadAlert || lastReadAlert.read_at + alertInterval < Date.now()
      ? unreadAlerts[0]
      : null

  const onAlertClose = (alert: Alert) =>
    storage.setState({
      readAlerts: [
        ...storage.globalState.readAlerts,
        { id: alert.id, read_at: Date.now() },
      ],
    })

  const renderAlert = () => {
    if (!storage.globalState.enabled) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Notifications are turned off</AlertTitle>

          <p>Click below to start receiving notifications.</p>

          <Button
            variant="contained"
            onClick={() => {
              storage.setState({ enabled: true })
              browser.action.setBadgeText({ text: '' })
              enqueueSnackbar('Notifications are enabled', {
                variant: 'success',
              })
            }}
          >
            Enable notifications
          </Button>
        </MuiAlert>
      )
    }

    if (lastCycleError === ErrorType.FORBIDDEN && !captchaAttempted) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Upwork doesn't believe you are human</AlertTitle>

          <p>
            No worries!
            <br />
            Just solve{' '}
            <Link
              target="_blank"
              rel="noreferrer noopener"
              href="https://www.upwork.com/nx/find-work"
              onClick={() =>
                storage.setState({ lastCaptchaAttemptAt: Date.now() })
              }
            >
              a captcha
            </Link>{' '}
            to keep extension working.
          </p>
        </MuiAlert>
      )
    }

    if (lastCycleError === ErrorType.SERVER_ERROR) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Server Error</AlertTitle>

          <p>
            Seems like Upwork API is down (received 500 response).
            <br />
            You don't need to do anything, just wait.
          </p>
        </MuiAlert>
      )
    }

    if (lastCycleError === ErrorType.OTHER) {
      return (
        <MuiAlert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Whoops, something went wrong!</AlertTitle>
          <p>
            Something went wrong during jobs fetching.
            <br />
            Don't worry, the bug has been reported and is being worked on.
          </p>
        </MuiAlert>
      )
    }

    if (lastCycleError === ErrorType.NETWORK_ERROR) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Network Error</AlertTitle>
          <p>
            Seems like you have network issues.
            <br />
            Please check your internet connection.
          </p>
        </MuiAlert>
      )
    }

    if (lastCycleError === ErrorType.UNAUTHENTICATED && !loginAttempted) {
      return (
        <MuiAlert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Authentication required</AlertTitle>

          <p>
            It seems like you are not authentincated on upwork.com website.
            <br />
            Please login and wait for extension to load jobs (~1 minute).
          </p>

          <Button
            size="small"
            component="a"
            target="_blank"
            variant="contained"
            rel="noreferrer noopener"
            href="https://www.upwork.com/ab/account-security/login"
            onClick={() => storage.setState({ lastLoginAttemptAt: Date.now() })}
          >
            Login
          </Button>
        </MuiAlert>
      )
    }

    if (!lastCycleError && unreadAlert) {
      return (
        <MuiAlert
          sx={{ mb: 3 }}
          variant={unreadAlert.variant}
          severity={unreadAlert.severity}
          onClose={() => onAlertClose(unreadAlert)}
        >
          <AlertTitle {...unreadAlert.titleProps}>
            {unreadAlert.title}
          </AlertTitle>

          <Box sx={{ mt: 2 }}>
            {unreadAlert.renderBody({
              onInteracted: () => onAlertClose(unreadAlert),
            })}
          </Box>
        </MuiAlert>
      )
    }
  }

  const alert = renderAlert()

  useEffect(() => {
    if (!storage.globalState.enabled) {
      browser.action.setBadgeText({ text: 'OFF' })
      browser.action.setBadgeBackgroundColor({ color: colors.orange })
      return
    }

    if (!lastCycleError) {
      notifications.clearAll()
      browser.action.setBadgeText({ text: '' })
      return
    }
    // eslint-disable-next-line
  }, [])

  useEffect(
    () =>
      setUnseenIds((previousIds) => [
        ...previousIds,
        ...storage.jobs
          .filter(
            (job) => !job.__isSeen && !previousIds.includes(job.ciphertext)
          )
          .map((job) => job.ciphertext),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobsHash]
  )

  useEffect(
    () => {
      const id = setInterval(async () => {
        const [currentTab, currentWindow] = await Promise.all([
          browser.tabs.getCurrent(),
          browser.windows.getCurrent(),
        ])

        currentTab?.active &&
          currentWindow?.focused &&
          storage.jobs.some((job) => !job.__isSeen) &&
          (await storage.setJobs((jobs) =>
            jobs.map((job) => ({ ...job, __isSeen: true }))
          ))
      }, 300)

      return () => clearInterval(id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jobsHash]
  )

  useEffect(() => {
    eventEmitter.emit(Event.UNSEEN_IDS_UPDATED, unseenIds)

    return () => {
      eventEmitter.emit(Event.UNSEEN_IDS_UPDATED, [])
    }
  }, [unseenIds])

  return (
    <>
      <Dialog
        open={!storage.globalState.automationConsentAcknowledged}
        maxWidth="sm"
        fullWidth
      >
        <DialogContent sx={{ pt: 4, pb: 3 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, textAlign: 'center' }}
          >
            How should job checking work?
          </Typography>

          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', textAlign: 'center', mt: 1, mb: 3 }}
          >
            Choose how this extension looks for new jobs. You can change
            this anytime in Settings.
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            {(
              [
                {
                  mode: 'manual' as const,
                  icon: <TouchApp color="action" sx={{ fontSize: 36 }} />,
                  title: 'Manual',
                  description:
                    'Nothing happens on its own. Click "Check now" whenever you want to look for jobs.',
                  chipColor: 'success' as const,
                  chipLabel: 'No automated requests',
                },
                {
                  mode: 'automatic' as const,
                  icon: <AutoMode color="primary" sx={{ fontSize: 36 }} />,
                  title: 'Automatic',
                  description:
                    'Checks in the background every 15 minutes (adjustable) and notifies you.',
                  chipColor: 'warning' as const,
                  chipLabel: "May conflict with Upwork's ToS",
                },
              ] as const
            ).map((option) => {
              const isSelected = selectedMode === option.mode

              return (
                <Paper
                  key={option.mode}
                  variant="outlined"
                  onClick={() => setSelectedMode(option.mode)}
                  sx={{
                    flex: 1,
                    p: 2.5,
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    position: 'relative',
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? 'success.main' : 'divider',
                    bgcolor: isSelected
                      ? (theme) => alpha(theme.palette.success.main, 0.08)
                      : undefined,
                  }}
                >
                  {isSelected && (
                    <CheckCircle
                      color="success"
                      sx={{ position: 'absolute', top: 8, right: 8 }}
                    />
                  )}

                  {option.icon}

                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {option.title}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary' }}
                  >
                    {option.description}
                  </Typography>

                  <Chip
                    size="small"
                    color={option.chipColor}
                    variant="outlined"
                    label={option.chipLabel}
                    sx={{ mt: 'auto' }}
                  />
                </Paper>
              )
            })}
          </Box>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            variant="contained"
            disabled={selectedMode === null}
            onClick={onSubmitCheckMode}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={justChosenMode !== null} maxWidth="xs" fullWidth>
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircle color="success" sx={{ fontSize: 52, mb: 1 }} />

          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            You're all set!
          </Typography>

          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            {justChosenMode === 'manual'
              ? 'You\'re in Manual mode — use "Check now" whenever you want to look for jobs.'
              : "You're in Automatic mode — jobs will be checked every 15 minutes in the background."}
          </Typography>

          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            You can change this anytime in Settings.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button variant="contained" onClick={() => setJustChosenMode(null)}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {alert}

      {storage.globalState.checkMode === 'manual' && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Refresh />}
            disabled={checkingNow}
            onClick={onCheckNow}
          >
            {checkingNow ? 'Checking…' : 'Check now'}
          </Button>
        </Box>
      )}

      <JobsDashboard />
    </>
  )
}

export default Home
