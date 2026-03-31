# The Cosm Thesis

## The Idea: An Expressive Substrate for Agentic Programming

Most languages treat AI as a library concern. You call a function, get a result, and the inference is invisible to the language itself. Cosm takes a different position.

_AI inference should enter programs through explicit language operations, the same way arithmetic or method dispatch does._

Several operators carry this idea in Cosm.

- Semantic Comparator: `~=` (`Cosm::AI.semantic_compare(left, right)`) — not string equality, but semantic (e.g. "feline" ~= "cat")
- Semantic Decision: `~` (`Cosm::AI.resolve(value, options)`) — dynamic selection (e.g. `let best_match = input ~ ["cat", "dog", "car"]`)
- Arbitrary Cast: `as` (`Cosm::AI.cast(value, schema)`) — structured extraction and transformation (generalized transformative coercion, e.g. `let person = input as PersonSchema`)

All are provided as ordinary expressions, visible in the syntax.

## Demonstration Programs

### Casting

This program classifies free-text input into a structured intent, then branches on it semantically. Every step where inference enters is visible.

```cosm
require "cosm/ai"

# Declare the structured contract first.
# The schema is an ordinary value — inspectable, validatable, exportable.
data Intent
  attribute :kind, enum: ["query", "command", "feedback"]
  attribute :subject, String
end

# Free text input — could come from a user, a webhook, a form.
input = "show me all open tickets assigned to me"

# AI-guided structured extraction
parsed = input as Intent

if parsed.kind.query?
  "query for: #{parsed.subject}"
else
  "#{parsed.kind}: #{parsed.subject}"
end
```

### Tool Use

```
require "cosm/ai"
require "cosm/net/http"
tool Weather
  description "Get the current weather for a location"
  param :latitude, Float
  param :longitude, Float

  def call(options)
    resp = Net::HTTP.get("https://open-meteo.com/v1/forecast?latitude=#{options.latitude}&longitude=#{options.longitude}&current=temperature_2m,wind_speed_10m")
    data = JSON.parse(resp)
    "Current temperature: #{data['current']['temperature_2m']}°C, Wind speed: #{data['current']['wind_speed_10m']} m/s"
  rescue => e
    "Error fetching weather: #{e.message}"
  end
end

# Chat with weather
prompt = "What's the weather like in Paris right now?"
response = prompt.with(Weather).complete
puts response
```

## Enabling the Future of AI-First Programming

- `~` as a structured semantic cast operator — `let person = text ~ PersonSchema` — once `~=` is fully settled
- Tool boundaries as first-class reflective objects, since tools are just another named seam
- Agent loops written in Cosm itself, with explicit memory, explicit tool use, and visible inference points
