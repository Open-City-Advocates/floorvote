import { useConfig } from '../context/ConfigContext'

/**
 * Whether any covered state's provider publishes the legislature's own
 * calendar (`capabilities` in GET /config). Features gate on capabilities,
 * never on a state's name.
 */
export function useHasBodyEvents(): boolean {
  const { config } = useConfig()
  return Object.values(config?.capabilities ?? {}).some(c => c.bodyEvents)
}
