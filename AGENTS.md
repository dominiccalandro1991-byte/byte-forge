<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep diagnostic result rendering in the shared engine result view, so charts, AST navigation and code diffs use the actual persisted output.
- Engine workspaces are public inspection pages with inline sign-in for execution; authenticated server functions protect private runs.
- Never persist plaintext keys, passphrases or environment-file contents in run inputs; keep sensitive computations browser-local.
