# Chrome Web Store Privacy Fields

## Single purpose description

Render Mermaid diagram previews directly below Mermaid source blocks on user-authorized wiki and documentation pages.

## Permission justification

### `storage`

Stores the user's extension settings, including authorized site patterns and Mermaid selector rules, so the extension can remember where it is allowed to run and how to detect Mermaid source blocks.

### `scripting`

Registers the packaged content script on user-authorized sites so the extension can scan the page for Mermaid source content and insert the local preview UI below the source block.

## Remote code use

No, this extension does not use remote code.

All executable logic is bundled inside the extension package. The extension does not load or execute remotely hosted JavaScript files, remotely hosted extension logic, or code fetched from external servers.

## Recommended Privacy Practices selections

Use the following conservative disclosure approach in the Privacy practices tab.

### Data collected

- `Website content`

Reason:

- The extension reads Mermaid source content from authorized pages in order to render a preview directly in the page.

### Data handling details

- Data is used only to provide the extension's core functionality.
- Data is not sold to third parties.
- Data is not used or transferred for purposes unrelated to the extension's single purpose.
- Data is not used to determine creditworthiness or for lending purposes.

### Practical note

The extension processes page content locally in the browser and stores user configuration in Chrome extension storage. It does not send Mermaid source, page content, selector rules, or site access patterns to the developer's servers.
