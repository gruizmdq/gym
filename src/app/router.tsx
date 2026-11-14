import { createBrowserRouter } from 'react-router'
import { AjustesPage } from '../features/ajustes/AjustesPage'
import { CuerpoPage } from '../features/cuerpo/CuerpoPage'
import { HistorialPage } from '../features/historial/HistorialPage'
import { HoyPage } from '../features/hoy/HoyPage'
import { SesionPage } from '../features/sesion/SesionPage'
import { AppShell } from './AppShell'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AppShell,
    children: [
      { index: true, Component: HoyPage },
      { path: 'historial', Component: HistorialPage },
      { path: 'cuerpo', Component: CuerpoPage },
      { path: 'ajustes', Component: AjustesPage },
    ],
  },
  // La sesión activa es pantalla completa: sin tab bar.
  { path: '/sesion', Component: SesionPage },
])
