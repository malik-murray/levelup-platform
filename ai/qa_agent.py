# ai/qa_agent.py

import os
import sys
import asyncio
from pathlib import Path

from agents import (
    Agent,
    Runner,
    ItemHelpers,
    ShellTool,
    ShellCommandRequest,
    ShellCommandOutput,
    ShellCallOutcome,
    ShellResult,
)

# ---------- CONFIG ----------

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = REPO_ROOT


# ---------- SHELL EXECUTOR (same pattern as dev_agent, read-only on files) ----------

async def require_approval(commands):
    if os.environ.get("SHELL_AUTO_APPROVE") == "1":
        return
    print("\n[QA] Shell command approval required:")
    for c in commands:
        print("   ", c)
    resp = input("Proceed? [y/N] ").strip().lower()
    if resp not in {"y", "yes"}:
        raise RuntimeError("Shell command execution rejected by user.")


class ShellExecutor:
    def __init__(self, cwd: Path):
        self.cwd = cwd

    async def __call__(self, request: ShellCommandRequest) -> ShellResult:
        action = request.data.action
        await require_approval(action.commands)

        outputs = []

        for command in action.commands:
            proc = await asyncio.create_subprocess_shell(
                command,
                cwd=self.cwd,
                env=os.environ.copy(),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            timed_out = False
            try:
                timeout = (action.timeout_ms or 0) / 1000 or None
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                proc.kill()
                stdout_bytes, stderr_bytes = await proc.communicate()
                timed_out = True

            stdout = stdout_bytes.decode("utf-8", errors="ignore")
            stderr = stderr_bytes.decode("utf-8", errors="ignore")

            outcome = ShellCallOutcome(
                type="timeout" if timed_out else "exit",
                exit_code=getattr(proc, "returncode", None),
            )

            outputs.append(
                ShellCommandOutput(
                    command=command,
                    stdout=stdout,
                    stderr=stderr,
                    outcome=outcome,
                )
            )

            if timed_out:
                break

        return ShellResult(
            output=outputs,
            provider_data={"working_directory": str(self.cwd)},
        )


shell_tool = ShellTool(executor=ShellExecutor(cwd=WORKSPACE_DIR))

# ---------- QA AGENT ----------

QA_INSTRUCTIONS = """
You are the QA / test engineer for the LevelUp Platform.

Your job:
- Run the project's checks (lint, build, tests) and summarize problems.
- Focus on issues that affect the LevelUp Financial app first.
- Do NOT modify any files yourself. Only run commands and analyze output.

Typical commands to consider:
- npm run lint
- npm run build
- npm test  (if configured)

Behavior:
- Propose the commands you plan to run.
- After each command, parse the stdout/stderr and explain:
    - What failed
    - Which files are involved
    - Which errors are highest priority
- If all commands succeed, clearly say that the repo is passing QA.
"""

qa_agent = Agent(
    name="LevelUp QA Agent",
    model="gpt-5.1",
    instructions=QA_INSTRUCTIONS,
    tools=[shell_tool],
)


async def run_qa(task: str):
    print("=== LevelUp QA Agent Run ===")
    print(f"[user QA request] {task}")
    print(f"Workspace: {WORKSPACE_DIR}\n")

    result = Runner.run_streamed(qa_agent, input=task)

    async for event in result.stream_events():
        if event.type != "run_item_stream_event":
            continue

        item = event.item

        if item.type == "tool_call_item":
            raw = item.raw_item
            raw_type_name = type(raw).__name__
            if raw_type_name in ("LocalShellCall", "ShellCall"):
                action = getattr(raw, "action", None)
                commands = getattr(action, "commands", None)
                if commands:
                    print(f"[QA tool] shell – wants to run: {commands}")
        elif item.type == "tool_call_output_item":
            out_preview = str(item.output)
            if len(out_preview) > 400:
                out_preview = out_preview[:400] + "…"
            print(f"[QA tool output]\n{out_preview}\n")
        elif item.type == "message_output_item":
            text = ItemHelpers.text_message_output(item)
            if text.strip():
                print(f"[QA report]\n{text}\n")

    print("=== QA run complete ===\n")
    print("Final QA summary:\n")
    print(result.final_output)


def main():
    if "OPENAI_API_KEY" not in os.environ:
        print("ERROR: OPENAI_API_KEY is not set.")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Usage: python ai/qa_agent.py \"describe what to check\"")
        sys.exit(1)

    task = " ".join(sys.argv[1:])
    asyncio.run(run_qa(task))


if __name__ == "__main__":
    main()
