import { useEffect, useState } from 'react'

export function useAhora(cadaMs: number): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), cadaMs)
    return () => clearInterval(id)
  }, [cadaMs])
  return ahora
}
