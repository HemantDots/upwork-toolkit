import { browser } from '#imports'
import upworkApi, { FeedType } from '@/api/upwork'
import Storage, { StorageInterface } from '@/contexts/storage'
import analytics from '@/utils/analytics'
import colors from '@/utils/colors'
import { Event, eventEmitter } from '@/utils/events'
import extension from '@/utils/extension'
import { DarkMode as DarkModeType } from '@/utils/globalState'
import notifications from '@/utils/notifications'
import timer from '@/utils/timer'
import {
  DarkMode,
  DynamicFeed,
  MoreTime,
  OpenInNew,
  PowerSettingsNew,
  Stop,
  Sync,
  VolumeUp,
} from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Radio,
  Select,
  Slider,
  Snackbar,
  Switch,
  TextField,
} from '@mui/material'
import { useContext, useEffect, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import ScheduleTable from '../ScheduleTable'

const PRESET_INTERVALS = [5, 15, 30, 60]

const Settings = () => {
  const [searchParams] = useSearchParams()
  const storage = useContext<StorageInterface>(Storage)

  const [versionClicks, setVersionClicks] = useState(0)

  const [customIntervalOpen, setCustomIntervalOpen] = useState(false)

  const [intervalInput, setIntervalInput] = useState(
    String(storage.globalState.checkIntervalMinutes)
  )

  const [pendingLowInterval, setPendingLowInterval] = useState<number | null>(
    null
  )

  const [intervalSavedMessage, setIntervalSavedMessage] = useState<
    string | null
  >(null)

  const [killSwitchAlarms, setKillSwitchAlarms] = useState<string[] | null>(
    null
  )

  const onKillSwitch = async () => {
    await storage.setState({ checkMode: 'manual' })
    await browser.alarms.clear(extension.Cycles.FETCH_JOBS)

    const remainingAlarms = await browser.alarms.getAll()
    setKillSwitchAlarms(remainingAlarms.map((alarm) => alarm.name))
  }

  useEffect(() => {
    setIntervalInput(String(storage.globalState.checkIntervalMinutes))
  }, [storage.globalState.checkIntervalMinutes])

  const saveCheckInterval = async (minutes: number) => {
    await storage.setState({ checkIntervalMinutes: minutes })
    setIntervalSavedMessage(
      `Check frequency set to every ${minutes} minute${minutes === 1 ? '' : 's'}`
    )
  }

  const commitIntervalInput = () => {
    const minutes = Math.max(1, Math.round(Number(intervalInput)) || 1)

    if (minutes < 5) {
      setIntervalInput(String(minutes))
      setPendingLowInterval(minutes)
      return
    }

    saveCheckInterval(minutes)
  }

  const [feedSelectOpen, setFeedSelectOpen] = useState(
    searchParams.get('feedSelectOpen') === 'true'
  )

  const [nightModeSelectOpen, setNightModeSelectOpen] = useState(
    searchParams.get('nightModeOpen') === 'true'
  )

  const addSchedule = searchParams.get('addSchedule') === 'true'

  const onEnabled = async (enabled: boolean) =>
    await Promise.all([
      storage.setState({ enabled }),
      browser.action.setBadgeText({ text: enabled ? '' : 'OFF' }),
      browser.action.setBadgeBackgroundColor({ color: colors.orange }),
    ])

  const onVolumeChange = async (volume: number) =>
    await Promise.all([
      notifications.playSound(volume),

      storage.setState((previousState) => ({
        ...previousState,
        soundSettings: {
          ...previousState.soundSettings,
          volume,
        },
      })),
    ])

  useEffect(() => {
    const enableSchedule = async () => {
      await timer.resolveIn(200)
      await storage.setState({ schedulingEnabled: true })
    }

    addSchedule && enableSchedule()
  }, [])

  useEffect(() => {
    if (versionClicks > 10) {
      eventEmitter.emit(Event.DEBUG_MODE_TRIGGERED)
      analytics.sendEvent({ event: analytics.Event.DEBUG_MODE_TRIGGERED })
    }
  }, [versionClicks])

  return (
    <Paper variant="outlined">
      <List
        sx={{
          '& .MuiListItemIcon-root': {
            justifyContent: 'center',
          },
        }}
      >
        <ListItem
          secondaryAction={
            <Switch
              defaultChecked={storage.globalState.enabled}
              onChange={(e, enabled) => onEnabled(enabled)}
            />
          }
        >
          <ListItemIcon>
            <PowerSettingsNew />
          </ListItemIcon>

          <ListItemText
            primary="Enabled"
            secondary="Leave it on to receive notifications"
          />
        </ListItem>

        <ListItem
          secondaryAction={
            <Select
              open={feedSelectOpen}
              value={storage.globalState.feedType}
              renderValue={(feedType) => feedType}
              onOpen={() => setFeedSelectOpen(true)}
              onClose={() => setFeedSelectOpen(false)}
              onChange={(e) =>
                storage.setState({
                  feedType: e.target.value as FeedType,
                })
              }
              MenuProps={{
                slotProps: { paper: { sx: { maxWidth: '400px' } } },
              }}
            >
              {Object.entries(upworkApi.feedOptions).map(
                ([feedType, option], index, options) => (
                  <MenuItem
                    key={feedType}
                    value={feedType}
                    sx={{ py: 1, gap: 2 }}
                    divider={options.length !== index + 1}
                  >
                    <Radio
                      checked={storage.globalState.feedType === feedType}
                    />

                    <ListItemText
                      primary={<strong>{feedType}</strong>}
                      secondary={
                        <span
                          dangerouslySetInnerHTML={{
                            __html: [
                              option.description.charAt(0).toUpperCase(),
                              option.description.slice(1),
                            ].join(''),
                          }}
                        />
                      }
                      slotProps={{
                        secondary: { sx: { mt: 1, whiteSpace: 'normal' } },
                      }}
                    />
                  </MenuItem>
                )
              )}
            </Select>
          }
        >
          <ListItemIcon>
            <DynamicFeed />
          </ListItemIcon>

          <ListItemText
            primary="Feed source"
            secondary={
              <>
                Upwork has{' '}
                <Link component={RouterLink} to="/faq?expanded=0">
                  three job channels/feeds
                </Link>
              </>
            }
          />
        </ListItem>

        <ListItem
          secondaryAction={
            <Switch
              checked={storage.globalState.checkMode === 'automatic'}
              onChange={(e, isAutomatic) =>
                storage.setState({
                  checkMode: isAutomatic ? 'automatic' : 'manual',
                })
              }
            />
          }
        >
          <ListItemIcon>
            <Sync />
          </ListItemIcon>

          <ListItemText
            primary="Automatic background checking"
            secondary="Off: only checks when you click Check now. On: checks in the background automatically."
          />
        </ListItem>

        <Collapse in={storage.globalState.checkMode === 'automatic'}>
          <ListItem
            secondaryAction={
              <Select
                value={
                  PRESET_INTERVALS.includes(
                    storage.globalState.checkIntervalMinutes
                  )
                    ? storage.globalState.checkIntervalMinutes
                    : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setCustomIntervalOpen(true)
                    return
                  }

                  setCustomIntervalOpen(false)
                  saveCheckInterval(e.target.value as number)
                }}
              >
                <MenuItem value={5}>Every 5 minutes</MenuItem>
                <MenuItem value={15}>Every 15 minutes</MenuItem>
                <MenuItem value={30}>Every 30 minutes</MenuItem>
                <MenuItem value={60}>Every 60 minutes</MenuItem>
                <MenuItem value="custom">Custom&hellip;</MenuItem>
              </Select>
            }
          >
            <ListItemIcon />

            <ListItemText
              primary="Check frequency"
              secondary="Less frequent checking means fewer automated requests to Upwork"
            />
          </ListItem>

          <Collapse
            in={
              customIntervalOpen ||
              !PRESET_INTERVALS.includes(storage.globalState.checkIntervalMinutes)
            }
          >
            <ListItem sx={{ pl: 7, pr: 2.25, gap: 2 }}>
              <TextField
                type="number"
                size="small"
                label="Minutes"
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                value={intervalInput}
                onChange={(e) => setIntervalInput(e.target.value)}
                onBlur={commitIntervalInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitIntervalInput()
                  }
                }}
              />
            </ListItem>
          </Collapse>
        </Collapse>

        <ListItem
          secondaryAction={
            <Button color="error" variant="outlined" onClick={onKillSwitch}>
              Stop now
            </Button>
          }
        >
          <ListItemIcon>
            <Stop />
          </ListItemIcon>

          <ListItemText
            primary="Stop all automatic checking"
            secondary="Switches to manual mode and clears any scheduled background task — with visible confirmation below"
          />
        </ListItem>

        <Collapse in={killSwitchAlarms !== null}>
          <ListItem sx={{ pl: 7, pr: 2.25 }}>
            <Alert
              sx={{ width: '100%' }}
              severity={
                killSwitchAlarms?.includes(extension.Cycles.FETCH_JOBS)
                  ? 'warning'
                  : 'success'
              }
            >
              {killSwitchAlarms?.includes(extension.Cycles.FETCH_JOBS)
                ? `Still scheduled: ${killSwitchAlarms.join(', ')}`
                : '0 job-check background tasks running — confirmed.'}
            </Alert>
          </ListItem>
        </Collapse>

        <Dialog
          open={pendingLowInterval !== null}
          onClose={() => {
            setIntervalInput(String(storage.globalState.checkIntervalMinutes))
            setPendingLowInterval(null)
          }}
        >
          <DialogTitle>Check every {pendingLowInterval} minute(s)?</DialogTitle>

          <DialogContent>
            <DialogContentText>
              Checking this often closely resembles automated bot activity and
              may violate Upwork's Terms of Service. 15+ minutes is
              recommended. 1 minute is the lowest allowed.
            </DialogContentText>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={() => {
                setIntervalInput(
                  String(storage.globalState.checkIntervalMinutes)
                )
                setPendingLowInterval(null)
              }}
            >
              Cancel
            </Button>

            <Button
              color="warning"
              variant="contained"
              onClick={() => {
                saveCheckInterval(pendingLowInterval as number)
                setPendingLowInterval(null)
              }}
            >
              Set anyway
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={intervalSavedMessage !== null}
          autoHideDuration={3000}
          onClose={() => setIntervalSavedMessage(null)}
          message={intervalSavedMessage}
        />

        {storage.globalState.feedType === 'My Feed / Saved Searches' && (
          <ListItem
            sx={{ mb: 1 }}
            secondaryAction={
              <Link
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textDecoration: 'none' }}
                href="https://www.upwork.com/nx/jobs/search/"
              >
                <Button endIcon={<OpenInNew />}>Configure</Button>
              </Link>
            }
          ></ListItem>
        )}

        <ListItem
          secondaryAction={
            <Switch
              onChange={(e, schedulingEnabled) =>
                storage.setState({ schedulingEnabled })
              }
              checked={storage.globalState.schedulingEnabled}
            />
          }
        >
          <ListItemIcon>
            <MoreTime />
          </ListItemIcon>

          <ListItemText
            primary="Scheduled notifications"
            secondary="Get notifications only when you need them"
          />
        </ListItem>

        <Collapse in={storage.globalState.schedulingEnabled}>
          <ListItem
            sx={{
              py: 3,
              px: 8,
              alignItems: 'center',
              flexDirection: 'column',
            }}
          >
            <ScheduleTable
              schedules={storage.globalState.schedules}
              onCreated={(schedule) => {
                storage.setState((previousState) => ({
                  ...previousState,
                  schedules: [...previousState.schedules, schedule],
                }))
              }}
              onDelete={(schedule) =>
                storage.setState((previousState) => ({
                  ...previousState,
                  schedules: previousState.schedules.filter(
                    (previousSchedule) => previousSchedule.id !== schedule.id
                  ),
                }))
              }
              onUpdated={(schedule) =>
                storage.setState((previousState) => ({
                  ...previousState,
                  schedules: previousState.schedules.map((previousSchedule) =>
                    previousSchedule.id === schedule.id
                      ? schedule
                      : previousSchedule
                  ),
                }))
              }
            />
          </ListItem>
        </Collapse>

        <ListItem
          secondaryAction={
            <Switch
              onChange={(e, enabled) =>
                storage.setState((previousState) => ({
                  ...previousState,
                  soundSettings: {
                    ...previousState.soundSettings,
                    enabled,
                  },
                }))
              }
              defaultChecked={storage.globalState.soundSettings.enabled}
            />
          }
        >
          <ListItemIcon>
            <VolumeUp />
          </ListItemIcon>

          <ListItemText
            primary="Notification sound"
            secondary="Don't miss a single job with sound notification"
          />
        </ListItem>

        <Collapse in={storage.globalState.soundSettings.enabled}>
          <ListItem>
            <Box component={ListItemText} sx={{ pl: 7, pr: 2.25 }}>
              <Slider
                min={0}
                max={100}
                defaultValue={storage.globalState.soundSettings.volume}
                onChangeCommitted={(e, volume) =>
                  onVolumeChange(volume as number)
                }
              />
            </Box>
          </ListItem>
        </Collapse>

        <ListItem
          secondaryAction={
            <Select
              open={nightModeSelectOpen}
              value={storage.globalState.darkMode}
              onOpen={() => setNightModeSelectOpen(true)}
              onClose={() => setNightModeSelectOpen(false)}
              onChange={(e) =>
                storage.setState({ darkMode: e.target.value as DarkModeType })
              }
            >
              <MenuItem value="true">On</MenuItem>
              <MenuItem value="false">Off</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          }
        >
          <ListItemIcon>
            <DarkMode />
          </ListItemIcon>

          <ListItemText
            primary="Night mode"
            secondary="Help your eyes in low light settings"
          />
        </ListItem>

        <ListItem sx={{ pr: 4, textAlign: 'right' }}>
          <ListItemText
            secondary={
              <Link
                href="#"
                underline="hover"
                onClick={(e) => {
                  e.preventDefault()
                  setVersionClicks((value) => value + 1)
                }}
              >
                v{extension.version}
              </Link>
            }
          />
        </ListItem>
      </List>
    </Paper>
  )
}

export default Settings
