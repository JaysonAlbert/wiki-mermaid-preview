# Repository Instructions

## Mermaid rendering regressions

- Every Mermaid source that is observed to fail rendering must be preserved as a regression fixture and covered by an automated test before its fix is implemented.
- Keep the fixture faithful to the original failing source. Do not reduce or rewrite it so far that the original failure mode is lost.
- A rendering fix is complete only after the new focused regression test and the existing full test suite pass.
