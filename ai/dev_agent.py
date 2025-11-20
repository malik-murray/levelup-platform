# ai/dev_agent.py

import os
import sys
import asyncio
from pathlib import Path
from collections.abc import Sequence
from typing import Literal

from agents import (
    Agent,
    Runner,
    ItemHelpers,
    ShellTool,
    ShellCommandRequest,
    ShellCommandOutput,
    ShellCallOutcome,
    ShellResult,
    WebSearchTool,
)

# ---------- CONFIG ----------

# Workspace = your repo root (levelup-platform)
REPO_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = REPO_ROOT  # you can change to a subfolder if needed

# Set this to 1 if you want to auto-approve shell commands
AUTO_APPROVE_ENV = "SHELL_AUTO_APPROVE"


# ---------- SHELL EXECUTOR ----------

async def require_approval(commands: Sequence[str]) -> None:
    """
    Ask for confirmation before running shell commands.

    Set SHELL_AUTO_APPROVE=1 in your environment to skip this prompt.
    """
    if os.environ.get(AUTO_APPROVE_ENV) == "1":
        return

    print("\nShell command approval required:")
    for c in commands:
        print("  ", c)
    resp = input("Proceed? [y/N] ").strip().lower()
    if resp not in {"y", "yes"}:
        raise RuntimeError("Shell command execution rejected by user.")


class ShellExecutor:
    """
    Runs all commands inside WORKSPACE_DIR, captures stdout/stderr,
    and respects optional timeouts.
    """

    def __init__(self, cwd: Path):
        self.cwd = cwd

    async def __call__(self, request: ShellCommandRequest) -> ShellResult:
        action = request.data.action
        await require_approval(action.commands)

        outputs: list[ShellCommandOutput] = []

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

# ---------- AGENT DEFINITION ----------

INSTRUCTIONS = """
You are the lead engineer on the LevelUp Platform, currently focused on the
LevelUp Financial app inside this monorepo.

Tech:
- Next.js 14 with App Router and TypeScript
- Supabase (auth + Postgres) with tables: accounts, categories, transactions, category_budgets

Goals:
- Implement features, fix bugs, clean up code, and keep TypeScript happy.
- work inside src/app/finance, src/components, and src/lib unless explicitly told otherwise.
- For non-finance apps (emotions, habit, markets, newsfeed, etc.) only touch them if the user asks.

Behavior:
- Before changing files, inspect them with tools like:
    - ls, find
    - sed -n '1,200p' <file>
    - cat <file>
- When editing files, use safe shell patterns like:
    - cat > path/to/file.tsx << 'EOF' ... EOF
    - or small, focused edits
- Avoid destructive commands (never use rm -rf, format disks, etc.).
- After making changes, run relevant checks when appropriate:
    - npm run lint
    - npm run build
    - or specific test commands the repo defines.

Communication:
- Think step-by-step, narrate what you're doing.
- Keep your shell commands minimal and focused.
- If something is ambiguous, explain the tradeoffs in your assistant messages.
"""

dev_agent = Agent(
    name="LevelUp Dev Agent",
    model="gpt-5.1",
    instructions=INSTRUCTIONS,
    tools=[
        WebSearchTool(),   # lets it look up docs / errors
        shell_tool,        # lets it run commands in your repo
    ],
)


# ---------- RUNNER WITH LOGGING ----------

async def run_dev_agent(task: str):
    print("=== LevelUp Dev Agent Run ===")
    print(f"[user task] {task}")
    print(f"Workspace: {WORKSPACE_DIR}\n")

    result = Runner.run_streamed(dev_agent, input=task)

    async for event in result.stream_events():
        if event.type != "run_item_stream_event":
            continue

        item = event.item

        if item.type == "tool_call_item":
            raw = item.raw_item
            raw_type_name = type(raw).__name__

            if raw_type_name == "ResponseFunctionWebSearch":
                print("[tool] web_search – agent is querying the web")
            elif raw_type_name == "LocalShellCall" or raw_type_name == "ShellCall":
                action = getattr(raw, "action", None)
                commands = getattr(action, "commands", None)
                if commands:
                    print(f"[tool] shell – wants to run: {commands}")
                else:
                    print("[tool] shell – wants to run a command")
            else:
                print(f"[tool] {raw_type_name} called")

        elif item.type == "tool_call_output_item":
            out_preview = str(item.output)
            if len(out_preview) > 400:
                out_preview = out_preview[:400] + "…"
            print(f"[tool output]\n{out_preview}\n")

        elif item.type == "message_output_item":
            text = ItemHelpers.text_message_output(item)
            if text.strip():
                print(f"[assistant]\n{text}\n")

    print("=== Run complete ===\n")
    print("Final summary:\n")
    print(result.final_output)


# ---------- CLI ENTRYPOINT ----------

def main():
    if "OPENAI_API_KEY" not in os.environ:
        print("ERROR: OPENAI_API_KEY is not set.")
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Usage: python ai/dev_agent.py \"describe the task\"")
        sys.exit(1)

    task = " ".join(sys.argv[1:])
    asyncio.run(run_dev_agent(task))


if __name__ == "__main__":
    main()
