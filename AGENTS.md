# Architecture Rules

- Keep global loading and error fallbacks dependency-light, visibly rendered, and sized with `100dvh` so iOS WebViews never show a blank viewport.
- Treat widths below `lg` as compact navigation: hide the persistent sidebar and keep primary content available through the bottom navigation.