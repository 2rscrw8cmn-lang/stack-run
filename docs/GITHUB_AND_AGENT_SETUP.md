# GitHub, Agent, and Deployment Setup

## 1. Create the repository

Create a private GitHub repository:

```text
stack-run
```

Do not initialize it with generated application code.

Add this packet first so the documentation is the initial authority.

## 2. Add the packet

Using GitHub Desktop:

1. Clone the empty repository.
2. Copy this packet's contents into the local repository folder.
3. Confirm `README.md`, `AGENTS.md`, `docs/`, `seed/`, and `reference/` are at repository root.
4. Commit as:

```text
docs: establish STACK product and build plan
```

5. Push to `main`.

Command-line equivalent:

```bash
git clone <REPOSITORY_URL>
cd stack-run
# Copy packet contents here
git add .
git commit -m "docs: establish STACK product and build plan"
git push origin main
```

## 3. Connect GitHub to ChatGPT or Codex

### ChatGPT GitHub app

1. Open ChatGPT Settings.
2. Open Apps.
3. Select GitHub.
4. Authorize the GitHub app.
5. Grant access to the `stack-run` repository.
6. When starting work, name the repository explicitly.

New or private repositories may take several minutes to appear. Repository access can be changed from the GitHub app settings.

### Codex cloud

1. Open Codex and sign in.
2. Connect GitHub when prompted.
3. Select `stack-run`.
4. Create an environment for the repository.
5. Use the default Node environment unless the scaffold proves otherwise.
6. Do not add secrets; v1 has no backend or external API.

## 4. Working pattern

For each phase:

1. Start from the latest `main`.
2. Create the documented branch.
3. Paste only the matching phase prompt.
4. Require the agent to read `AGENTS.md`.
5. Review the pull request.
6. Run checks.
7. Merge only after the exit gate passes.
8. Pull the merged `main` before starting the next phase.

## 5. Vercel connection

Connect only after Phase 0 builds successfully.

1. Open Vercel.
2. Import the `stack-run` GitHub repository.
3. Confirm Vite is detected.
4. Build command:

```text
npm run build
```

5. Output directory:

```text
dist
```

6. Deploy.
7. Keep `main` as production.
8. Use pull-request preview deployments for review.

No environment variables are required for v1.

## 6. Repository protection

Recommended:

- Require pull requests before merging to `main`.
- Require the check workflow when one is added.
- Delete merged branches.
- Use squash merge for one clean commit per phase.
- Do not permit force pushes to `main`.

## 7. First agent handoff

Use the Phase 0 prompt in `AGENT_PROMPTS.md`.

Do not tell the agent to “build the whole app.”
