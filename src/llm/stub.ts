/** API Key 없을 때 스텁 응답 (ReAct JSON 형식). */
export function stubResponse(prompt: string): string {
  const hasUserMessage = /User message:\s*\n?([\s\S]*?)(?=\n\n|$)/.exec(prompt);
  const userText = hasUserMessage ? hasUserMessage[1].trim().slice(0, 200) : "";
  return JSON.stringify({
    thought: "No API key set. Returning stub answer.",
    action: "answer",
    content: userText
      ? `(스텁) "${userText}" 에 대한 응답입니다. API Key를 설정하면 실제 LLM이 응답합니다.`
      : "API Key를 설정하면 ReAct·LLM이 동작합니다.",
  });
}

/** completeWithContext용 스텁: 마지막 user 메시지에서 "User message:" 다음 텍스트 추출. */
export function stubResponseWithContext(messages: { role: string; content: string }[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const content = lastUser?.content ?? "";
  const m = /User message:\s*\n?([\s\S]*?)(?=\n\n|$)/.exec(content);
  const userText = m ? m[1].trim().slice(0, 200) : "";
  return JSON.stringify({
    thought: "No API key set. Returning stub answer.",
    action: "answer",
    content: userText
      ? `(스텁) "${userText}" 에 대한 응답입니다. API Key를 설정하면 실제 LLM이 응답합니다.`
      : "API Key를 설정하면 ReAct·LLM이 동작합니다.",
  });
}
