1. 0.3.13.16: Spec/CLI/Developer Loop Cleanup
This would finish the testing/tooling story we just improved.

I’d put here:

cosm test ... as a first-class CLI mode
make Cosm::Spec implicit inside that mode so specs can write suite, it, assert, expect_raises without the Cosm::Spec. prefix
remove the need for explicit finish()
improve --trace-core / --trace-surface so they actually feel informative
decide whether VM remains experimental-only or gets a clearer proving wedge
This is probably the highest leverage polish slice.

2. 0.3.13.17: Persistent Agent Runtime That Actually Feels Real
I agree this now needs to come back to center.

Right now we have the pieces, but not quite the experience. The next step should be:

one obvious agent entrypoint
one obvious way to run it
one obvious way to DM it and get durable replies
I’d keep Slack webhook-driven for now, not polling/scanning history yet, but make the runtime feel like a real control plane:

load/store conversation
execute one turn
persist state
emit reply
expose status
maybe add a tiny local chat harness too so we can talk to Iapetus without Slack in the loop
That would make the agent feel less like infrastructure and more like a living wedge.

3. 0.3.13.18: OO/Stdlib Deepening
This is where I’d tackle:

more mixin/inheritance/metaclass pressure
confirm metaclass chain behavior is airtight
lift more behavior into Cosm
add better functional helpers / stdlib growth
probably start a lib/ rehome for Cosm-authored code
I think your lib/agent, lib/app, lib/support instinct is good. It would:

reduce root clutter
give stdlib a natural home
make “Cosm-authored ecosystem code” feel like one layer
I would not do that rehome as a tiny side edit, though. It should be a deliberate slice.

4. 0.3.13.19: Boundary Semantics and Neurosymbolic Reliability
This is where I think Mirror/Hologram, generative casting, and ~=/~ start to belong together.

I would not rush syntax like prompt literals or barred union yet, but I do think we should stabilize the semantic substrate:

Cosm::AI.cast(...) must be reliable
schema/model validation must be predictable
failure modes must be crisp
Mirror should get clearer boundary semantics for JS/TS values
Hologram can be the more opinionated translation layer if that still feels right