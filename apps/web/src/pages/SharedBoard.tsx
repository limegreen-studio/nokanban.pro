import { ExportDialog } from '@/components/dialogs/ExportDialog'
import { PinPromptDialog } from '@/components/dialogs/PinPromptDialog'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { Button } from '@/components/ui/button'
import {
  PopoverBody,
  PopoverButton,
  PopoverContent,
  PopoverHeader,
  PopoverRoot,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useSharedBoard } from '@/hooks/useSharedBoard'
import { useTheme } from '@/hooks/useTheme'
import { Download, Moon, MoreVertical, Plus, Sun } from 'lucide-react'
import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export function SharedBoard() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [showExport, setShowExport] = React.useState(false)
  const [showPinPrompt, setShowPinPrompt] = React.useState(false)
  const [pinError, setPinError] = React.useState<string | null>(null)

  const {
    data,
    loading,
    error,
    isPinSet,
    setPin,
    deleteBoard,
    createColumn,
    updateColumnTitle,
    deleteColumn,
    reorderColumns,
    createCard,
    updateCardContent,
    moveCard,
    deleteCard,
    reorderCards,
  } = useSharedBoard(name || '')

  const handlePinSubmit = (pin: string) => {
    setPinError(null)
    try {
      setPin(pin)
      setShowPinPrompt(false)
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Invalid PIN')
    }
  }

  const handleDeleteBoard = async () => {
    if (confirm('Delete this board? This cannot be undone.')) {
      try {
        await deleteBoard()
        navigate('/')
      } catch (err) {
        setPinError(err instanceof Error ? err.message : 'Failed to delete board')
      }
    }
  }

  const handleEdit = () => {
    if (!isPinSet) {
      setShowPinPrompt(true)
    }
  }

  const exportBoard = async () => {
    if (!data) return null

    const exportData = {
      version: 1,
      board: {
        title: data.title,
        columns: data.columns.map((col) => ({
          title: col.title,
          position: col.position,
          cards: col.cards.map((card) => ({
            content: card.content,
            position: card.position,
          })),
        })),
      },
      exportedAt: new Date().toISOString(),
    }

    return JSON.stringify(exportData, null, 2)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading board...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error || 'Board not found'}</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="self-center mt-0 md:mt-4 w-full md:w-[80vw]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4 ">
            <h1 className="text-xl font-bold">nokanban.pro</h1>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={toggleTheme}
              type="button"
              className="w-10 h-10 rounded-full border-none border-2 border-neutral-300 dark:border-neutral-700 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              ) : (
                <Moon className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
              )}
            </button>
          </div>
        </div>
        {error && (
          <div className="border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </header>

      {/* Board */}
      <div className="flex-1 overflow-hidden flex flex-col items-center">
        <div className="w-full md:max-w-[80%] flex flex-col h-full px-2 md:px-0">
          <div className="w-full px-4 flex flex-row items-center justify-between gap-2">
            <h1
              className="flex-1 text-xl md:text-3xl font-bold tracking-wider text-start py-4 md:py-8 text-foreground"
              title={isPinSet ? 'Title editing not available on shared boards' : undefined}
            >
              {data.title}
            </h1>

            <div className="flex flex-row gap-1 md:gap-2 flex-shrink-0">
              {!isPinSet && (
                <Button onClick={handleEdit} variant="outline" size="sm" className="md:h-10">
                  Unlock
                </Button>
              )}
              <PopoverRoot>
                <PopoverTrigger>
                  <button
                    className="w-10 h-10 rounded-full border-2 flex items-center justify-center hover:opacity-80 transition-opacity"
                    style={{ borderColor: '#FF7512' }}
                    type="button"
                  >
                    <MoreVertical className="w-5 h-5" style={{ color: '#FF7512' }} />
                  </button>
                </PopoverTrigger>
                <PopoverContent>
                  <PopoverHeader>Quick Actions</PopoverHeader>
                  <PopoverBody>
                    <PopoverButton onClick={() => setShowExport(true)}>
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </PopoverButton>

                    {isPinSet && (
                      <>
                        <PopoverButton onClick={() => createColumn('New Column')}>
                          <Plus className="w-4 h-4" />
                          <span>New Column</span>
                        </PopoverButton>
                        <PopoverButton onClick={handleDeleteBoard}>
                          <span className="text-red-600 dark:text-red-400">Delete Board</span>
                        </PopoverButton>
                      </>
                    )}
                    {!isPinSet && (
                      <PopoverButton onClick={handleEdit}>
                        <span>Unlock to Edit</span>
                      </PopoverButton>
                    )}
                  </PopoverBody>
                </PopoverContent>
              </PopoverRoot>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <KanbanBoard
              columns={data.columns}
              onAddColumn={isPinSet ? createColumn : undefined}
              onUpdateColumnTitle={isPinSet ? updateColumnTitle : undefined}
              onDeleteColumn={isPinSet ? deleteColumn : undefined}
              onReorderColumns={isPinSet ? reorderColumns : undefined}
              onAddCard={isPinSet ? createCard : undefined}
              onUpdateCard={isPinSet ? updateCardContent : undefined}
              onDeleteCard={isPinSet ? deleteCard : undefined}
              onMoveCard={isPinSet ? moveCard : undefined}
              onReorderCards={isPinSet ? reorderCards : undefined}
              readOnly={!isPinSet}
            />
          </div>
        </div>
      </div>

      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        onExport={exportBoard}
        boardTitle={data?.title || 'Board'}
      />

      <PinPromptDialog
        open={showPinPrompt}
        onOpenChange={setShowPinPrompt}
        onSubmit={handlePinSubmit}
        error={pinError || undefined}
      />
    </div>
  )
}
