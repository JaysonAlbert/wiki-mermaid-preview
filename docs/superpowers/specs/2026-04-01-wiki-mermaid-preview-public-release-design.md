# Wiki Mermaid Preview Public Release Design

## Summary

Upgrade the current internal-only extension into a public-safe Chrome Manifest V3 extension that does not embed any company-specific wiki domain in source control or packaged extension metadata.

The public release should keep the existing Mermaid preview behavior and selector-rule model, but change permission handling from a fixed internal host to runtime site authorization managed from the options page.

## Goals

- Remove all company-specific hostnames from source files, docs, tests, and packaged extension metadata
- Allow users to authorize one or more target sites at runtime
- Dynamically register the content script only for user-authorized sites
- Preserve the current selector-rule editing experience
- Keep existing preview behavior:
  - preserve source blocks
  - render Mermaid previews below source blocks
  - support multiple DOM shapes and extraction modes
  - fail safely when rendering fails

## Non-Goals

- Building a popup UI
- Exporting SVG or PNG
- Cross-browser support beyond Chrome MV3
- A visual selector recorder
- Automatic discovery of target sites

## Release Constraint

The public repository and built extension package must not contain:

- a company-specific wiki hostname
- any other company wiki hostname
- company-specific examples in README or tests

Generic references such as `example.com` are acceptable.

## Architecture Changes

The internal release used:

- static `host_permissions`
- static `content_scripts`
- company-specific default URL patterns

The public release will use:

1. Static extension shell
   - options page
   - background service worker
   - shared storage and rule logic
2. Runtime site authorization
   - request host permission for user-entered match patterns
   - remove host permission when a site is deleted
3. Dynamic content script registration
   - register the content script with `chrome.scripting.registerContentScripts`
   - unregister when site access is removed

The content script itself remains mostly unchanged and continues to load rules from storage and scan the current page.

## Permissions Model

### Manifest

Manifest should move to:

- `permissions`: `storage`, `permissions`, `scripting`
- `optional_host_permissions`: `http://*/*`, `https://*/*`
- no fixed `host_permissions`
- no static `content_scripts`
- include a `background.service_worker`

### Why

- `optional_host_permissions` allows the extension package to remain generic
- runtime permission requests avoid shipping company-specific domains
- dynamic content script registration keeps injection limited to approved sites

## Storage Model

Add a second storage record for authorized site patterns.

```ts
type SiteAccessPattern = {
  id: string
  pattern: string
}
```

Stored data:

- `selectorRules`: existing rule array
- `siteAccessPatterns`: list of user-authorized site match patterns

Rules and authorized sites are intentionally separate:

- rules describe how to extract Mermaid from DOM
- site access controls where the extension may run

## Selector Rule Changes

Default rules should become generic.

### Before

- internal defaults used `http://internal.example/*`

### After

- default rules use `*://*/*`

Rationale:

- selector rules are now reusable templates
- actual injection scope is controlled by authorized sites
- no company hostname remains in defaults

## Migration

On first load after upgrade:

1. Existing saved selector rules are loaded as-is
2. If default-style internal URL patterns such as `http://internal.example/*` are present, normalize them to `*://*/*`
3. If no site access list exists yet, initialize it as empty
4. Do not auto-request any new permissions

This keeps the upgrade safe and avoids surprising permission prompts.

## Background Responsibilities

Add a background service worker with these responsibilities:

1. Register scripts for all currently authorized site patterns on startup
2. Expose helpers for:
   - request site access
   - remove site access
   - refresh registrations after changes
3. Keep a stable content script registration id, for example `wiki-mermaid-preview-content`

Behavior:

- if there are no authorized sites, no content script is registered
- when a new site pattern is approved, re-register the content script with the full authorized pattern list
- when a site pattern is removed, unregister and re-register with the remaining list

## Options Page Changes

Keep the existing rule editor and add a new "Site Access" section above the rule list.

### Site Access Section

Each entry contains:

- site match pattern input
- add button
- list of authorized patterns
- remove action per pattern

Validation rules:

- only accept valid Chrome match patterns
- first release supports `http://` and `https://` patterns
- duplicates are rejected

Add flow:

1. User enters a pattern such as `http://example.com/*`
2. Extension validates the pattern
3. Extension calls `chrome.permissions.request`
4. If granted:
   - store the pattern
   - refresh dynamic content script registration

Remove flow:

1. User removes an existing pattern
2. Extension calls `chrome.permissions.remove`
3. Remove from storage
4. Refresh dynamic content script registration

UI copy should stay generic and never mention a company wiki.

## Content Script Behavior

No behavioral expansion is needed.

The content script should continue to:

- load selector rules from storage
- scan the current page URL against rule patterns
- render previews below matched Mermaid blocks
- observe DOM mutations

It should remain safe if no rules match the page.

## Validation

Add shared validation for:

- Chrome match pattern syntax for site access entries
- non-empty site access patterns
- non-empty selector rule names are optional
- invalid selectors continue to fail locally without crashing the page

## Documentation Changes

Update:

- README
- spec and plan references if needed
- test fixtures and examples

Use only neutral examples such as:

- `http://example.com/*`
- `https://wiki.example.com/*`

## Testing

Required coverage:

1. Storage tests
   - site access list load/save/remove behavior
   - migration from internal default URL patterns to generic patterns
2. Background tests
   - startup registration with empty and non-empty site lists
   - add/remove site flow updates registrations correctly
3. Options tests
   - add valid site pattern
   - reject duplicate site pattern
   - remove site pattern
4. Existing preview tests
   - must continue to pass

## Acceptance Criteria

- Git repository no longer contains company-specific wiki hostnames
- Built manifest no longer contains any company-specific domain
- Users can add an arbitrary `http` or `https` site pattern from the options page
- Granting site access registers the content script for that site
- Removing site access unregisters it
- Existing selector rules continue to drive DOM extraction and preview rendering
- The extension still renders previews for both:
  - line-by-line containers
  - single-element Mermaid blocks
