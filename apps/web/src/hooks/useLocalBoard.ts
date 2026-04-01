import { type LocalBoard, type LocalCard, type LocalColumn, db } from '@/lib/db'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ulid } from 'ulid'

export interface BoardData {
  board: LocalBoard
  columns: Array<LocalColumn & { cards: LocalCard[] }>
}

export function useLocalBoard(boardId: string) {
  const [data, setData] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadDone = useRef(false)

  const loadBoard = useCallback(async () => {
    try {
      if (!initialLoadDone.current) {
        setLoading(true)
      }

      const board = await db.boards.get(boardId)

      if (!board) {
        setData(null)
        setError(null)
        return
      }

      const columns = await db.columns.where('boardId').equals(boardId).sortBy('position')

      const columnsWithCards = await Promise.all(
        columns.map(async (col: LocalColumn) => {
          const cards = await db.cards.where('columnId').equals(col.id).sortBy('position')
          return { ...col, cards }
        }),
      )

      setData({ board, columns: columnsWithCards })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board')
    } finally {
      setLoading(false)
      initialLoadDone.current = true
    }
  }, [boardId])

  useEffect(() => {
    initialLoadDone.current = false
    loadBoard()
  }, [loadBoard])

  const createBoard = async (name: string, title: string) => {
    const id = ulid()
    const now = new Date()
    await db.boards.add({
      id,
      name,
      title,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  const updateBoardTitle = async (title: string) => {
    if (!data) return
    const now = new Date()

    setData((prev) => (prev ? { ...prev, board: { ...prev.board, title, updatedAt: now } } : prev))

    try {
      await db.boards.update(boardId, { title, updatedAt: now })
    } catch (err) {
      console.error('Failed to update board title:', err)
      await loadBoard()
    }
  }

  const deleteBoard = async () => {
    await db.cards
      .where('columnId')
      .anyOf(
        (await db.columns.where('boardId').equals(boardId).toArray()).map((c: LocalColumn) => c.id),
      )
      .delete()
    await db.columns.where('boardId').equals(boardId).delete()
    await db.boards.delete(boardId)
  }

  const createColumn = async (title: string) => {
    if (!data) return
    const position = data.columns.length
    const id = ulid()
    const now = new Date()
    const newColumn: LocalColumn & { cards: LocalCard[] } = {
      id,
      boardId,
      title,
      position,
      cards: [],
      createdAt: now,
      updatedAt: now,
    }

    setData((prev) => (prev ? { ...prev, columns: [...prev.columns, newColumn] } : prev))

    try {
      await db.columns.add({ id, boardId, title, position, createdAt: now, updatedAt: now })
    } catch (err) {
      console.error('Failed to create column:', err)
      await loadBoard()
    }

    return id
  }

  const updateColumnTitle = async (columnId: string, title: string) => {
    const now = new Date()

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) =>
          col.id === columnId ? { ...col, title, updatedAt: now } : col,
        ),
      }
    })

    try {
      await db.columns.update(columnId, { title, updatedAt: now })
    } catch (err) {
      console.error('Failed to update column title:', err)
      await loadBoard()
    }
  }

  const deleteColumn = async (columnId: string) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.filter((col) => col.id !== columnId),
      }
    })

    try {
      await db.cards.where('columnId').equals(columnId).delete()
      await db.columns.delete(columnId)
    } catch (err) {
      console.error('Failed to delete column:', err)
      await loadBoard()
    }
  }

  const reorderColumns = async (updates: Array<{ id: string; position: number }>) => {
    const positionMap = new Map(updates.map((u) => [u.id, u.position]))
    const now = new Date()

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns
          .map((col) => ({
            ...col,
            position: positionMap.get(col.id) ?? col.position,
            updatedAt: positionMap.has(col.id) ? now : col.updatedAt,
          }))
          .sort((a, b) => a.position - b.position),
      }
    })

    try {
      await Promise.all(
        updates.map((u) => db.columns.update(u.id, { position: u.position, updatedAt: now })),
      )
    } catch (err) {
      console.error('Failed to reorder columns:', err)
      await loadBoard()
    }
  }

  const createCard = async (columnId: string, content: string) => {
    if (!data) return
    const column = data.columns.find((c) => c.id === columnId)
    if (!column) return

    const position = column.cards.length
    const id = ulid()
    const now = new Date()
    const newCard: LocalCard = { id, columnId, content, position, createdAt: now, updatedAt: now }

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) =>
          col.id === columnId ? { ...col, cards: [...col.cards, newCard] } : col,
        ),
      }
    })

    try {
      await db.cards.add(newCard)
    } catch (err) {
      console.error('Failed to create card:', err)
      await loadBoard()
    }

    return id
  }

  const updateCardContent = async (cardId: string, content: string) => {
    const now = new Date()

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.map((card) =>
            card.id === cardId ? { ...card, content, updatedAt: now } : card,
          ),
        })),
      }
    })

    try {
      await db.cards.update(cardId, { content, updatedAt: now })
    } catch (err) {
      console.error('Failed to update card:', err)
      await loadBoard()
    }
  }

  const moveCard = async (cardId: string, targetColumnId: string, position: number) => {
    const now = new Date()

    setData((prev) => {
      if (!prev) return prev

      // Find the card and its source column first so TypeScript can narrow properly
      let foundCard: LocalCard | undefined
      let sourceColumnId: string | undefined
      for (const col of prev.columns) {
        const card = col.cards.find((c) => c.id === cardId)
        if (card) {
          foundCard = card
          sourceColumnId = col.id
          break
        }
      }

      if (!foundCard || !sourceColumnId) return prev

      const cardToInsert: LocalCard = {
        ...foundCard,
        columnId: targetColumnId,
        position,
        updatedAt: now,
      }
      const srcColId = sourceColumnId

      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id === srcColId) {
            // Remove card from source column
            return { ...col, cards: col.cards.filter((c) => c.id !== cardId) }
          }
          if (col.id === targetColumnId) {
            // Insert card into target column and sort by position
            const newCards = [...col.cards, cardToInsert].sort((a, b) => a.position - b.position)
            return { ...col, cards: newCards }
          }
          return col
        }),
      }
    })

    try {
      await db.cards.update(cardId, { columnId: targetColumnId, position, updatedAt: now })
    } catch (err) {
      console.error('Failed to move card:', err)
      await loadBoard()
    }
  }

  const deleteCard = async (cardId: string) => {
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.filter((card) => card.id !== cardId),
        })),
      }
    })

    try {
      await db.cards.delete(cardId)
    } catch (err) {
      console.error('Failed to delete card:', err)
      await loadBoard()
    }
  }

  const reorderCards = async (updates: Array<{ id: string; position: number }>) => {
    const positionMap = new Map(updates.map((u) => [u.id, u.position]))
    const cardIdSet = new Set(updates.map((u) => u.id))
    const now = new Date()

    setData((prev) => {
      if (!prev) return prev

      // Find the column that owns these cards
      const targetColumn = prev.columns.find((col) => col.cards.some((c) => cardIdSet.has(c.id)))
      if (!targetColumn) return prev

      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id !== targetColumn.id) return col
          return {
            ...col,
            cards: col.cards
              .map((card) => ({
                ...card,
                position: positionMap.get(card.id) ?? card.position,
                updatedAt: positionMap.has(card.id) ? now : card.updatedAt,
              }))
              .sort((a, b) => a.position - b.position),
          }
        }),
      }
    })

    try {
      await Promise.all(
        updates.map((u) => db.cards.update(u.id, { position: u.position, updatedAt: now })),
      )
    } catch (err) {
      console.error('Failed to reorder cards:', err)
      await loadBoard()
    }
  }

  const exportBoard = async () => {
    if (!data) return null
    return JSON.stringify(data, null, 2)
  }

  const importBoard = async (jsonData: string) => {
    try {
      const imported = JSON.parse(jsonData) as BoardData

      await db.boards.add({
        ...imported.board,
        id: ulid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      for (const col of imported.columns) {
        const newColId = ulid()
        await db.columns.add({
          ...col,
          id: newColId,
          boardId: imported.board.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        for (const card of col.cards) {
          await db.cards.add({
            ...card,
            id: ulid(),
            columnId: newColId,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }
      }

      await loadBoard()
    } catch (_err) {
      throw new Error('Invalid board data')
    }
  }

  return {
    data,
    loading,
    error,
    createBoard,
    updateBoardTitle,
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
    exportBoard,
    importBoard,
    refresh: loadBoard,
  }
}
