import React from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { getWeekDayLabel } from '@shared/contracts/schedulePlanner';

const WEEK_DAYS = [1, 2, 3, 4, 5];

export function ScheduleGrid({ entries = [], shifts = [], classes = [], selectedClassId, onDragEnd }) {
  const selected = selectedClassId || classes[0]?.id || '';
  const filtered = entries.filter((entry) => !selected || entry.class_id === selected);
  const slotMap = new Map(filtered.map((entry) => [`${entry.shift_id}:${entry.day_of_week}:${entry.lesson_index}`, entry]));

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-2 text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-slate-500">Faixa</th>
              {WEEK_DAYS.map((day) => <th key={day} className="px-2 py-1 text-left text-slate-500">{getWeekDayLabel(day)}</th>)}
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              Array.from({ length: Number(shift.lesson_count || 0) }, (_, index) => index + 1).map((lessonIndex) => {
                const slotId = `${shift.id}:${lessonIndex}`;
                return (
                  <tr key={slotId}>
                    <td className="rounded-xl bg-slate-100 px-3 py-3 font-medium text-slate-700">{shift.name} • {lessonIndex}ª</td>
                    {WEEK_DAYS.map((day) => {
                      const droppableId = `${shift.id}:${day}:${lessonIndex}`;
                      const entry = slotMap.get(droppableId);
                      return (
                        <td key={droppableId} className="align-top">
                          <Droppable droppableId={droppableId}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`min-h-[92px] rounded-2xl border px-3 py-3 transition-colors ${
                                  snapshot.isDraggingOver ? 'border-teal-400 bg-teal-50' : entry ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'
                                }`}
                              >
                                {entry ? (
                                  <Draggable draggableId={entry.id} index={0}>
                                    {(dragProvided) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className="rounded-xl border border-teal-200 bg-white px-3 py-2 shadow-sm"
                                      >
                                        <p className="font-semibold text-teal-900">{entry.subject?.name || entry.subject_id}</p>
                                        <p className="text-xs text-teal-700">{entry.teacher?.full_name || entry.teacher_id}</p>
                                      </div>
                                    )}
                                  </Draggable>
                                ) : (
                                  <p className="text-xs text-slate-400">Livre</p>
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>
    </DragDropContext>
  );
}

