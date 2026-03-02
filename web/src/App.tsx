import { useState, useEffect, useCallback } from "react";
import {
  getSessions,
  createSession,
  getSession,
  getSkills,
  sendChat,
  deleteSession,
  updateSessionTitle,
  getMcpServers,
  addMcpServer,
  deleteMcpServer,
  getMcpServerTools,
  getSkill,
  patchSkill,
  postSkill,
  deleteSkill,
  loadSettings,
  saveSettings,
} from "./api";
import type { Session, Message, SkillMeta, McpServer, AppSettings } from "./api";

function formatTime(ts: number): string {
  const d = new Date(typeof ts === "number" ? ts * 1000 : ts);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 60000;
  if (diff < 1) return "방금";
  if (diff < 60) return Math.floor(diff) + "분 전";
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function Nav({ current, onNav }: { current: string; onNav: (v: string) => void }) {
  const tabs = [
    { id: "chat", label: "채팅" },
    { id: "sources", label: "소스" },
    { id: "tools", label: "도구" },
    { id: "settings", label: "설정" },
  ];
  return (
    <nav className="flex items-center gap-6 border-b border-borderSoft bg-surface px-5 py-0 shadow-soft">
      <span className="py-4 text-base font-semibold text-text">ShadowClaw</span>
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onNav(t.id)}
            className={`rounded-t-panel px-4 py-3 text-sm font-medium transition-all duration-200 ${
              current === t.id
                ? "bg-bg text-text shadow-card"
                : "text-muted hover:bg-black/5 hover:text-textSecondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function SessionList({
  sessions,
  currentId,
  onNew,
  onSelect,
  onDelete,
  onEditTitle,
  onRefresh,
}: {
  sessions: Session[];
  currentId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
  onRefresh: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (s: Session) => {
    setEditingId(s.id);
    setEditValue(s.title || "새 대화");
  };

  const submitEdit = useCallback(
    async (id: string) => {
      const t = editValue.trim() || "새 대화";
      setEditingId(null);
      try {
        await updateSessionTitle(id, t);
        onEditTitle(id, t);
        onRefresh();
      } catch {
        setEditingId(id);
        setEditValue(t);
      }
    },
    [editValue, onEditTitle, onRefresh]
  );

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("이 대화를 삭제할까요?")) return;
    try {
      await deleteSession(id);
      onDelete(id);
      onRefresh();
    } catch (_) {
      // ignore
    }
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-borderSoft bg-surface py-4">
      <button
        type="button"
        onClick={onNew}
        className="mx-4 rounded-input bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-card transition hover:bg-accentHover"
      >
        새 대화
      </button>
      <h3 className="mt-5 px-4 pb-2 text-xs font-medium uppercase tracking-wider text-muted">이전 대화</h3>
      {sessions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-sm text-muted">저장된 대화가 없습니다.</p>
          <p className="mt-1 text-xs text-muted">새 대화를 시작하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`group flex items-center gap-2 rounded-input px-3 py-2.5 text-sm transition ${
                s.id === currentId ? "bg-accent/10 text-accent" : "hover:bg-black/5"
              }`}
            >
              {editingId === s.id ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => submitEdit(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="min-w-0 flex-1 rounded-input border border-border bg-bg px-2 py-1.5 text-xs text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  autoFocus
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className="min-w-0 flex-1 truncate text-left"
                  >
                    <div className="truncate font-medium text-text">{s.title || "새 대화"}</div>
                    <div className="text-xs text-muted">{formatTime(s.updated_at)}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="shrink-0 rounded-input p-1.5 text-muted opacity-0 transition hover:bg-black/10 hover:text-text group-hover:opacity-100"
                    title="제목 수정"
                    aria-label="제목 수정"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(s.id, e)}
                    className="shrink-0 rounded-input p-1.5 text-muted opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="삭제"
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function Messages({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex max-w-[85%] flex-col rounded-panel border border-borderSoft bg-surface px-5 py-4 shadow-bubble transition ${
            m.role === "user" ? "ml-auto bg-accent/10 border-accent/20" : ""
          }`}
        >
          <div className="mb-2 text-xs font-medium text-muted">{m.role === "user" ? "나" : "ShadowClaw"}</div>
          <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-textSecondary">{m.content}</div>
        </div>
      ))}
    </div>
  );
}

