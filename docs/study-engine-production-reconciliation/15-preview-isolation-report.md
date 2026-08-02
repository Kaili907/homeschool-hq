# Preview isolation report

Local Study Engine preview now requires all three conditions:

1. a development build;
2. the Study feature flag set to the exact enabled value;
3. an explicit preview opt-in.

The host dynamically imports local ports and preview Study components only inside the development-only path. Production builds cannot enable the local adapter by changing a runtime flag. Production port branding also rejects local, memory, test, fixture, preview, synthetic, noop, and mock provenance.

The production build was statically scanned and did not contain the synthetic learner sentinel, local port labels, synthetic fixtures, or preview adapter identifiers covered by the scan.
