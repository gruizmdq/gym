import { createBrowserRouter } from 'react-router'
import { SignInPage } from '../features/account/SignInPage'
import { BodyPage } from '../features/body/BodyPage'
import { ExercisePage } from '../features/exercise/ExercisePage'
import { HistoryPage } from '../features/history/HistoryPage'
import { SessionLayout, SessionPage } from '../features/session/SessionPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { SummaryPage } from '../features/summary/SummaryPage'
import { TodayPage } from '../features/today/TodayPage'
import { AppShell } from './AppShell'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: TodayPage },
      { path: 'history', Component: HistoryPage },
      { path: 'body', Component: BodyPage },
      { path: 'settings', Component: SettingsPage },
    ],
  },
  // The active session is full screen: no tab bar and the screen always on.
  {
    path: '/session',
    Component: SessionLayout,
    children: [
      { index: true, Component: SessionPage },
      { path: 'exercise/:slotId', Component: ExercisePage },
    ],
  },
  { path: '/summary/:id', Component: SummaryPage },
  { path: '/sign-in', Component: SignInPage },
])
