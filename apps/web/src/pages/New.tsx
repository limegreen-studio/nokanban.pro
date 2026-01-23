import { useLocalBoard } from '@/hooks/useLocalBoard'
import { db } from '@/lib/db'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ulid } from 'ulid'

const DEFAULT_BOARD_ID = 'home-board'

export function New() {
  const navigate = useNavigate()
  const { exportBoard } = useLocalBoard(DEFAULT_BOARD_ID)
  const [status, setStatus] = React.useState<'checking' | 'exporting' | 'creating' | 'done'>(
    'checking',
  )

  React.useEffect(() => {
    const createNewBoard = async () => {
      try {
        // Check if the home board exists
        const existing = await db.boards.get(DEFAULT_BOARD_ID)

        if (existing) {
          // Export the existing board
          setStatus('exporting')
          const exportedData = await exportBoard()

          // Trigger download
          if (exportedData) {
            const blob = new Blob([exportedData], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${existing.title}-${new Date().toISOString().split('T')[0]}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }

          // Delete the old board and its associated data
          await db.cards
            .where('columnId')
            .anyOf(
              (await db.columns.where('boardId').equals(DEFAULT_BOARD_ID).toArray()).map(
                (c) => c.id,
              ),
            )
            .delete()
          await db.columns.where('boardId').equals(DEFAULT_BOARD_ID).delete()
          await db.boards.delete(DEFAULT_BOARD_ID)
        }

        // Create a fresh new board
        setStatus('creating')
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

        setStatus('done')

        // Navigate to home after a brief delay
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 500)
      } catch (error) {
        console.error('Failed to create new board:', error)
        // Navigate to home anyway
        navigate('/', { replace: true })
      }
    }

    createNewBoard()
  }, [navigate, exportBoard])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <div className="text-2xl font-bold">
          {status === 'checking' && 'Checking for existing board...'}
          {status === 'exporting' && 'Exporting your current board...'}
          {status === 'creating' && 'Creating fresh board...'}
          {status === 'done' && 'Done! Redirecting...'}
        </div>
        <div className="flex justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    </div>
  )
}
