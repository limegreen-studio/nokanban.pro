import { ColumnDeleteDialog } from '@/components/dialogs/ColumnDeleteDialog'
import { cn } from '@/lib/utils'
import * as React from 'react'

interface Card {
  id: string
  content: string
  position: number
}

interface Column {
  id: string
  title: string
  position: number
  cards: Card[]
}

interface KanbanBoardProps {
  columns: Column[]
  onAddColumn?: (title: string) => void
  onUpdateColumnTitle?: (columnId: string, title: string) => void
  onDeleteColumn?: (columnId: string) => void
  onReorderColumns?: (updates: Array<{ id: string; position: number }>) => void
  onAddCard?: (columnId: string, content: string) => void
  onUpdateCard?: (cardId: string, content: string) => void
  onDeleteCard?: (cardId: string) => void
  onMoveCard?: (cardId: string, columnId: string, position: number) => void
  onReorderCards?: (updates: Array<{ id: string; position: number }>) => void
  readOnly?: boolean
}

export function KanbanBoard({
  columns,
  onAddColumn,
  onUpdateColumnTitle,
  onDeleteColumn,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onMoveCard,
  onReorderCards,
  readOnly = false,
}: KanbanBoardProps) {
  const [draggedCard, setDraggedCard] = React.useState<{
    card: Card
    sourceColumnId: string
  } | null>(null)
  const [dropTarget, setDropTarget] = React.useState<{
    columnId: string
    cardId?: string
    position?: 'before' | 'after'
  } | null>(null)
  const [addingCardTo, setAddingCardTo] = React.useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = React.useState('')
  const [editingCard, setEditingCard] = React.useState<string | null>(null)
  const [editingColumn, setEditingColumn] = React.useState<string | null>(null)
  const [showAddColumn, setShowAddColumn] = React.useState(false)
  const [moveCardMenu, setMoveCardMenu] = React.useState<{
    card: Card
    sourceColumnId: string
    position: { x: number; y: number }
  } | null>(null)
  const [columnToDelete, setColumnToDelete] = React.useState<Column | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const longPressTimerRef = React.useRef<number | null>(null)
  const dragStartPosRef = React.useRef<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    if (addingCardTo && inputRef.current) {
      inputRef.current.focus()
    }
  }, [addingCardTo])

  const handleDragStart = (card: Card, columnId: string) => {
    // Cancel long-press when drag starts
    handleLongPressEnd()
    setDraggedCard({ card, sourceColumnId: columnId })
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    setDropTarget({ columnId })
  }

  const handleCardDragOver = (
    e: React.DragEvent,
    columnId: string,
    cardId: string,
    _cardIndex: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedCard) return

    // Determine if we should drop before or after based on mouse position
    const cardElement = e.currentTarget as HTMLElement
    const rect = cardElement.getBoundingClientRect()
    const midPoint = rect.top + rect.height / 2
    const position = e.clientY < midPoint ? 'before' : 'after'

    setDropTarget({ columnId, cardId, position })
  }

  const handleDrop = (targetColumnId: string) => {
    if (!draggedCard) {
      setDraggedCard(null)
      setDropTarget(null)
      return
    }

    const isSameColumn = draggedCard.sourceColumnId === targetColumnId
    const targetColumn = columns.find((c) => c.id === targetColumnId)
    if (!targetColumn) return

    // Calculate new position
    let newPosition = targetColumn.cards.length

    if (dropTarget?.cardId) {
      // Dropping on a specific card
      const targetCardIndex = targetColumn.cards.findIndex((c) => c.id === dropTarget.cardId)
      if (targetCardIndex !== -1) {
        newPosition = dropTarget.position === 'before' ? targetCardIndex : targetCardIndex + 1

        // Adjust position if moving within same column
        if (isSameColumn) {
          const currentCardIndex = targetColumn.cards.findIndex((c) => c.id === draggedCard.card.id)
          if (currentCardIndex !== -1 && currentCardIndex < newPosition) {
            newPosition--
          }
        }
      }
    }

    if (isSameColumn) {
      // Reorder within same column
      const currentCardIndex = targetColumn.cards.findIndex((c) => c.id === draggedCard.card.id)
      if (currentCardIndex !== newPosition && currentCardIndex !== -1) {
        const updates = targetColumn.cards
          .filter((c) => c.id !== draggedCard.card.id)
          .flatMap((c, idx) => {
            if (idx === newPosition) {
              return [
                { id: draggedCard.card.id, position: newPosition },
                { id: c.id, position: idx + 1 },
              ]
            }
            return { id: c.id, position: idx >= newPosition ? idx + 1 : idx }
          })

        // Add the dragged card if it wasn't added in the map
        if (!updates.some((u) => u.id === draggedCard.card.id)) {
          updates.push({ id: draggedCard.card.id, position: newPosition })
        }

        onReorderCards?.(updates)
      }
    } else {
      // Move to different column
      onMoveCard?.(draggedCard.card.id, targetColumnId, newPosition)
    }

    setDraggedCard(null)
    setDropTarget(null)
  }

  const handleAddCard = (columnId: string) => {
    if (!newCardTitle.trim()) return

    onAddCard?.(columnId, newCardTitle.trim())
    setNewCardTitle('')
    setAddingCardTo(null)
  }

  const handleUpdateColumnTitle = (columnId: string, title: string) => {
    if (title.trim()) {
      onUpdateColumnTitle?.(columnId, title.trim())
    }
    setEditingColumn(null)
  }

  const handleUpdateCard = (cardId: string, content: string) => {
    if (content.trim()) {
      onUpdateCard?.(cardId, content.trim())
    }
    setEditingCard(null)
  }

  const handleAddColumn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const title = formData.get('columnTitle') as string
    if (title.trim()) {
      onAddColumn?.(title.trim())
      setShowAddColumn(false)
      e.currentTarget.reset()
    }
  }

  // Long press handlers
  const handleLongPressStart = (
    e: React.MouseEvent | React.TouchEvent,
    card: Card,
    columnId: string,
  ) => {
    if (readOnly) return

    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY

    // Store initial position to detect movement
    dragStartPosRef.current = { x: clientX, y: clientY }

    longPressTimerRef.current = window.setTimeout(() => {
      setMoveCardMenu({
        card,
        sourceColumnId: columnId,
        position: { x: clientX, y: clientY },
      })
      dragStartPosRef.current = null
    }, 500)
  }

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    dragStartPosRef.current = null
  }

  const handleLongPressMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragStartPosRef.current) return

    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX
    const clientY = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY

    // Cancel long-press if user moves more than 10px (they're trying to drag)
    const deltaX = Math.abs(clientX - dragStartPosRef.current.x)
    const deltaY = Math.abs(clientY - dragStartPosRef.current.y)

    if (deltaX > 10 || deltaY > 10) {
      handleLongPressEnd()
    }
  }

  const handleMoveCardTo = (targetColumnId: string) => {
    if (!moveCardMenu) return

    const targetColumn = columns.find((c) => c.id === targetColumnId)
    if (!targetColumn) return

    const newPosition = targetColumn.cards.length
    onMoveCard?.(moveCardMenu.card.id, targetColumnId, newPosition)
    setMoveCardMenu(null)
  }

  return (
    <div className="flex h-full gap-3 md:gap-4 overflow-x-auto p-2 md:p-4 pb-4">
      {columns.map((column) => {
        const isDropActive =
          dropTarget?.columnId === column.id && draggedCard?.sourceColumnId !== column.id

        return (
          <div
            key={column.id}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDrop={() => handleDrop(column.id)}
            onDragLeave={() => setDropTarget(null)}
            className={cn(
              'min-w-[260px] md:min-w-[280px] max-w-[260px] md:max-w-[280px] rounded-xl p-3 transition-all duration-200',
              'bg-neutral-100 dark:bg-neutral-900 border-2',
              isDropActive
                ? 'border-neutral-400 dark:border-neutral-600 border-dashed bg-neutral-200 dark:bg-neutral-800'
                : 'border-transparent',
            )}
          >
            {/* Column Header */}
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2 flex-1">
                {editingColumn === column.id ? (
                  <input
                    defaultValue={column.title}
                    className="w-0 flex-1 rounded border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-sm font-semibold bg-white dark:bg-neutral-950"
                    onBlur={(e) => handleUpdateColumnTitle(column.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateColumnTitle(column.id, e.currentTarget.value)
                      } else if (e.key === 'Escape') {
                        setEditingColumn(null)
                      }
                    }}
                  />
                ) : (
                  <h2
                    className="text-sm font-semibold text-foreground flex-1"
                    onDoubleClick={() => !readOnly && setEditingColumn(column.id)}
                  >
                    {column.title}
                  </h2>
                )}
                <span className="rounded-full bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  {column.cards.length}
                </span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setColumnToDelete(column)
                  }}
                  className="rounded p-1 text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-red-600 dark:hover:text-red-400"
                  aria-label="Delete column"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <title>Delete</title>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Cards */}
            <div className="flex min-h-[100px] flex-col gap-2">
              {column.cards
                .sort((a, b) => a.position - b.position)
                .map((card, cardIndex) => {
                  const isDragging = draggedCard?.card.id === card.id
                  const isDropTarget =
                    dropTarget?.columnId === column.id && dropTarget?.cardId === card.id

                  return (
                    <div
                      key={card.id}
                      draggable={!readOnly}
                      onDragStart={() => handleDragStart(card, column.id)}
                      onDragEnd={() => setDraggedCard(null)}
                      onDragOver={(e) => handleCardDragOver(e, column.id, card.id, cardIndex)}
                      onMouseDown={(e) => handleLongPressStart(e, card, column.id)}
                      onMouseMove={handleLongPressMove}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={(e) => handleLongPressStart(e, card, column.id)}
                      onTouchMove={handleLongPressMove}
                      onTouchEnd={handleLongPressEnd}
                      onTouchCancel={handleLongPressEnd}
                      className={cn(
                        'cursor-grab rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-3 shadow-sm transition-all duration-150',
                        'hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing',
                        isDragging && 'rotate-2 opacity-50',
                        isDropTarget &&
                          dropTarget.position === 'before' &&
                          'border-t-4 border-t-blue-500',
                        isDropTarget &&
                          dropTarget.position === 'after' &&
                          'border-b-4 border-b-blue-500',
                      )}
                    >
                      {editingCard === card.id ? (
                        <textarea
                          defaultValue={card.content}
                          className="w-full resize-none rounded border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-sm bg-white dark:bg-neutral-950"
                          rows={3}
                          onBlur={(e) => handleUpdateCard(card.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              handleUpdateCard(card.id, e.currentTarget.value)
                            } else if (e.key === 'Escape') {
                              setEditingCard(null)
                            }
                          }}
                        />
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="flex-1 whitespace-pre-wrap text-sm text-foreground"
                            onDoubleClick={() => !readOnly && setEditingCard(card.id)}
                          >
                            {card.content}
                          </p>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteCard?.(card.id)
                              }}
                              className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                              aria-label="Delete card"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

              {/* Add Card */}
              {!readOnly &&
                (addingCardTo === column.id ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCard(column.id)
                      } else if (e.key === 'Escape') {
                        setAddingCardTo(null)
                        setNewCardTitle('')
                      }
                    }}
                    onBlur={() => {
                      if (newCardTitle.trim()) {
                        handleAddCard(column.id)
                      } else {
                        setAddingCardTo(null)
                        setNewCardTitle('')
                      }
                    }}
                    placeholder="Enter card title..."
                    className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-foreground outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 shadow-sm"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingCardTo(column.id)}
                    className="flex w-full items-center justify-center gap-1 rounded-lg p-2 text-sm text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <title>Add</title>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add a card
                  </button>
                ))}
            </div>
          </div>
        )
      })}

      {/* Move Card Menu */}
      {moveCardMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMoveCardMenu(null)}
            onKeyDown={(e) => e.key === 'Escape' && setMoveCardMenu(null)}
          />

          {/* Menu */}
          <div
            className="fixed z-50 min-w-[200px] rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 shadow-xl"
            style={{
              left: `${moveCardMenu.position.x}px`,
              top: `${moveCardMenu.position.y}px`,
              transform: 'translate(-50%, -100%) translateY(-8px)',
            }}
          >
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Move to...
              </p>
              <div className="mt-1 space-y-1">
                {columns
                  .filter((col) => col.id !== moveCardMenu.sourceColumnId)
                  .map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => handleMoveCardTo(col.id)}
                      className="w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      {col.title}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Column Delete Confirmation Dialog */}
      {columnToDelete && (
        <ColumnDeleteDialog
          open={!!columnToDelete}
          onOpenChange={(open) => !open && setColumnToDelete(null)}
          columnTitle={columnToDelete.title}
          cardCount={columnToDelete.cards.length}
          onConfirmDelete={() => {
            onDeleteColumn?.(columnToDelete.id)
            setColumnToDelete(null)
          }}
        />
      )}
    </div>
  )
}
