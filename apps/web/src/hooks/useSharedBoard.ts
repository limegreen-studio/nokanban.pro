import { type ApiCard, type ApiColumn, boardService } from '@/services/board.service'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface SharedBoardData {
  id: string
  name: string
  title: string
  columns: Array<ApiColumn>
}

export function useSharedBoard(boardName: string, pin?: string) {
  const [data, setData] = useState<SharedBoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPinSet, setIsPinSet] = useState(false)
  const initialLoadDone = useRef(false)

  const loadBoard = useCallback(async () => {
    try {
      if (!initialLoadDone.current) {
        setLoading(true)
      }
      const board = await boardService.getBoard(boardName)
      setData({
        id: board.id,
        name: board.name,
        title: board.title,
        columns: board.columns,
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board')
    } finally {
      setLoading(false)
      initialLoadDone.current = true
    }
  }, [boardName])

  useEffect(() => {
    initialLoadDone.current = false
    if (pin) {
      boardService.setPin(pin)
      setIsPinSet(true)
    }
    loadBoard()
  }, [pin, loadBoard])

  const setPin = (newPin: string) => {
    boardService.setPin(newPin)
    setIsPinSet(true)
  }

  const clearPin = () => {
    boardService.clearPin()
    setIsPinSet(false)
  }

  const createBoard = async (name: string, title: string, pin: string) => {
    const board = await boardService.createBoard(name, title, pin)
    boardService.setPin(pin)
    setIsPinSet(true)
    return board
  }

  const deleteBoard = async () => {
    if (!isPinSet) throw new Error('PIN required')
    await boardService.deleteBoard(boardName)
  }

  // Creates await the API response so we get the real server-assigned ID — no temp ID needed
  const createColumn = async (title: string) => {
    if (!isPinSet) throw new Error('PIN required')
    if (!data) return
    const position = data.columns.length
    const newColumn = await boardService.createColumn(boardName, title, position)
    setData((prev) => (prev ? { ...prev, columns: [...prev.columns, newColumn] } : prev))
  }

  const updateColumnTitle = async (columnId: string, title: string) => {
    if (!isPinSet) throw new Error('PIN required')

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) => (col.id === columnId ? { ...col, title } : col)),
      }
    })

    try {
      await boardService.updateColumnTitle(boardName, columnId, title)
    } catch (err) {
      console.error('Failed to update column title:', err)
      await loadBoard()
    }
  }

  const deleteColumn = async (columnId: string) => {
    if (!isPinSet) throw new Error('PIN required')

    setData((prev) => {
      if (!prev) return prev
      return { ...prev, columns: prev.columns.filter((col) => col.id !== columnId) }
    })

    try {
      await boardService.deleteColumn(boardName, columnId)
    } catch (err) {
      console.error('Failed to delete column:', err)
      await loadBoard()
    }
  }

  const reorderColumns = async (updates: Array<{ id: string; position: number }>) => {
    if (!isPinSet) throw new Error('PIN required')
    const positionMap = new Map(updates.map((u) => [u.id, u.position]))

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns
          .map((col) => ({ ...col, position: positionMap.get(col.id) ?? col.position }))
          .sort((a, b) => a.position - b.position),
      }
    })

    try {
      await boardService.reorderColumns(boardName, updates)
    } catch (err) {
      console.error('Failed to reorder columns:', err)
      await loadBoard()
    }
  }

  // Like createColumn, await the API response to get the real server-assigned card ID
  const createCard = async (columnId: string, content: string) => {
    if (!isPinSet) throw new Error('PIN required')
    if (!data) return
    const column = data.columns.find((c) => c.id === columnId)
    if (!column) return
    const position = column.cards.length
    const newCard = await boardService.createCard(boardName, columnId, content, position)
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) =>
          col.id === columnId ? { ...col, cards: [...col.cards, newCard] } : col,
        ),
      }
    })
  }

  const updateCardContent = async (cardId: string, content: string) => {
    if (!isPinSet) throw new Error('PIN required')

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.cards.map((card) => (card.id === cardId ? { ...card, content } : card)),
        })),
      }
    })

    try {
      await boardService.updateCardContent(boardName, cardId, content)
    } catch (err) {
      console.error('Failed to update card content:', err)
      await loadBoard()
    }
  }

  const moveCard = async (cardId: string, targetColumnId: string, position: number) => {
    if (!isPinSet) throw new Error('PIN required')

    setData((prev) => {
      if (!prev) return prev

      // Find the card and its source column first so TypeScript can narrow the type
      let foundCard: ApiCard | undefined
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

      const cardToInsert: ApiCard = { ...foundCard, position }
      const srcColId = sourceColumnId

      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id === srcColId) {
            return { ...col, cards: col.cards.filter((c) => c.id !== cardId) }
          }
          if (col.id === targetColumnId) {
            const newCards = [...col.cards, cardToInsert].sort((a, b) => a.position - b.position)
            return { ...col, cards: newCards }
          }
          return col
        }),
      }
    })

    try {
      await boardService.moveCard(boardName, cardId, targetColumnId, position)
    } catch (err) {
      console.error('Failed to move card:', err)
      await loadBoard()
    }
  }

  const deleteCard = async (cardId: string) => {
    if (!isPinSet) throw new Error('PIN required')

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
      await boardService.deleteCard(boardName, cardId)
    } catch (err) {
      console.error('Failed to delete card:', err)
      await loadBoard()
    }
  }

  const reorderCards = async (updates: Array<{ id: string; position: number }>) => {
    if (!isPinSet) throw new Error('PIN required')

    const cardIdSet = new Set(updates.map((u) => u.id))
    // Resolve the column ID from current data before the async setData call
    const columnId = data?.columns.find((col) => col.cards.some((c) => cardIdSet.has(c.id)))?.id
    if (!columnId) return

    const positionMap = new Map(updates.map((u) => [u.id, u.position]))

    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id !== columnId) return col
          return {
            ...col,
            cards: col.cards
              .map((card) => ({ ...card, position: positionMap.get(card.id) ?? card.position }))
              .sort((a, b) => a.position - b.position),
          }
        }),
      }
    })

    try {
      await boardService.reorderCards(boardName, columnId, updates)
    } catch (err) {
      console.error('Failed to reorder cards:', err)
      await loadBoard()
    }
  }

  return {
    data,
    loading,
    error,
    isPinSet,
    setPin,
    clearPin,
    createBoard,
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
    refresh: loadBoard,
  }
}
