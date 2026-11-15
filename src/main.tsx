import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import { recordRoutineVersion } from './data/actions'
import { requestPersistentStorage } from './pwa/storage'
import { UpdatePrompt } from './pwa/UpdatePrompt'
import { startSync } from './sync/start'
import './index.css'

void requestPersistentStorage()
void recordRoutineVersion()
startSync()

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in index.html')

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
    {/* Outside the router: the service worker registers even if the app opens on a session. */}
    <UpdatePrompt />
  </StrictMode>,
)
