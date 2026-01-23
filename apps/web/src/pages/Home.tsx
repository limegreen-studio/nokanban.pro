import { ExportDialog } from '@/components/dialogs/ExportDialog'
import { ImportDialog } from '@/components/dialogs/ImportDialog'
import { ShareDialog } from '@/components/dialogs/ShareDialog'
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
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useLocalBoard } from '@/hooks/useLocalBoard'
import { useTheme } from '@/hooks/useTheme'
import { db } from '@/lib/db'
import { boardService } from '@/services/board.service'
import { Download, Moon, MoreVertical, Plus, Sun, Upload } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ulid } from 'ulid'

const DEFAULT_BOARD_ID = 'home-board'

export function Home() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [showShare, setShowShare] = React.useState(false)
  const [showImport, setShowImport] = React.useState(false)
  const [showExport, setShowExport] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isInitialized, setIsInitialized] = React.useState(false)
  const [editingTitle, setEditingTitle] = React.useState(false)

  const {
    data,
    loading,
    updateBoardTitle,
    createColumn,
    updateColumnTitle,
    deleteColumn,
    reorderColumns,
    createCard,
    updateCardContent,
    moveCard,
    deleteCard,
    reorderCards,
    exportBoard,
    importBoard,
    refresh,
  } = useLocalBoard(DEFAULT_BOARD_ID)

  // Initialize default board with 3 columns on mount
  React.useEffect(() => {
    const initBoard = async () => {
      const existing = await db.boards.get(DEFAULT_BOARD_ID)
      if (!existing) {
        const now = new Date()
        await db.boards.add({
          id: DEFAULT_BOARD_ID,
          name: 'home',
          title: 'My Kanban Board',
          createdAt: now,
          updatedAt: now,
        })

        // Create default 3 columns: To-do, In Progress, Done
        const todoColId = ulid()
        const inProgressColId = ulid()
        const doneColId = ulid()

        await db.columns.bulkAdd([
          {
            id: todoColId,
            boardId: DEFAULT_BOARD_ID,
            title: 'To-do',
            position: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: inProgressColId,
            boardId: DEFAULT_BOARD_ID,
            title: 'In Progress',
            position: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: doneColId,
            boardId: DEFAULT_BOARD_ID,
            title: 'Done',
            position: 2,
            createdAt: now,
            updatedAt: now,
          },
        ])

        // Create 3 default cards for each column
        await db.cards.bulkAdd([
          // To-do cards
          {
            id: ulid(),
            columnId: todoColId,
            content: 'Task 1',
            position: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: ulid(),
            columnId: todoColId,
            content: 'Task 2',
            position: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: ulid(),
            columnId: todoColId,
            content: 'Task 3',
            position: 2,
            createdAt: now,
            updatedAt: now,
          },
          // In Progress cards
          {
            id: ulid(),
            columnId: inProgressColId,
            content: 'Task 1',
            position: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: ulid(),
            columnId: inProgressColId,
            content: 'Task 2',
            position: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: ulid(),
            columnId: inProgressColId,
            content: 'Task 3',
            position: 2,
            createdAt: now,
            updatedAt: now,
          },
          // Done cards
          {
            id: ulid(),
            columnId: doneColId,
            content: 'Task 1',
            position: 0,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: ulid(),
            columnId: doneColId,
            content: 'Task 2',
            position: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: ulid(),
            columnId: doneColId,
            content: 'Task 3',
            position: 2,
            createdAt: now,
            updatedAt: now,
          },
        ])

        // Refresh the hook to load the newly created board
        refresh()
      }
      setIsInitialized(true)
    }
    initBoard()
  }, [refresh])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCreateTask: () => {
      // Focus first column's "add card" button
      if (data && data.columns.length > 0) {
        // Trigger add card for first column
        const firstColumn = data.columns[0]
        if (firstColumn) {
          createCard(firstColumn.id, '')
        }
      }
    },
    onShare: () => {
      handleShare()
    },
  })

  // Helper function to slugify text
  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .slice(0, 50) // Limit to 50 characters
  }

  const handleShare = () => {
    if (!data) return
    setError(null)
    setShowShare(true)
  }

  const handlePublishShare = async (pin: string) => {
    if (!data) return

    const boardName = slugify(data.board.title)
    const boardTitle = data.board.title

    // Validate board name
    if (!boardName || boardName.length < 4) {
      setError('Board title must generate a valid URL name (at least 4 characters)')
      return
    }

    try {
      // Create shared board on server
      await boardService.createBoard(boardName, boardTitle, pin)

      // Upload columns and cards
      boardService.setPin(pin)
      for (const col of data.columns) {
        const newCol = await boardService.createColumn(boardName, col.title, col.position)
        for (const card of col.cards) {
          await boardService.createCard(boardName, newCol.id, card.content, card.position)
        }
      }

      // Navigate to shared board
      navigate(`/${boardName}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share board')
      setShowShare(false)
    }
  }

  const handleImport = async (jsonData: string) => {
    try {
      await importBoard(jsonData)
      setShowImport(false)
      refresh()
    } catch {
      throw new Error('Failed to import board')
    }
  }

  const handleUpdateTitle = (title: string) => {
    if (title.trim()) {
      updateBoardTitle(title.trim())
    }
    setEditingTitle(false)
  }

  if (!isInitialized || loading || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
            {editingTitle ? (
              <input
                defaultValue={data.board.title}
                className="flex-1 text-xl md:text-3xl font-bold tracking-wider text-start py-4 md:py-8 text-foreground bg-transparent border-none outline-none focus:ring-0"
                onBlur={(e) => handleUpdateTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateTitle(e.currentTarget.value)
                  } else if (e.key === 'Escape') {
                    setEditingTitle(false)
                  }
                }}
              />
            ) : (
              <h1
                className="flex-1 text-xl md:text-3xl font-bold tracking-wider text-start py-4 md:py-8 text-foreground cursor-pointer hover:opacity-70 transition-opacity"
                onDoubleClick={() => setEditingTitle(true)}
                title="Double click to edit"
              >
                {data.board.title}
              </h1>
            )}

            <div className="flex flex-row gap-1 md:gap-2 shrink-0">
              <Button
                onClick={handleShare}
                variant="default"
                size="sm"
                className="md:h-10"
                style={{ backgroundColor: '#FF7512' }}
              >
                Share
              </Button>
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
                    <PopoverButton onClick={() => createColumn('New Column')}>
                      <Plus className="w-4 h-4" />
                      <span>New Column</span>
                    </PopoverButton>
                    <PopoverButton onClick={() => setShowImport(true)}>
                      <Upload className="w-4 h-4" />
                      <span>Import</span>
                    </PopoverButton>
                    <PopoverButton onClick={() => setShowExport(true)}>
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </PopoverButton>
                    <PopoverButton onClick={() => navigate('/new')}>
                      <Plus className="w-4 h-4" />
                      <span>New Board</span>
                    </PopoverButton>
                  </PopoverBody>
                </PopoverContent>
              </PopoverRoot>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <KanbanBoard
              columns={data.columns}
              onAddColumn={createColumn}
              onUpdateColumnTitle={updateColumnTitle}
              onDeleteColumn={deleteColumn}
              onReorderColumns={reorderColumns}
              onAddCard={createCard}
              onUpdateCard={updateCardContent}
              onDeleteCard={deleteCard}
              onMoveCard={moveCard}
              onReorderCards={reorderCards}
            />
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        boardName={slugify(data?.board.title || '')}
        onPublish={handlePublishShare}
      />

      <ImportDialog open={showImport} onOpenChange={setShowImport} onImport={handleImport} />

      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        onExport={exportBoard}
        boardTitle={data.board.title}
      />
    </div>
  )
}
