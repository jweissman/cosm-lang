# Docker Interop Direction

Docker is interesting for Cosm because it is a plausible sandboxing boundary for future agent/runtime work.

The intended model is:

- do not shell out to ad hoc `docker ...` commands from ordinary Cosm code
- do not expose a raw JS Docker client directly
- instead, wrap a narrow Docker capability through the same `Mirror` / `Hologram` host-boundary model used for other host-backed objects

That means a future Docker-shaped wrapper should:

- expose readonly inspection through `Mirror`
- expose narrow read/write capability adaptation through `Cosm::Hologram`
- translate plain strings, numbers, booleans, arrays, and object-like records into ordinary Cosm values
- reject unsupported callback-heavy or streaming-heavy surfaces explicitly until the runtime is ready for them

The likely first wrapper shape would be small and capability-oriented:

- daemon/client status
- image lookup or pull status
- one-shot container create/start/stop for tightly scoped command execution
- structured result objects for exit status, stdout/stderr summary, and container metadata

What should stay out initially:

- arbitrary Docker API passthrough
- broad streaming/log-follow surfaces
- complex event subscriptions
- orchestration semantics beyond one-shot sandboxed execution

This remains a design direction, not an implemented runtime surface in `0.3.13.41`.
