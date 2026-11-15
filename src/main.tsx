import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './app/router'
import { registrarVersionRutina } from './datos/acciones'
import { AvisoVersionNueva } from './pwa/AvisoVersionNueva'
import { pedirAlmacenamientoPersistente } from './pwa/almacenamiento'
import './index.css'

void pedirAlmacenamientoPersistente()
void registrarVersionRutina()

const root = document.getElementById('root')
if (!root) throw new Error('Falta el elemento #root en index.html')

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
    {/* Fuera del router: el service worker se registra aunque la app se abra en una sesión. */}
    <AvisoVersionNueva />
  </StrictMode>,
)
