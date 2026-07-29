import GithubIcon from '@/components/GithubIcon'
import XIcon from '@/components/XIcon'
import Storage, { StorageInterface } from '@/contexts/storage'
import { Event, eventEmitter } from '@/utils/events'
import {
  Article,
  BugReport,
  Description,
  HelpOutlined,
  Settings as SettingsIcon,
  Work,
} from '@mui/icons-material'
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  SvgIconProps,
  Tab,
  Tabs,
  Toolbar,
} from '@mui/material'
import { useContext, useEffect, useState } from 'react'
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom'

type MenuLink = {
  text: string
  href: string
  icon: React.ComponentType<SvgIconProps>
  new?: boolean
  count?: number
}

const Layout = () => {
  const location = useLocation()
  const storage = useContext<StorageInterface>(Storage)

  const [debugMode, setDebugMode] = useState(false)
  const [unseenIds, setUnseenIds] = useState<string[]>([])

  const unseenJobs = storage.jobs.filter((job) => !job.__isSeen)

  const socialLinks = [
    { href: import.meta.env.WXT_GITHUB_URL, label: 'GitHub', Icon: GithubIcon },
    { href: import.meta.env.WXT_X_URL, label: 'X', Icon: XIcon, fontSize: 18 },
  ].filter((link) => link.href)

  const menuLinks: MenuLink[] = [
    {
      text: 'Jobs',
      href: '',
      icon: Work,
      count: unseenIds.length || unseenJobs.length,
    },
    { text: 'Cover letter', href: 'cover-letter', icon: Description, new: true },
    { text: 'Settings', href: 'settings', icon: SettingsIcon },
    ...(import.meta.env.DEV || debugMode
      ? [
          { text: 'Debug', href: 'debug', icon: BugReport },
          { text: 'Logs', href: 'logs', icon: Article },
        ]
      : []),
    { text: 'FAQs', href: 'faq', icon: HelpOutlined },
  ]

  const currentTab = menuLinks.findIndex(
    (link) => `/${link.href}` === location.pathname
  )

  // The Jobs page is a wide data table (many columns) — let it use the
  // full viewport instead of the "lg" reading-width cap the other,
  // text/form-based pages keep.
  const isJobsPage = location.pathname === '/'

  useEffect(() => {
    const enableDebugMode = () => setDebugMode(true)

    eventEmitter.on(Event.UNSEEN_IDS_UPDATED, setUnseenIds)
    eventEmitter.on(Event.DEBUG_MODE_TRIGGERED, enableDebugMode)

    return () => {
      eventEmitter.off(Event.UNSEEN_IDS_UPDATED, setUnseenIds)
      eventEmitter.off(Event.DEBUG_MODE_TRIGGERED, enableDebugMode)
    }
  }, [eventEmitter])

  return (
    <>
      <AppBar
        elevation={0}
        position="fixed"
        sx={{ background: '#000', color: '#fff' }}
      >
        <Container maxWidth={false} sx={{ px: { xs: 2, md: 3 } }}>
          <Toolbar disableGutters sx={{ gap: 2 }}>
            <Button
              to="/"
              variant="text"
              color="secondary"
              component={RouterLink}
              sx={{ borderRadius: 0, px: 0.75, alignSelf: 'stretch', flexShrink: 0 }}
            >
              Upwork Job Watcher
            </Button>

            <Box sx={{ flexGrow: 1 }} />

            <Tabs
              value={currentTab !== -1 ? currentTab : 0}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              textColor="inherit"
              indicatorColor="secondary"
              sx={{
                flexShrink: 1,
                minHeight: 0,
                '& .MuiTabs-indicator': { height: 3 },
              }}
            >
              {menuLinks.map((link) => (
                <Tab
                  to={link.href}
                  key={link.href}
                  component={RouterLink}
                  sx={{
                    minHeight: 48,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    '&.Mui-selected': { color: '#fff' },
                  }}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <link.icon sx={{ fontSize: 18 }} />
                      {link.text}
                      {link.new || (link.count && link.count > 0) ? (
                        <Chip
                          size="small"
                          color="primary"
                          sx={{ fontWeight: 600 }}
                          label={link.count || 'New'}
                        />
                      ) : null}
                    </Box>
                  }
                />
              ))}
            </Tabs>

            {socialLinks.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                {socialLinks.map(({ href, label, Icon, fontSize }) => (
                  <IconButton
                    key={label}
                    href={href}
                    component="a"
                    target="_blank"
                    color="inherit"
                    aria-label={label}
                    rel="noopener noreferrer"
                  >
                    <Icon sx={{ fontSize: fontSize || 24 }} />
                  </IconButton>
                ))}
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>
      <Toolbar />
      <Container maxWidth={isJobsPage ? false : 'lg'} sx={{ mt: 2, pb: 3 }}>
        <Outlet />
      </Container>
    </>
  )
}

export default Layout
