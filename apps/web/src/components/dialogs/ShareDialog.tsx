import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { AlertCircle } from 'lucide-react'
import * as React from 'react'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardName: string
  onPublish?: (pin: string) => void | Promise<void>
}

export function ShareDialog({ open, onOpenChange, boardName, onPublish }: ShareDialogProps) {
  const [password, setPassword] = React.useState('')
  const [isPublishing, setIsPublishing] = React.useState(false)
  const id = React.useId()

  const handlePublish = async () => {
    if (password.length === 4 && onPublish) {
      setIsPublishing(true)
      try {
        await onPublish(password)
        setPassword('')
      } catch (err) {
        console.error('Failed to publish:', err)
      } finally {
        setIsPublishing(false)
      }
    }
  }

  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        const otpContainer = document.querySelector(`#${id}`)
        if (otpContainer) {
          const firstInput = otpContainer.querySelector('input') as HTMLInputElement
          if (firstInput) {
            firstInput.focus()
          }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
    setPassword('')
    setIsPublishing(false)
  }, [open, id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[25rem] bg-black text-white border border-neutral-800">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <DialogTitle className="text-lg font-normal text-white">Share</DialogTitle>
          </div>
          <DialogDescription className="text-neutral-400 text-base">
            Share it with your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-5">
          <div className="space-y-4">
            <h3 className="text-lg font-normal text-white">Password</h3>
            <div className="flex justify-center">
              <InputOTP
                id={id}
                maxLength={4}
                value={password}
                onChange={(value) => setPassword(value.replace(/\D/g, ''))}
                pattern="[0-9]*"
                inputMode="numeric"
                disabled={isPublishing}
              >
                <InputOTPGroup className="flex flex-row gap-3 justify-between ">
                  <InputOTPSlot
                    index={0}
                    className="h-15 w-15 rounded-2xl border-2 border-neutral-700 bg-transparent text-2xl font-semibold text-white focus:border-orange-500"
                  />
                  <InputOTPSlot
                    index={1}
                    className="h-15 w-15 rounded-2xl border-2 border-neutral-700 bg-transparent text-2xl font-semibold text-white focus:border-orange-500"
                  />
                  <InputOTPSlot
                    index={2}
                    className="h-15 w-15 rounded-2xl border-2 border-neutral-700 bg-transparent text-2xl font-semibold text-white focus:border-orange-500"
                  />
                  <InputOTPSlot
                    index={3}
                    className="h-15 w-15 rounded-2xl border-2 border-neutral-700 bg-transparent text-2xl font-semibold text-white focus:border-orange-500"
                  />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <Button
            onClick={handlePublish}
            disabled={password.length !== 4 || isPublishing}
            className="w-full h-14 text-md font-medium rounded-xl disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: '#FF7512' }}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>

          <div
            className="rounded-2xl p-4 flex gap-3 items-start"
            style={{
              backgroundColor: 'rgba(255, 117, 18, 0.1)',
              border: '2px solid #FF7512',
            }}
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#FF7512' }} />
            <p className="text-xs" style={{ color: '#FF7512' }}>
              Kanban board will be nuked after 30 days of inactivity from the user side.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
