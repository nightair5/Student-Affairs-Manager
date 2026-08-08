# Recognition Architecture 2.0

## Goal

The recognition subsystem converts one saved `Source` into an editable `ExtractionDraft`. It never writes AI output directly into confirmed projects or tasks.

## Flow

1. Save the source text and metadata locally.
2. Normalize whitespace, hash the request, assess source complexity, and collect only bounded project/task candidates.
3. Run the local deterministic recognizer immediately so the source is never lost.
4. When the user explicitly requests smart extraction and the Worker is configured, send the current text to the same-origin `/api/deepseek/extract` adapter.
5. Parse the response as `RecognitionResult 2.0`, verify literal evidence, field lengths, dates, counts and hierarchy limits, then deduplicate it.
6. Show the draft as Project → Milestone → WorkPackage → Task. Materials, time points and events remain independent entities.
7. Create formal entities only after the user selects and confirms them. Confirmed data is never silently overwritten.

## Simple and complex sources

Simple notices use local rules and normally produce standalone tasks or one shallow stage. Complex notices can use DeepSeek V4 Flash, but still pass the same runtime schema and post-processing. Supplemental/correction notices may match an existing project; low-confidence matches require an explicit user choice.

## Failure behaviour

Missing configuration, timeout, invalid JSON or invalid evidence leaves the `Source` and local draft intact. The user can retry, edit manually or keep the item as reference material. Naked links are fetched only through the user-authorized public-HTTPS reader; DeepSeek never receives a URL in place of page text.

## Public HTTPS reading

Any public HTTPS host is eligible without a hostname allowlist. URL credentials, literal IPs, local/private/internal hosts, nonstandard ports, non-text responses and bodies over 512 KB are rejected. At most three redirects are followed, with DNS and target validation repeated at every hop. Extracted page content is inert, untrusted text.
