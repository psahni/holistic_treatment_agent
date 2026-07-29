---
name: /pr
description: Commits all current changes, pushes to the current branch, and creates a Pull Request with a descriptive title and body.
---

# Slash Command: /pr

When the user invokes the `/pr` slash command, you must execute the following workflow:

1. **Check Status & Stage**: 
   - Run `git status` to identify modified files.
   - Run `git add .` to stage all modifications.

2. **Commit**: 
   - If the user provides a prompt or title (e.g., `/pr "Add login feature"`), use that as guidance.
   - Review the changes using `git diff --cached`.
   - Generate a concise, descriptive commit message based on the changes.
   - Run `git commit -m "<message>"`.

3. **Push**:
   - Determine the current branch using `git branch --show-current`.
   - Run `git push origin <current-branch-name>`. 
   - If the upstream branch is not set, use `git push --set-upstream origin <current-branch-name>`.
   - Ensure the push is successful before proceeding.

4. **Create Pull Request**:
   - You must use the `gh` CLI tool (e.g., `gh pr create`).
   - Analyze the commits and diffs to generate a detailed, "nice description" for the PR. The description should clearly explain what was changed, why it was changed, and how it was implemented.
   - Also generate a fitting, concise PR title.
   - Use the command: `gh pr create --title "<Generated Title>" --body "<Generated Detailed Body Description>"`
   - If the `gh` CLI is not available or encounters an error, provide the user with the PR creation link that is typically output by the `git push` command.

**Error Handling**: If any of these steps fail (for example, if there are merge conflicts, uncommitted changes that block operations, or authentication issues with `gh`), you must stop immediately, report the error to the user clearly, and wait for further instructions.