function SkillsPanel({ skills, forced, onToggle }: { skills: SkillMeta[]; forced: string | null; onToggle: (name: string) => void }) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-borderSoft bg-surface p-4">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">스킬 / 도구</h3>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {skills.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onToggle(s.name)}
            title={s.description + "\nparams: " + JSON.stringify(s.params_schema || {})}
            className={`w-full rounded-input border px-3 py-2.5 text-left text-sm transition-all ${
              forced === s.name
                ? "border-accent bg-accent/10 text-accent"
                : "border-borderSoft bg-bg/80 hover:bg-black/5 hover:border-border"
            }`}
          >
            <div className="font-medium text-text">{s.name}</div>
            <div className="mt-1 line-clamp-2 text-xs text-muted">{s.description?.slice(0, 60)}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ChatView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [forceSkill, setForceSkill] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      const list = await getSessions();
      setSessions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadSession = async (id: string) => {
    try {
      const data = await getSession(id);
      setMessages(data.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadSkills = async () => {
    try {
      const list = await getSkills({ excludeBuiltin: true });
      setSkills(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    loadSessions();
    loadSkills();
  }, []);

  useEffect(() => {
    if (currentId) loadSession(currentId);
    else setMessages([]);
  }, [currentId]);

  const handleNewSession = async () => {
    try {
      setError(null);
      const id = await createSession();
      setCurrentId(id);
      setMessages([]);
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setError(null);
    let sid = currentId;
    if (!sid) {
      try {
        sid = await createSession();
        setCurrentId(sid);
        await loadSessions();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setSending(false);
        return;
      }
    }
    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: new Date().toISOString() }]);
    try {
      const result = await sendChat(text, sid, {
        force_skill: forceSkill ?? undefined,
        model: settings.provider,
      });
      setCurrentId(result.session_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.content, timestamp: new Date().toISOString(), tool_calls: result.tool_calls as Message["tool_calls"] },
      ]);
      await loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "오류: " + (e instanceof Error ? e.message : String(e)), timestamp: new Date().toISOString() },
      ]);
    }
    setSending(false);
  };

  const toggleForceSkill = (name: string) => setForceSkill((prev) => (prev === name ? null : name));

  const handleSessionDelete = useCallback((id: string) => {
    setCurrentId((prev) => (prev === id ? null : prev));
  }, []);

  const settings = loadSettings();

  return (
    <div className="flex flex-1 min-h-0">
      <SessionList
        sessions={sessions}
        currentId={currentId}
        onNew={handleNewSession}
        onSelect={(id) => setCurrentId(id)}
        onDelete={handleSessionDelete}
        onEditTitle={() => {}}
        onRefresh={loadSessions}
      />
      <section className="flex flex-1 flex-col min-w-0">
        <Messages messages={messages} />
        {error && (
          <div className="mx-6 mb-2 rounded-input border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="flex gap-3 border-t border-borderSoft bg-surface p-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="메시지를 입력하세요..."
            className="flex-1 rounded-input border border-border bg-bg px-4 py-3 text-[15px] text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="rounded-input bg-accent px-6 py-3 font-medium text-white shadow-card transition hover:bg-accentHover disabled:opacity-50"
          >
            {sending ? "전송 중…" : "전송"}
          </button>
        </div>
      </section>
      <SkillsPanel skills={skills} forced={forceSkill} onToggle={toggleForceSkill} />
    </div>
  );
}

function SourcesView() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-2 text-2xl font-semibold text-text">소스</h2>
        <p className="mb-8 text-sm text-muted">
          문서, URL, 텍스트를 연결하면 채팅 시 에이전트가 해당 내용을 참고해 답변합니다. (노트북LM 스타일)
        </p>
        <div className="rounded-panel border border-borderSoft bg-surface p-8 shadow-soft">
          <button
            type="button"
            className="rounded-input border-2 border-dashed border-border bg-transparent px-6 py-4 text-sm font-medium text-muted transition hover:border-accent hover:bg-accent/5 hover:text-textSecondary"
          >
            + 소스 추가
          </button>
          <p className="mt-6 text-center text-sm text-muted">
            저장된 소스가 여기에 표시됩니다.
          </p>
          <p className="mt-1 text-center text-xs text-muted">
            PDF, 웹사이트, 텍스트를 추가하거나 붙여넣을 수 있습니다. (구현 예정)
          </p>
        </div>
      </div>
    </div>
  );
}

