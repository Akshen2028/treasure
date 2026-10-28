import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { router } from '@/app/router'
import { AccessProvider } from '@/auth/AccessProvider'
import { DataProvider } from '@/data/DataProvider'
import { initMonitoring } from '@/lib/monitoring'

import './index.css'

initMonitoring()

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <AccessProvider>
      <DataProvider>
        <RouterProvider router={router} />
      </DataProvider>
    </AccessProvider>
  </StrictMode>,
)
