# Security

## What this package does with generated code

`vibe_widget` asks a large language model for JavaScript and then runs that code in your
notebook page. The code executes with the same privileges as the page itself. It can read
and write anything the page can reach: the DOM, cookies and `localStorage` for the notebook
origin, and any network endpoint the browser is allowed to call. There is no browser-level
sandbox around it.

The Python side of the package runs in your kernel process. Agent tools that read or write
files are gated by a permission tier and a list of allowed roots, but the generated widget
code itself is not restricted by those settings.

Treat a generated widget the way you would treat a script someone sent you.

## Approval mode

By default widgets run as soon as they are generated:

```python
vw.config(execution="auto")     # default, runs immediately
vw.config(execution="approve")  # show the code and wait for you to approve it
```

Use `execution="approve"` when the prompt, the data, or the model is not fully trusted.
Approval is decided in Python, not in the browser, so a widget cannot approve itself.

## Agent tool permissions

Agent tools run under one of three presets:

- `safe` reads only, confined to the sandbox directory, no network.
- `project` (default) adds file writes and local data loading under the working directory.
- `connected` additionally allows `net.fetch` over HTTPS.

Set one with `vw.config(agent_preset="safe")`. Narrow the filesystem reach further with
`agent_run={"allowed_roots": [...]}`.

## What gets sent to the model

Prompts include a summary of the data you pass in. By default that summary contains a few
sample rows. To send only the schema and no cell values:

```python
vw.config(data_privacy="schema")
```

## Reporting a vulnerability

Do not open a public issue. Email the maintainers at dwootton@mit.edu with a description,
the affected version, and steps to reproduce. We aim to acknowledge within seven days.
