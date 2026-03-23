import React, { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { FranchiseNote } from "@/entities/all";
import { Button } from "@/components/ui/button";
import MaterialIcon from "@/components/ui/MaterialIcon";

/**
 * Timeline of admin notes for a franchise + form to add new note.
 */
export default function FranchiseNotes({
  franchiseId, notes = [], currentUserId, currentUserName, onNoteAdded
}) {
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const displayNotes = showAll ? notes : notes.slice(0, 10);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmitting(true);
    try {
      await FranchiseNote.create({
        franchise_id: franchiseId,
        user_id: currentUserId,
        note: newNote.trim(),
      });
      setNewNote("");
      toast.success("Anotação salva");
      onNoteAdded?.();
    } catch (err) {
      toast.error(err.message || "Erro ao salvar anotação");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#1b1c1d" }}>
        <MaterialIcon icon="sticky_note_2" className="text-base" />
        Anotações
      </h4>

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          id={`notes-input-${franchiseId}`}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value.slice(0, 500))}
          placeholder="Ex: Liguei, José disse que estava viajando..."
          rows={2}
          className="flex-1 text-sm rounded-md border px-3 py-2 resize-none focus:outline-none focus:ring-1"
          style={{ borderColor: "#e9e8e9", backgroundColor: "#fbf9fa" }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !newNote.trim()}
          className="self-end"
        >
          <MaterialIcon icon="note_add" className="text-base mr-1" />
          Anotar
        </Button>
      </form>

      {/* Notes timeline */}
      {displayNotes.length === 0 ? (
        <p className="text-sm" style={{ color: "#7a6d6d" }}>Nenhuma anotação ainda.</p>
      ) : (
        <div className="space-y-2">
          {displayNotes.map((note) => (
            <div key={note.id} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium" style={{ color: "#4a3d3d" }}>
                {format(new Date(note.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
              <span style={{ color: "#7a6d6d" }}>—</span>
              <span style={{ color: "#1b1c1d" }}>{note.note}</span>
            </div>
          ))}
          {!showAll && notes.length > 10 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm font-medium"
              style={{ color: "#b91c1c" }}
            >
              Ver todas ({notes.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
