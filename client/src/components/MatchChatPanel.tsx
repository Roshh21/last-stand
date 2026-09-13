import { useState, type FormEvent } from "react";

import type { ChatRejectReason, MatchChatMessageDTO, MatchPlayerState, SessionInfoDTO } from "@last-stand/shared";

import { gameClient, useGameClient } from "../net/useGameClient.js";
import { ReportPlayerModal } from "./ReportPlayerModal.js";

function describeChatRejection(reason: ChatRejectReason): string {
  switch (reason) {
    case "rate_limited":
      return "slow down a little.";
    case "no_team":
      return "you're not on a team.";
    case "no_open_thread":
      return "open a conversation with them first.";
    case "no_starts_remaining":
      return "you're out of new conversations to start this match.";
    case "cannot_message_self":
      return "you can't message yourself.";
    case "target_not_found":
      return "that player isn't in this match.";
    case "target_disconnected":
      return "they're currently disconnected.";
    case "channel_not_unlocked":
      return "that channel isn't open.";
    case "invalid_channel":
    case "invalid_input":
      return "that message couldn't be sent.";
    default:
      return "something went wrong.";
  }
}

type Tab = "global" | "team" | string;

interface MatchChatPanelProps {
  session: SessionInfoDTO;
  players: MatchPlayerState[];
}

export function MatchChatPanel({ session, players }: MatchChatPanelProps) {
  const state = useGameClient();
  const [activeTab, setActiveTab] = useState<Tab>("global");
  const [text, setText] = useState("");
  const [sendAsTraitor, setSendAsTraitor] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [lastSeenCounts, setLastSeenCounts] = useState<Record<string, number>>({});
  const [reportTarget, setReportTarget] = useState<{ playerId: string; nickname: string } | null>(null);

  const openThreads = state.privateState?.openThreads ?? [];
  const activeThread = openThreads.find((thread) => thread.otherPlayerId === activeTab);

  const messagesByTab: Record<string, MatchChatMessageDTO[]> = {
    global: state.globalChat,
    team: state.teamChat,
  };

  for (const thread of openThreads) {
    messagesByTab[thread.otherPlayerId] = state.privateThreadMessages[thread.otherPlayerId] ?? [];
  }

  const visibleMessages = (messagesByTab[activeTab] ?? []).filter(
    (message) => message.isSystem || !state.mutedPlayerIds.includes(message.playerId),
  );

  function selectTab(tab: Tab): void {
    setActiveTab(tab);
    setSendAsTraitor(false);
    setLastSeenCounts((previous) => ({ ...previous, [tab]: messagesByTab[tab]?.length ?? 0 }));
  }

  function hasUnread(tab: Tab): boolean {
    return (messagesByTab[tab]?.length ?? 0) > (lastSeenCounts[tab] ?? 0);
  }

  function handleSend(event: FormEvent): void {
    event.preventDefault();

    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    if (activeTab === "global") {
      gameClient.sendGlobalChat(trimmed);
    } else if (activeTab === "team") {
      gameClient.sendTeamChat(trimmed);
    } else if (sendAsTraitor) {
      gameClient.sendTraitorChat(activeTab, trimmed);
    } else {
      gameClient.sendPrivateChat(activeTab, trimmed);
    }

    setText("");
  }

  const candidatePlayers = players.filter(
    (player) =>
      player.playerId !== session.playerId &&
      player.connected &&
      !openThreads.some((thread) => thread.otherPlayerId === player.playerId),
  );

  return (
    <div className="card match-chat-panel">
      <h3>Chat</h3>

      <div className="chat-tabs">
        <button className="chat-tab" data-active={activeTab === "global"} onClick={() => selectTab("global")}>
          Global
          {hasUnread("global") && <span className="unread-dot" />}
        </button>
        <button className="chat-tab" data-active={activeTab === "team"} onClick={() => selectTab("team")}>
          Team
          {hasUnread("team") && <span className="unread-dot" />}
        </button>
        {openThreads.map((thread) => (
          <button
            key={thread.otherPlayerId}
            className="chat-tab"
            data-active={activeTab === thread.otherPlayerId}
            onClick={() => selectTab(thread.otherPlayerId)}
          >
            {thread.otherNickname}
            {thread.traitorChannelUnlocked && " ★"}
            {hasUnread(thread.otherPlayerId) && <span className="unread-dot" />}
          </button>
        ))}
        <button className="chat-tab chat-tab-new" onClick={() => setShowPicker((v) => !v)}>
          + New
        </button>
      </div>

      {showPicker && (
        <div className="new-thread-picker">
          <p className="hint-text">
            {state.privateState?.remainingPrivateChatStarts ?? 0} conversation
            {state.privateState?.remainingPrivateChatStarts === 1 ? "" : "s"} left to start
          </p>
          <div className="button-row">
            {candidatePlayers.length === 0 && <p className="hint-text">No one else to message right now.</p>}
            {candidatePlayers.map((player) => (
              <button
                key={player.playerId}
                className="button"
                disabled={(state.privateState?.remainingPrivateChatStarts ?? 0) <= 0}
                onClick={() => {
                  gameClient.openPrivateThread(player.playerId);
                  setShowPicker(false);
                  selectTab(player.playerId);
                }}
              >
                {player.nickname}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-log">
        {visibleMessages.length === 0 && <p className="chat-empty">No messages yet.</p>}
        {visibleMessages.map((message, index) => {
          const previous = visibleMessages[index - 1];
          const showSender = message.isSystem || !previous || previous.playerId !== message.playerId;

          return (
            <div key={message.id} className={`chat-line${message.isSystem ? " chat-line-system" : ""}`}>
              {showSender && <span className="who">{message.nickname}</span>}
              <span>{message.text}</span>
              {!message.isSystem && message.playerId !== session.playerId && (
                <span className="chat-line-actions">
                  <button className="chat-line-action" onClick={() => gameClient.toggleMute(message.playerId)}>
                    {state.mutedPlayerIds.includes(message.playerId) ? "Unmute" : "Mute"}
                  </button>
                  <button
                    className="chat-line-action"
                    onClick={() => setReportTarget({ playerId: message.playerId, nickname: message.nickname })}
                  >
                    Report
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {activeThread && (
        <div className="button-row" style={{ marginBottom: 10 }}>
          <button className="button" onClick={() => gameClient.sendSignal(activeThread.otherPlayerId)}>
            {activeThread.signaledByMe ? "Signal sent" : "Send a signal"}
          </button>
          {state.privateState?.hasKey && (
            <button className="button" onClick={() => gameClient.transferKey(activeThread.otherPlayerId)}>
              Share the key
            </button>
          )}
        </div>
      )}

      {state.chatRejection && (
        <p className="error-text">Message not sent: {describeChatRejection(state.chatRejection)}</p>
      )}

      <form className="chat-form" onSubmit={handleSend}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={activeTab === "global" ? "Message everyone…" : activeTab === "team" ? "Message your team…" : "Message privately…"}
          maxLength={280}
        />
        {activeThread?.traitorChannelUnlocked && (
          <label className="traitor-toggle">
            <input
              type="checkbox"
              checked={sendAsTraitor}
              onChange={(event) => setSendAsTraitor(event.target.checked)}
            />
            Traitor channel
          </label>
        )}
        <button type="submit" className="button">
          Send
        </button>
      </form>

      {reportTarget && (
        <ReportPlayerModal
          targetPlayerId={reportTarget.playerId}
          targetNickname={reportTarget.nickname}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
