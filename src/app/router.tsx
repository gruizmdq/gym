import { createBrowserRouter } from 'react-router'
import { SignInPage } from '../features/account/SignInPage'
import { BodyPage } from '../features/body/BodyPage'
import { ExercisePage } from '../features/exercise/ExercisePage'
import { ExerciseHistoryPage } from '../features/history/ExerciseHistoryPage'
import { HistoryPage } from '../features/history/HistoryPage'
import { RoutinePage } from '../features/routine/RoutinePage'
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
  // One exercise's history is full screen, like the summary: no tab bar.
  { path: '/history/exercise/:exerciseId', Component: ExerciseHistoryPage },
  // The whole routine, one day at a time: full screen, opened from Today's rotation.
  { path: '/routine/:day?', Component: RoutinePage },
  { path: '/sign-in', Component: SignInPage },
])
