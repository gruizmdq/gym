import { createBrowserRouter } from 'react-router'
import { AjustesPage } from '../features/ajustes/AjustesPage'
import { CuerpoPage } from '../features/cuerpo/CuerpoPage'
import { EjercicioPage } from '../features/ejercicio/EjercicioPage'
import { HistorialPage } from '../features/historial/HistorialPage'
import { HoyPage } from '../features/hoy/HoyPage'
import { ResumenPage } from '../features/resumen/ResumenPage'
import { SesionLayout, SesionPage } from '../features/sesion/SesionPage'
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
  // La sesión activa es pantalla completa: sin tab bar y con la pantalla siempre prendida.
  {
    path: '/sesion',
    Component: SesionLayout,
    children: [
      { index: true, Component: SesionPage },
      { path: 'ejercicio/:slotId', Component: EjercicioPage },
    ],
  },
  { path: '/resumen/:id', Component: ResumenPage },
])
