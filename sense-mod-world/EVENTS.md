# Sense Mod World events

Edit [events.json](https://github.com/lc6382/kin-observatory-site/edit/main/sense-mod-world/events.json) while signed in to your GitHub account. Only accounts with repository write access can save changes. The public site cannot add or change events. The collector updates history.json only and preserves this file.

Start with this format (example only):

```json
[
  {
    "at": "2026-09-06T17:00:00-07:00",
    "label": "Advertising campaign",
    "type": "advertising",
    "notes": "Optional description."
  }
]
```

Use your event's actual date/time with an explicit UTC offset. Pacific daylight time uses -07:00; Pacific standard time uses -08:00. `type` is advertising, model, update, or other. `label` and `at` are required; notes and type are optional. Multiple objects are separated with commas; don't add a comma after the last object. Keep notes suitable for public viewing. Commit to main and allow GitHub Pages a minute to publish, then refresh the page.

Markers appear within the selected chart range. All events remain in the timeline even if outside the chart range. An invalid event is omitted with a visible warning; invalid JSON shows an error rather than pretending the timeline is empty. To remove an event, delete its object and adjust commas; to clear all events restore `[]`.
