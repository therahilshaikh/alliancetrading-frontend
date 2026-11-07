import { useState } from 'react'
import { useIdleTimer } from 'react-idle-timer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth'

const IDLE_MS = 30 * 60 * 1000
const WARN_MS = 2 * 60 * 1000

export function IdleLogout() {
  const { logout } = useAuth()
  const [warnOpen, setWarnOpen] = useState(false)

  const timer = useIdleTimer({
    timeout: IDLE_MS,
    promptBeforeIdle: WARN_MS,
    onPrompt: () => setWarnOpen(true),
    onIdle: () => {
      setWarnOpen(false)
      void logout()
    },
    onActive: () => setWarnOpen(false),
    debounce: 500,
    crossTab: true,
  })

  // While the warning is shown the timer ignores mouse/keyboard activity and
  // keeps counting down; only activate() resets it (in every tab, via
  // crossTab). Closing the warning without it would still sign out later.
  function staySignedIn() {
    timer.activate()
    setWarnOpen(false)
  }

  return (
    <AlertDialog open={warnOpen} onOpenChange={(open) => (open ? setWarnOpen(true) : staySignedIn())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You'll be signed out soon</AlertDialogTitle>
          <AlertDialogDescription>
            No activity detected. For security, this session will end in about 2 minutes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction asChild>
            <Button onClick={staySignedIn}>Stay signed in</Button>
          </AlertDialogAction>
          <Button variant="outline" onClick={() => void logout()}>
            Sign out now
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
