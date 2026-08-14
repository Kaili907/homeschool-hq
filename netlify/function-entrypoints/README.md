# Netlify function entrypoints

This directory is the complete callable production-function allowlist.

Each JavaScript file delegates to one production handler in `../functions`.
Production modules, tests, fixtures, resolvers, and other helpers must stay
outside this directory so Netlify does not discover them as independent
functions.
