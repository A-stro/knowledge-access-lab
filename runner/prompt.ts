// runner/prompt.ts — the one prompt every lane gets (F3, ISC-15; v2 after the
// OpenCode review of 85c0c2a).
//
// Architecture is the variable; everything else is the constant. The same
// template is rendered for every lane and every question — only the question
// text is substituted — so no lane is ever prompted differently. The template
// deliberately does NOT reveal where the knowledge base lives or how it is
// organized: discovering the surface is the lane's job and part of what is
// being measured.
//
// Path wording is lane-neutral on purpose (review finding 4): MCP lanes take
// corpus-relative paths and the direct lane runs with its corpus sandbox as
// cwd, so "relative paths, never absolute" is the true instruction for every
// lane — "repository-relative" was true for only one of the four.

export function buildPrompt(questionText: string): string {
  return [
    "You are answering one question over a private knowledge base using the tools available to you.",
    "Retrieve evidence with your tools before answering; never answer from memory alone.",
    "Pass relative paths to tools; never absolute paths.",
    "",
    "Answer the question, then cite your evidence: for each fact, name the record it came from and quote the exact supporting passage.",
    "If the knowledge base contains no evidence that answers the question, reply with exactly: no evidence found",
    "",
    `Question: ${questionText}`,
  ].join("\n");
}
