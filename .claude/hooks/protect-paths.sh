#!/bin/bash
# PreToolUse Hook: Blocks accidental modification of sensitive project files.
# Input is JSON on stdin: { "tool_input": { "file_path": "..." } }
# Exit 0 = allow, Exit 2 = block with error message.

FILE_PATH=$(cat | grep -o '"file_path"[^,]*' | cut -d'"' -f4)

if [[ -z "$FILE_PATH" ]]; then
  exit 0
fi

# Block direct editing of environment secrets or git internal directories
if [[ "$FILE_PATH" =~ \.env(\..*)?$ ]] || [[ "$FILE_PATH" =~ ^\.git/ ]] || [[ "$FILE_PATH" =~ ^secrets/ ]]; then
  echo "Blocked: Editing sensitive file '$FILE_PATH' is restricted for security." >&2
  exit 2
fi

exit 0
