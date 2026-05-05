"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Realtime-Hook: hört auf chat_messages, chat_reactions und chat_typing
 * für einen bestimmten room. onChange wird mit dem Event-Type aufgerufen.
 */
export function useChatRealtime(roomId: string | null, onChange: (kind: "message" | "reaction" | "typing", payload: unknown) => void) {
  const cbRef = useRef(onChange);
  useEffect(() => { cbRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!roomId) return;
    const sb = createClient();
    const ch = sb.channel(`chat-room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (p) => cbRef.current("message", p))
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" },
        (p) => cbRef.current("reaction", p))
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_typing", filter: `room_id=eq.${roomId}` },
        (p) => cbRef.current("typing", p))
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [roomId]);
}
