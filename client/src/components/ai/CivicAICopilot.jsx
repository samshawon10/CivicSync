/**
 * CivicSync Intelligence — the copilot shell.
 *
 * Purely presentational: all conversation state lives in useCivicAI.js. It is
 * rendered lazily by CivicAIProvider so the feature stays out of the initial
 * bundle, and reuses the existing Drawer so focus trapping, Escape handling and
 * scroll locking behave exactly like every other CivicSync panel.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/primitives.jsx';
import { Drawer } from '../ui/Overlays.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../ui/Toaster.jsx';
import AIMessage from './AIMessage.jsx';
import AIInput from './AIInput.jsx';
import { AIEmptyState, AIErrorState, AILoadingState } from './AIStates.jsx';
import { suggestionsFor, suggestionGroupsFor } from './aiPrompts.js';
import { useCivicAIConversation, useCivicAIActions } from './useCivicAI.js';

/** Conversation-history panel, kept out of the main file for readability. */
function AIHistoryPanel({ history, onOpen, onDelete, onClose }) {
  return (
    <div className="mb-3 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface-2 p-2">
      {history.length === 0 ? (
        <p className="px-2 py-3 text-center text-[13px] text-fg-muted">No recent conversations.</p>
      ) : (
        history.map((item) => (
          <div key={item.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-[13px] text-fg transition hover:bg-surface"
            >
              {item.title}
            </button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)} aria-label={`Delete conversation: ${item.title}`}>
              ✕
            </Button>
          </div>
        ))
      )}
      <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

/** The in-flight assistant bubble, shown while a turn is being processed. */
function AITypingBubble({ stages }) {
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-civic-500/10 text-sm text-civic-600 dark:text-civic-300"
      >
        ✦
      </span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface-2 px-3.5 py-3">
        <AILoadingState
          label={stages.includes('retrieve') ? 'Retrieving CivicSync data' : 'CivicSync Intelligence is thinking'}
        />
      </div>
    </div>
  );
}

export default function CivicAICopilot({ open, onClose, context = {} }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const bottomRef = useRef(null);

  const state = useCivicAIConversation({ context });
  const { confirm, reject } = useCivicAIActions({
    setMessages: state.setMessages,
    setActionBusy: state.setActionBusy
  });

  const {
    messages, setMessages, input, setInput, busy, stages, error, setError, setConversationId,
    history, showHistory, setShowHistory, actionBusy,
    send, loadHistory, openConversation, deleteConversation
  } = state;

  useEffect(() => {
    if (open && showHistory) loadHistory();
  }, [open, showHistory, loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  /** Starts a fresh thread; the old conversation stays in history. */
  const handleNewChat = () => {
    setMessages([]);
    setError(null);
    setInput('');
    setConversationId(null);
  };

  const handleConfirm = async (token) => {
    const result = await confirm(token);
    if (result.ok) toast({ type: 'success', message: `${result.label || 'Action'} completed.` });
    else toast({ type: 'error', message: result.error.message });
  };

  const handleReject = async (token) => {
    const result = await reject(token);
    if (!result.ok) toast({ type: 'error', message: result.error.message });
  };

  /** Closes the copilot and routes the user to a real CivicSync page. */
  const handleNavigate = (path) => {
    onClose?.();
    navigate(path);
  };

  const title = context?.title || 'CivicSync Intelligence';
  const isEmpty = messages.length === 0 && !busy;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle="AI-powered civic assistant"
      width="sm:max-w-md lg:max-w-lg"
      footer={
        <div className="w-full">
          <AIInput value={input} onChange={setInput} onSubmit={send} busy={busy} flush />
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
            {showHistory ? 'Hide history' : 'Recent conversations'}
          </Button>
          {!isEmpty && (
            <Button size="sm" variant="ghost" onClick={handleNewChat}>
              New chat
            </Button>
          )}
        </div>

        {showHistory && (
          <AIHistoryPanel
            history={history}
            onOpen={openConversation}
            onDelete={deleteConversation}
            onClose={() => setShowHistory(false)}
          />
        )}

        <div className="min-h-0 flex-1">
          {isEmpty ? (
            <AIEmptyState
              userName={user?.name}
              groups={suggestionGroupsFor(user?.role)}
              suggestions={context?.prompts?.length ? context.prompts : suggestionsFor(user?.role)}
              onPick={send}
            />
          ) : (
            <div className="space-y-4 pb-2">
              {messages.map((entry, index) => (
                <AIMessage
                  key={index}
                  role={entry.role}
                  text={entry.text}
                  response={entry.response}
                  toolSteps={entry.toolSteps}
                  onNavigate={handleNavigate}
                  onPrompt={send}
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                  actionBusy={actionBusy}
                />
              ))}
              {error && <AIErrorState error={error} onRetry={() => send(input)} />}
              {busy && <AITypingBubble stages={stages} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
