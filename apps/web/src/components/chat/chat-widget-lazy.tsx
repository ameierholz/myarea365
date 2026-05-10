"use client";

import dynamic from "next/dynamic";

const ChatWidget = dynamic(
  () => import("@/components/chat/chat-widget").then((m) => m.ChatWidget),
  { ssr: false, loading: () => null }
);

export function ChatWidgetLazy({ currentUserId }: { currentUserId: string }) {
  return <ChatWidget currentUserId={currentUserId} />;
}