function ToolsView() {
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [serverTools, setServerTools] = useState<Record<string, { name: string; description?: string }[]>>({});
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [mcpFormName, setMcpFormName] = useState("");
  const [mcpFormUrl, setMcpFormUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [skillEditOpen, setSkillEditOpen] = useState(false);
  const [skillEditName, setSkillEditName] = useState("");
  const [skillEditContent, setSkillEditContent] = useState("");
  const [skillEditSaving, setSkillEditSaving] = useState(false);
  const [skillCreateOpen, setSkillCreateOpen] = useState(false);
  const [skillCreateName, setSkillCreateName] = useState("");
  const [skillCreateDesc, setSkillCreateDesc] = useState("");
  const [skillCreateSchema, setSkillCreateSchema] = useState("");
  const [skillCreateSaving, setSkillCreateSaving] = useState(false);

  const loadMcp = useCallback(async () => {
    try {
      setMcpError(null);
      const list = await getMcpServers();
      setMcpServers(list);
    } catch (e) {
      setMcpError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadSkills = useCallback(async () => {
    try {
      setSkillsError(null);
      const list = await getSkills({ includeDisabled: true, excludeBuiltin: true });
      setSkills(list);
    } catch (e) {
      setSkillsError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadMcp();
    loadSkills();
  }, [loadMcp, loadSkills]);

  const loadToolsFor = useCallback(async (id: string) => {
    try {
      const tools = await getMcpServerTools(id);
      setServerTools((prev) => ({ ...prev, [id]: tools }));
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (expandedServerId && !serverTools[expandedServerId]) loadToolsFor(expandedServerId);
  }, [expandedServerId, loadToolsFor, serverTools]);

  const handleOpenMcpModal = () => {
    setMcpError(null);
    setMcpFormName("");
    setMcpFormUrl("");
    setMcpModalOpen(true);
  };

  const handleCloseMcpModal = () => {
    setMcpModalOpen(false);
    setMcpFormName("");
    setMcpFormUrl("");
  };

  const handleAddServer = async () => {
    setAdding(true);
    try {
      await addMcpServer({ name: mcpFormName || undefined, url: mcpFormUrl || undefined, transport: "http" });
      handleCloseMcpModal();
      await loadMcp();
    } catch (e) {
      setMcpError(e instanceof Error ? e.message : String(e));
    }
    setAdding(false);
  };

  const handleDeleteServer = async (id: string) => {
    if (!window.confirm("이 MCP 서버를 제거할까요?")) return;
    try {
      await deleteMcpServer(id);
      setExpandedServerId((prev) => (prev === id ? null : prev));
      await loadMcp();
    } catch (e) {
      setMcpError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSkillToggle = async (name: string, enabled: boolean) => {
    try {
      await patchSkill(name, { enabled });
      await loadSkills();
    } catch (e) {
      setSkillsError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOpenSkillEdit = async (name: string) => {
    setSkillsError(null);
    try {
      const skill = await getSkill(name);
      setSkillEditName(name);
      setSkillEditContent(skill.content ?? "");
      setSkillEditOpen(true);
    } catch (e) {
      setSkillsError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCloseSkillEdit = () => {
    setSkillEditOpen(false);
    setSkillEditName("");
    setSkillEditContent("");
  };

  const handleSaveSkillContent = async () => {
    if (!skillEditName) return;
    setSkillEditSaving(true);
    try {
      await patchSkill(skillEditName, { content: skillEditContent });
      handleCloseSkillEdit();
      await loadSkills();
    } catch (e) {
      setSkillsError(e instanceof Error ? e.message : String(e));
    }
    setSkillEditSaving(false);
  };

  const handleOpenSkillCreate = () => {
    setSkillsError(null);
    setSkillCreateName("");
    setSkillCreateDesc("");
    setSkillCreateSchema("");
    setSkillCreateOpen(true);
  };

  const handleCloseSkillCreate = () => {
    setSkillCreateOpen(false);
    setSkillCreateName("");
    setSkillCreateDesc("");
    setSkillCreateSchema("");
  };

  const handleCreateSkill = async () => {
    const name = skillCreateName.trim();
    if (!name) {
      setSkillsError("스킬 이름을 입력하세요.");
      return;
    }
    setSkillCreateSaving(true);
    setSkillsError(null);
    try {
      let params_schema: Record<string, string> = {};
      if (skillCreateSchema.trim()) {
        try {
          params_schema = JSON.parse(skillCreateSchema.trim()) as Record<string, string>;
        } catch {
          setSkillsError("params_schema는 유효한 JSON 객체여야 합니다.");
          setSkillCreateSaving(false);
          return;
        }
      }
      await postSkill({ name, description: skillCreateDesc.trim() || undefined, params_schema });
      handleCloseSkillCreate();
      await loadSkills();
    } catch (e) {
      setSkillsError(e instanceof Error ? e.message : String(e));
    }
    setSkillCreateSaving(false);
  };

  const handleDeleteSkill = async (name: string) => {
    if (!window.confirm(`스킬 "${name}"을(를) 삭제할까요?`)) return;
    try {
      await deleteSkill(name);
      await loadSkills();
    } catch (e) {
      setSkillsError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h2 className="mb-2 text-2xl font-semibold text-text">도구</h2>
      <p className="mb-8 text-sm text-muted">MCP 서버와 스킬을 등록·관리합니다.</p>
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="rounded-panel border border-borderSoft bg-surface p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">MCP 서버</h3>
            <button
              type="button"
              onClick={handleOpenMcpModal}
              className="rounded-input border border-border bg-bg px-3 py-2 text-sm font-medium text-text transition hover:bg-black/5"
            >
              + MCP 서버 등록
            </button>
          </div>
          {mcpError && (
            <div className="mb-4 rounded-input border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {mcpError}
            </div>
          )}
          <ul className="space-y-3">
            {mcpServers.map((s) => (
              <li key={s.id} className="rounded-input border border-borderSoft bg-bg p-4 transition hover:border-border">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedServerId((prev) => (prev === s.id ? null : s.id))}
                    className="text-left font-medium text-text"
                  >
                    {s.name || s.id} {s.url ? ` · ${s.url}` : ""}
                  </button>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">연결됨</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteServer(s.id)}
                    className="rounded-input p-2 text-muted transition hover:bg-red-50 hover:text-red-500"
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </div>
                {expandedServerId === s.id && (
                  <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
                    <div className="font-medium text-muted">도구</div>
                    {(serverTools[s.id] ?? []).length === 0 ? (
                      <p className="mt-1">로딩 중이거나 없음</p>
                    ) : (
                      <ul className="mt-1 list-inside list-disc">
                        {(serverTools[s.id] ?? []).map((t) => (
                          <li key={t.name}>{t.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {mcpModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => e.target === e.currentTarget && handleCloseMcpModal()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mcp-modal-title"
          >
            <div
              className="w-full max-w-md rounded-panel border border-border bg-surface p-6 shadow-soft"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="mcp-modal-title" className="text-lg font-semibold text-text">
                  MCP 서버 등록
                </h2>
                <button
                  type="button"
                  onClick={handleCloseMcpModal}
                  className="rounded-input p-2 text-muted transition hover:bg-black/10 hover:text-text"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">이름 (선택)</label>
                  <input
                    type="text"
                    value={mcpFormName}
                    onChange={(e) => setMcpFormName(e.target.value)}
                    placeholder="서버 식별용 이름"
                    className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">URL (선택)</label>
                  <input
                    type="text"
                    value={mcpFormUrl}
                    onChange={(e) => setMcpFormUrl(e.target.value)}
                    placeholder="http://..."
                    className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseMcpModal}
                  className="rounded-input border border-border bg-bg px-4 py-2 text-sm font-medium text-text transition hover:bg-black/5"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleAddServer}
                  disabled={adding}
                  className="rounded-input bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentHover disabled:opacity-50"
                >
                  {adding ? "등록 중…" : "등록"}
                </button>
              </div>
            </div>
          </div>
        )}

        {skillEditOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => e.target === e.currentTarget && handleCloseSkillEdit()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-edit-modal-title"
          >
            <div
              className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-panel border border-border bg-surface shadow-soft"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-borderSoft px-6 py-4">
                <h2 id="skill-edit-modal-title" className="text-lg font-semibold text-text">
                  스킬 편집 — {skillEditName}
                </h2>
                <button
                  type="button"
                  onClick={handleCloseSkillEdit}
                  className="rounded-input p-2 text-muted transition hover:bg-black/10 hover:text-text"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
              <p className="shrink-0 px-6 pt-2 text-xs text-muted">마크다운으로 스킬 설명·내용을 수정합니다.</p>
              <textarea
                value={skillEditContent}
                onChange={(e) => setSkillEditContent(e.target.value)}
                className="min-h-[280px] flex-1 resize-y border-0 border-t border-borderSoft bg-bg px-6 py-4 font-mono text-sm text-text focus:outline-none focus:ring-0"
                placeholder="# 스킬 이름\n\n설명..."
                spellCheck={false}
              />
              <div className="flex shrink-0 justify-end gap-2 border-t border-borderSoft px-6 py-4">
                <button
                  type="button"
                  onClick={handleCloseSkillEdit}
                  className="rounded-input border border-border bg-bg px-4 py-2 text-sm font-medium text-text transition hover:bg-black/5"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveSkillContent}
                  disabled={skillEditSaving}
                  className="rounded-input bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentHover disabled:opacity-50"
                >
                  {skillEditSaving ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
          </div>
        )}

        {skillCreateOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={(e) => e.target === e.currentTarget && handleCloseSkillCreate()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="skill-create-modal-title"
          >
            <div
              className="w-full max-w-md rounded-panel border border-border bg-surface p-6 shadow-soft"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="skill-create-modal-title" className="text-lg font-semibold text-text">
                  스킬 등록
                </h2>
                <button
                  type="button"
                  onClick={handleCloseSkillCreate}
                  className="rounded-input p-2 text-muted transition hover:bg-black/10 hover:text-text"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">이름 (필수)</label>
                  <input
                    type="text"
                    value={skillCreateName}
                    onChange={(e) => setSkillCreateName(e.target.value)}
                    placeholder="예: my_custom_skill"
                    className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">설명 (선택)</label>
                  <input
                    type="text"
                    value={skillCreateDesc}
                    onChange={(e) => setSkillCreateDesc(e.target.value)}
                    placeholder="스킬 설명"
                    className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">params_schema (선택, JSON)</label>
                  <textarea
                    value={skillCreateSchema}
                    onChange={(e) => setSkillCreateSchema(e.target.value)}
                    placeholder='{"key": "string"}'
                    rows={3}
                    className="w-full rounded-input border border-border bg-bg px-3 py-2.5 font-mono text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseSkillCreate}
                  className="rounded-input border border-border bg-bg px-4 py-2 text-sm font-medium text-text transition hover:bg-black/5"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleCreateSkill}
                  disabled={skillCreateSaving}
                  className="rounded-input bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentHover disabled:opacity-50"
                >
                  {skillCreateSaving ? "등록 중…" : "등록"}
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-panel border border-borderSoft bg-surface p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">스킬 (활성/비활성)</h3>
            <button
              type="button"
              onClick={handleOpenSkillCreate}
              className="rounded-input border border-border bg-bg px-3 py-2 text-sm font-medium text-text transition hover:bg-black/5"
            >
              + 스킬 등록
            </button>
          </div>
          {skillsError && (
            <div className="mb-4 rounded-input border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {skillsError}
            </div>
          )}
          <ul className="space-y-3">
            {skills.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 rounded-input border border-borderSoft bg-bg px-4 py-3 transition hover:border-border">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-text">{s.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">{s.description}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenSkillEdit(s.name)}
                    className="rounded-input border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text transition hover:bg-black/5"
                  >
                    편집
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSkill(s.name)}
                    className="rounded-input px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    삭제
                  </button>
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-muted">활성</span>
                    <input
                      type="checkbox"
                      checked={s.enabled !== false}
                      onChange={(e) => handleSkillToggle(s.name, e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function SettingsView() {
  const [provider, setProvider] = useState<AppSettings["provider"]>("claude");

  useEffect(() => {
    const s = loadSettings();
    setProvider(s.provider ?? "claude");
  }, []);

  const handleProviderChange = (v: "claude" | "gpt") => {
    setProvider(v);
    saveSettings({ provider: v });
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h2 className="mb-2 text-2xl font-semibold text-text">설정</h2>
      <p className="mb-8 text-sm text-muted">모델을 선택합니다. API Key는 서버 환경변수로만 설정합니다.</p>
      <div className="mx-auto max-w-md space-y-6 rounded-panel border border-borderSoft bg-surface p-6 shadow-soft">
        <div>
          <label className="mb-2 block text-xs font-medium text-muted">모델 (프로바이더)</label>
          <select
            value={provider ?? "claude"}
            onChange={(e) => handleProviderChange(e.target.value as "claude" | "gpt")}
            className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="gpt">GPT (OpenAI)</option>
          </select>
        </div>
        <div className="rounded-input border border-borderSoft bg-bg/80 px-4 py-3 text-sm text-muted">
          <strong className="text-textSecondary">API Key</strong>는 화면에서 입력하지 않습니다. 서버 실행 시 환경변수{" "}
          <code className="rounded bg-bg px-1 font-mono text-xs">ANTHROPIC_API_KEY</code>,{" "}
          <code className="rounded bg-bg px-1 font-mono text-xs">OPENAI_API_KEY</code>로 설정하세요.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("chat");

  return (
    <div className="flex h-screen flex-col">
      <Nav current={view} onNav={setView} />
      <main className="flex flex-1 min-h-0">
        {view === "chat" && <ChatView />}
        {view === "sources" && <SourcesView />}
        {view === "tools" && <ToolsView />}
        {view === "settings" && <SettingsView />}
      </main>
    </div>
  );
}
