# Cosm Vision

## Short Version

Cosm is trying to become a small reflective language for building interactive tools in the JS universe.

The language should feel:

- pleasant and compact enough for exploratory use
- reflective enough to explain its own runtime from inside the language
- interoperable enough to live comfortably inside JS and browser/server environments
- structured enough to support real tools, not just toy scripts

## The Kind Of Thing We Want To Build

The first concrete product target should be a simple web notebook.

That notebook would let us:

- evaluate Cosm code interactively
- keep a persistent session on the server
- inspect classes, metaclasses, and runtime objects
- render structured results in a browser-friendly way
- eventually attach simple UI/dashboard primitives

This is a good target because it exercises the language in a realistic way without forcing us to design a whole web framework too early.

## Why A Notebook First

A notebook naturally pressures the right parts of the language/runtime:

- inspect/print/stdio
- persistent environments
- module and namespace organization
- object reflection
- host interop
- testability

It also gives us a place to try later ideas like:

- dashboard widgets
- server/browser synchronization
- query/data views
- LLM-assisted transforms

## Runtime Principles

The runtime should gradually move toward these principles:

1. Core behavior should live on real runtime objects where possible.
2. The interpreter should increasingly orchestrate sends and control flow, not own every primitive behavior directly.
3. Reflection should be honest enough that the runtime can describe itself from inside Cosm.
4. Ambient services should live on named reflective objects like `Kernel`, not as scattered globals.
5. Host interop should come through a visible reflective boundary, not ad hoc escape hatches.

## Big Capability Tracks

### 1. Reflective Core

- classes, inheritance, metaclasses
- instance/class-side dispatch
- delegation and wrapper-style objects
- mirrors and hologram-like readonly/presenter objects later

### 2. Standard Surface

- `Kernel`
- inspect/print/stdio
- math/random/time/process-ish helpers
- namespaces/modules
- test harnesses

### 3. Host Boundary

- JS mirrors
- value conversion rules
- browser/server bridges
- HTTP and filesystem services

### 4. Interactive Platform

- notebook runtime
- dashboard/UI primitives
- query/data tools
- later LLM-oriented transforms

## What We Do Not Need Yet

- a full VM before the runtime semantics settle
- a large web framework before inspect/session/module/interop basics exist
- too much surface sugar before the core execution model is stable

## Current Design Pressure

Right now the most important work is:

- shrinking interpreter-owned primitive behavior
- clarifying dispatch ownership
- continuing to harden metaclass and reflective semantics
- growing `Kernel` and `cosm` into a real standard surface

That is the shortest path toward a notebook worth using.
