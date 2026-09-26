/**
 * CivicSync Intelligence — copilot state machine.
 *
 * Owns the conversation thread, action confirmations and history. Kept apart
 * from the presentational shell so the drawer markup stays readable and this
 * logic can be reasoned about (and reused by inline page AI) in isolation.
 *
 * Security note: the browser never asserts a role, permission, or record it may
 * see. It sends a question plus non-sensitive page context; the gateway
 * independently re-authorizes every tool call and action.
 */
import { useCallback, useEffect, useState } from 'react';
import aiApi from '../../services/aiService.js';

/** Progressive, honest stages shown while a turn is in flight. */
export const THINKING_STAGES = ['auth', 'retrieve', 'generate'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Controls open/closed state and the active page preset. */
export function useCivicAI() {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState({});

  /**
   * Opens the copilot, optionally pre-scoped to a page (case, service, map…).
   *
   * Accepts either a raw pageContext or a full page preset produced by
   * `presetFor()`. A preset arrives as { title, prompts, context }, where only
   * `context` is the envelope the gateway understands. We flatten it here so the
   * conversation layer and the backend both always see route/caseId/emergencyId
   * at the TOP level — previously they were nested one level too deep, so every
   * contextual id (case, emergency, department) silently failed to reach the
   * Context Engine and the AI answered without its page scope.
   */
  const openCopilot = useCallback((preset = {}) => {
    const isPreset = Boolean(preset.context) || Array.isArray(preset.prompts) || Boolean(preset.title);
    const pageContext = isPreset ? preset.context || {} : preset;
    setContext({
      ...pageContext,
      ...(isPreset && preset.title ? { title: preset.title } : {}),
      ...(isPreset && preset.prompts ? { prompts: preset.prompts } : {})
    });
    setOpen(true);
  }, []);

  const closeCopilot = useCallback(() => {
    setOpen(false);
    setContext({});
  }, []);

  return { open, context, openCopilot, closeCopilot };
}

/** Drives one conversation thread end to end. */
export function useCivicAIConversation({ context = {} } = {}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState([]);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const { route, caseId, emergencyId, serviceId } = context;

  // A new thread for a new page scope, so context never leaks between records.
  useEffect(() => {
    setMessages([]);
    setError(null);
    setConversationId(null);
    setInput('');
    setStages([]);
  }, [route, caseId, emergencyId, serviceId]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await aiApi.conversations();
      setHistory(data?.conversations || []);
    } catch {
      setHistory([]);
    }
  }, []);

  const openConversation = useCallback(async (id) => {
    try {
      const data = await aiApi.conversation(id);
      const stored = data?.conversation?.messages || [];
      setMessages(
        stored.map((entry) => ({
          role: entry.role,
          text: entry.content,
          response: entry.role === 'assistant' ? { message: entry.content, citations: entry.citations || [] } : null
        }))
      );
      setConversationId(id);
      setShowHistory(false);
    } catch {
      /* caller surfaces the failure via the list staying empty */
    }
  }, []);

  const deleteConversation = useCallback(
    async (id) => {
      try {
        await aiApi.deleteConversation(id);
        setHistory((current) => current.filter((item) => item.id !== id));
        if (conversationId === id) {
          setMessages([]);
          setConversationId(null);
        }
      } catch {
        /* non-fatal */
      }
    },
    [conversationId]
  );

  const send = useCallback(
    async (text) => {
      const prompt = String(text || '').trim();
      if (!prompt || busy) return;

      setInput('');
      setError(null);
      setMessages((current) => [...current, { role: 'user', text: prompt }]);
      setBusy(true);
      setStages([THINKING_STAGES[0]]);

      // Walk the stages so the panel always shows progress. This is UI pacing
      // only — the real work happens server-side.
      const ticker = (async () => {
        for (let index = 1; index < THINKING_STAGES.length; index += 1) {
          await sleep(450);
          if (Math.random() > 0.5) setStages(THINKING_STAGES.slice(0, index + 1));
        }
      })();

      try {
        const data = await aiApi.chat({ message: prompt, conversationId, pageContext: context });
        await ticker;
        setStages([]);
        setConversationId(data?.conversationId || null);
        // Prefer the gateway's real, sanitized tool trace. THINKING_STAGES is only a
        // fallback for providers that ran no tools, so the panel never shows a
        // fabricated "Retrieved your cases" when nothing was actually fetched.
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            text: '',
            response: data?.response,
            toolSteps: data?.steps?.length ? data.steps : []
          }
        ]);
      } catch (err) {
        await ticker.catch(() => {});
        // Keep the failed prompt in the composer so the visible "Try Again"
        // control can actually resubmit it.
        setInput(prompt);
        setError(aiApi.toAiError(err));
      } finally {
        setBusy(false);
        setStages([]);
      }
    },
    [busy, context, conversationId]
  );

  return {
    messages, setMessages, input, setInput, busy, stages, error, setError,
    conversationId, setConversationId, history, showHistory, setShowHistory, actionBusy, setActionBusy,
    send, loadHistory, openConversation, deleteConversation
  };
}

/**
 * Confirms or rejects a proposed action, then patches the thread in place.
 * Returns a status string so the caller can raise the right toast.
 */
export function useCivicAIActions({ setMessages, setActionBusy, onNotice }) {
  const clearAction = (token) =>
    setMessages((current) =>
      current.map((entry) =>
        entry.response?.action?.token === token
          ? { ...entry, response: { ...entry.response, action: null } }
          : entry
      )
    );

  const confirm = useCallback(
    async (token) => {
      setActionBusy(true);
      try {
        const result = await aiApi.confirmAction(token);
        setMessages((current) =>
          current.map((entry) =>
            entry.response?.action?.token === token
              ? {
                  ...entry,
                  response: {
                    ...entry.response,
                    message: `${entry.response.message}\n\nCompleted: ${result?.label || 'the requested action'}.`,
                    action: null
                  }
                }
              : entry
          )
        );
        return { ok: true, label: result?.label };
      } catch (err) {
        return { ok: false, error: aiApi.toAiError(err) };
      } finally {
        setActionBusy(false);
      }
    },
    [setActionBusy, setMessages]
  );

  const reject = useCallback(
    async (token) => {
      setActionBusy(true);
      try {
        await aiApi.rejectAction(token, 'Declined by the user in CivicSync Intelligence.');
        clearAction(token);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: aiApi.toAiError(err) };
      } finally {
        setActionBusy(false);
      }
    },
    [setActionBusy, setMessages]
  );

  return { confirm, reject };
}
