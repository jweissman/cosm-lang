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


---

0.3.13.20: Message-Native Agent Memory

stop flattening the whole conversation into one big user prompt
keep durable history as structured role-based messages
feed the model a real message list: system + prior turns + latest turn
preserve richer typed turn/result objects in runtime/store
keep no tool execution yet
0.3.13.21: Enumerable/Stdlib OO Lift

turn cosm/enumerable.cosm into a real Enumerable module
explicitly mix it into Array/Hash
lift more collection behavior into Cosm
simplify one-line defs and make maintained Cosm code read more idiomatically
0.3.13.22: Tool-Ready Inner Loop

introduce typed tool-call / tool-result records in the runtime
keep tool execution minimal at first
make the agent turn contract naturally ready for “think -> choose -> reply”
probably still single-turn, synchronous
0.3.13.23: Boundary/Interop Deepening

clarify Mirror further on host-backed values
decide what Hologram actually is
start a real host-value translation story if the runtime is ready

---

0.3.13.21: Useful Slack Agent

support channel/mention-driven ingress in addition to DM
configurable allowed channel or channels
thread-based durable conversation in channels
cleaner server logs/status
probably switch Kernel.puts boot logging to ordinary puts

0.3.13.22: First Real Tools

introduce a tiny tool contract
start with very practical tools only:
web search
fetch/open page
maybe screenshot/image capture
no complex planner yet, just one-turn “decide -> maybe use tool -> reply”

0.3.13.23: Better Persistence

introduce a real store boundary
likely move from ad hoc JSON files toward SQLite
keep the message-native conversation model
make replay/status/debug much easier
0.3.13.24: More Expressive Inner Loop

richer typed turn records
tool-call / tool-result messages as first-class history
better prompt/policy modules
maybe start making the agent loop itself more Cosm-authored and expressive

0.3.13.25: Language/Wedge Lift Together

more stdlib lifting
real Enumerable mixin/module
cleaner base classes and mixin use
perhaps a lightweight record/model pattern if persistence has stabilized
