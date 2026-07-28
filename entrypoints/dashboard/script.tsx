import './styles.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'

import AppProvider from '@/components/AppProvider'
import StorageProvider from '@/components/StorageProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { LocalizationProvider } from '@mui/x-date-pickers'
import React from 'react'
import ReactDOM from 'react-dom/client'
import Dashboard from './Dashboard'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <React.StrictMode>
    <StorageProvider>
      <AppProvider>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Dashboard />
        </LocalizationProvider>
      </AppProvider>
    </StorageProvider>
  </React.StrictMode>
)
