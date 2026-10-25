# Product brief

## Concept

A cloud for small software: sharing an internal tool should feel as simple as sharing a document. Parcel starts with the useful tools that are too small to justify a dedicated software project and too structured to live comfortably in a document.

## Product prompt

Build Parcel, a warm, thoughtful workspace for small internal tools. A user should reach a useful working tool in under a minute: choose a template, name it, add data, and share a link. Prioritize clear privacy, reliable data, accessible forms, mobile usability, and calm visual hierarchy. Use an editorial paper-like design with sage navigation, peach/lavender/lime tool covers, handcrafted CSS illustrations, generous spacing, and concise human language. Avoid speculative claims, fake integrations, fake usage charts, and inactive controls. Every displayed workflow should work against persistent storage.

## Primary journeys

1. Explore a private demo; create an account to retain access.
2. Create a tool from expenses, contacts, or checklist templates.
3. Enter validated records and edit them; metrics reflect stored data.
4. Search, favorite, and revisit tools.
5. Enable a view-only link, inspect its public view, then revoke access.
6. Export records and inspect workspace activity.

## Acceptance criteria

- Account A cannot read or mutate account B's private tools.
- Anonymous readers only access tools with active unguessable share tokens.
- Revoked links stop working on the next request.
- Public sharing clearly includes visibility and export of the tool's records.
- Required fields and schema values are validated on the server.
- Database contents survive application restarts.
- Mobile layouts do not overflow the viewport; tables scroll within their containers.
- Destructive actions require explicit confirmation; forms expose errors.
- No secret is required to try the core experience.

## Next product milestones

1. Team memberships, invitations, role-based access, verified email, account recovery, and audit retention.
2. Custom schema builder, version history, import previews, and connector credentials stored in a proper vault.
3. Isolated executable tools with per-tool resource limits, signed artifacts, deployment rollback, dependency scanning, and restricted network access.
4. Organization SSO, private network connectors, usage budgets, backups and operational monitoring.

This project is inspired by the small-software cloud concept. It does not claim affiliation, endorsement, or investment from Y Combinator, or that its design is globally unprecedented.
