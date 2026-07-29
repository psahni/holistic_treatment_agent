---
name: /commit
description: Commits all current changes and pushes them to the current branch.
---

# Slash Command: /commit

When the user invokes the `/commit` slash command, you must execute the following workflow:

1. **Check Status**: Run `git status` to see what files have been modified.
2. **Stage Changes**: Run `git add .` to stage all modifications.
3. **Commit**: 
   - If the user provides a commit message (e.g., `/commit "Fix header styling"`), use that message.
   - If no message is provided, review the changes using `git diff --cached` and generate a concise, descriptive commit message automatically.
   - Run `git commit -m "<message>"`.
4. **Push**: Run `git push` to push the committed changes to the current remote branch.

**Error Handling**: If any of these commands fail (for example, if the branch has no upstream branch configured, or if there is a conflict), you must stop and report the error to the user immediately, asking for how they'd like to proceed.
