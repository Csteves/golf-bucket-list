// Fork-agnostic comedy-engine instructions. Persona/branding specifics come from
// `context` (client-supplied per request, sourced from that fork's CONFIG) instead
// of being hardcoded here — this is what lets a fork run without touching worker code.
function buildSystemPrompt(context) {
  const title = context?.branding?.title || "the tour";
  const tagline = context?.branding?.tagline || "";
  const members = Array.isArray(context?.members) ? context.members : [];

  const charactersBlock = members.length
    ? members.map((m, i) => `${i + 1}. ${m.character}\n${m.persona || ""}`).join("\n\n")
    : "No characters were provided for this request — write in a generic golf-bro comedy voice without inventing named personas.";

  return `You are the official comedy caddie and copywriter for ${title}.

${title} is a shared golf bucket list for a friend group built around recurring golf alter-egos, inside jokes, bad decisions, and unfinished business.${tagline ? `\n\nTagline: ${tagline}` : ""}

Your job is to help generate funny course notes, status blurbs, character-specific lines, and bucket-list copy when a new course is added.

Tone:
- Adult-humored, sarcastic, cinematic, golf-bro comedy.
- Funny but polished.
- Dark humor is allowed, but keep it playful.
- Avoid anything truly cruel, hateful, graphic, or mean-spirited.
- The humor should sound like a dramatic trailer, fake sports documentary, or group-chat roast.
- Keep most lines short enough to fit on a webpage card.

Main characters:

${charactersBlock}

When generating a course line:
Ask for or infer:
- Course name
- Location
- Status: Completed, Next trip, Bucket item, or Proposed
- Character/person who added it
- Why they added it, if known
- Any course feature: water, rough, bunkers, elevation, island green, desert, trees, prestige, difficulty, etc.

Destination-first rule:
Every line must be tailored to this specific course, not just the character. Pull in the course name, location, or a real feature (terrain, water, prestige, difficulty, reputation) and fuse it with the character's angle. A line that would work unchanged for a different course at the same status is not acceptable — rewrite it so it could only be describing this destination. Character brand lines are seasoning, not the whole joke; don't just paste a stock line and swap the course name in around it.

Output format:
Provide 5 options:
1. Best default line
2. More adult-humored line
3. Cinematic trailer-style line
4. Character-specific roast line
5. Short webpage-card line

Each option should be one sentence unless the user asks for more, and each must reference the destination per the rule above.

Always associate the line with the character who added it. If the user gives the real person but not the alter ego, ask which identity to use.

Do not over-explain unless asked. The user usually wants usable lines fast.`;
}

const PLANNING_SYSTEM_PROMPT = `You are a practical golf-trip planning assistant. Given a golf course or resort name (and its location, if given), use web search to find durable, non-time-sensitive trip-planning information that golfers commonly report:

- How far in advance you typically need to book (tee times, resort stays, permits, lotteries)
- Best months/season to play
- How the reservation/access system works (public access, resort-guest priority, membership required, lottery, waitlist, etc.)
- A rough price tier only (budget / mid-range / premium) — never state exact dollar figures, since they change too fast to be reliable
- Any standout logistical tips (stay-and-play packages, walking-only policy, weather patterns to avoid, dress code quirks)

Write 4-6 short, plain, factual bullet points, one per line, each starting with "- ", and nothing else. Write in plain sentences with no markdown formatting (no bold, no inline links, no citation parentheticals like "(site.com)"). Do not add a "Sources" section, a references list, an intro sentence, or a closing offer to help further — the app shows sources separately, so output ONLY the bullet points themselves. No jokes, no character voice — just useful planning information a golfer could act on before booking a trip. If you can't find reliable information on a point, omit it rather than guessing.`;

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Fork-Token",
  };
  if (origin === allowedOrigin) headers["Access-Control-Allow-Origin"] = allowedOrigin;
  return headers;
}

function forbidden(origin, allowedOrigin, message) {
  return new Response(JSON.stringify({ error: message || "Forbidden" }), {
    status: 403,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin, allowedOrigin) },
  });
}

// Origin + X-Fork-Token are both visible/spoofable to a non-browser client (the
// token ships in the served page) — this deters casual/scripted abuse of the
// worker directly, not a targeted attacker. Real budget protection is the
// Cloudflare rate-limit rule on this route (set in the dashboard).
function guard(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (origin !== env.SITE_ORIGIN) return true;
  if (request.headers.get("X-Fork-Token") !== env.FORK_TOKEN) return true;
  return false;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const message = (data.output || []).find((item) => item.type === "message");
  const part = message?.content?.find((c) => c.type === "output_text");
  return part?.text || "";
}

function extractTextAndCitations(data) {
  const message = (data.output || []).find((item) => item.type === "message");
  const part = message?.content?.find((c) => c.type === "output_text");
  if (!part) return { text: "", citations: [] };

  const annotations = (part.annotations || []).filter(
    (a) => a.type === "url_citation" && typeof a.start_index === "number" && typeof a.end_index === "number"
  );

  let text = part.text || "";
  const sortedDesc = [...annotations].sort((a, b) => b.start_index - a.start_index);
  for (const a of sortedDesc) {
    text = text.slice(0, a.start_index) + text.slice(a.end_index);
  }
  text = text
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\*\*/g, "")
    .replace(/\n(?:sources?|references?):?[\s\S]*$/i, "")
    .trim();
  text = text
    .split("\n")
    .filter((line) => line.trim().startsWith("-"))
    .join("\n");

  const seen = new Set();
  const citations = [];
  for (const a of annotations) {
    if (!seen.has(a.url)) {
      seen.add(a.url);
      citations.push({ url: a.url, title: a.title || a.url });
    }
  }
  return { text, citations };
}

function notifySubjectAndText(body) {
  if (body?.type === "new_course") {
    const { courseName, status, addedBy } = body;
    return {
      subject: `New bucket-list add: ${courseName}`,
      text: `${addedBy || "Someone"} just added "${courseName}" (${status || "Bucket item"}) to the No Handicap Tour list.`,
    };
  }
  if (body?.type === "new_vote") {
    const { courseName, voter } = body;
    return {
      subject: `New vote: ${courseName}`,
      text: `${voter || "Someone"} just voted for "${courseName}" on the No Handicap Tour list.`,
    };
  }
  if (body?.type === "new_comment") {
    const { courseName, author, text } = body;
    return {
      subject: `New comment on ${courseName}`,
      text: `${author || "Someone"} commented on "${courseName}":\n\n${text || ""}`,
    };
  }
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin, env.SITE_ORIGIN) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin, env.SITE_ORIGIN) });
    }

    if (guard(request, env)) {
      return forbidden(origin, env.SITE_ORIGIN);
    }

    if (url.pathname === "/notify") {
      let notifyBody;
      try {
        notifyBody = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      }

      const msg = notifySubjectAndText(notifyBody);
      if (!msg) {
        return new Response(JSON.stringify({ error: "Unknown notify type" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      }

      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: env.NOTIFY_FROM,
            to: [env.NOTIFY_TO],
            subject: msg.subject,
            text: msg.text,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return new Response(JSON.stringify({ error: `Resend error: ${errText}` }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
      });
    }

    if (body?.mode === "planning_tips") {
      const { courseName, location } = body || {};
      if (!courseName) {
        return new Response(JSON.stringify({ error: "courseName is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      }

      // First-time trip-info generation (triggered automatically when a course is
      // added) stays open to any member, same as today. Only an explicit *regenerate*
      // — repeatable on demand, unlike the one-time auto-generation — costs a web
      // search plus two OpenAI calls per click, so that path alone requires the
      // manager token. Client-supplied `regenerate` is trust-on-the-client (same
      // model as the fork token above); the token match is the actual gate.
      if (body.regenerate && request.headers.get("X-Manager-Token") !== env.MANAGER_TOKEN) {
        return forbidden(origin, env.SITE_ORIGIN, "Manager code required or incorrect");
      }

      const userMessage = [`Course/resort: ${courseName}`, location && `Location: ${location}`]
        .filter(Boolean)
        .join("\n");

      try {
        const resp = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            tools: [{ type: "web_search" }],
            input: [
              { role: "system", content: PLANNING_SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          return new Response(JSON.stringify({ error: `OpenAI error: ${errText}` }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
          });
        }

        const data = await resp.json();
        const { text, citations } = extractTextAndCitations(data);

        let caddieTake = "";
        if (text) {
          try {
            const takeResp = await fetch("https://api.openai.com/v1/responses", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                input: [
                  { role: "system", content: buildSystemPrompt(body.context) },
                  {
                    role: "user",
                    content: [
                      `Task: In your established comedic voice as the group's caddie, distill the trip-planning facts below into a short, funny take (1-2 sentences, max ~55 words) — the practical gist (booking lead time, price vibe, hassle level, standout logistics) delivered in your comedic golf-bro style. This is a fun addendum to the serious info above it, not a replacement, so don't try to restate every bullet — just hit the 2-3 things that matter most before someone commits to a trip.`,
                      `Return ONLY the line itself. No quotes, no numbering, no extra commentary.`,
                      ``,
                      `Course: ${courseName}`,
                      ``,
                      `Facts:`,
                      text,
                    ].join("\n"),
                  },
                ],
              }),
            });
            if (takeResp.ok) {
              const takeData = await takeResp.json();
              caddieTake = extractOutputText(takeData).trim();
            }
          } catch {
            // Caddie take is a nice-to-have — the factual bullets stand on their own.
          }
        }

        return new Response(JSON.stringify({ text, citations, caddieTake }), {
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      }
    }

    const mode = body?.mode === "vibe" ? "vibe" : "generate_line";

    let userMessage;
    if (mode === "vibe") {
      const { courseName, rawDescription } = body || {};
      if (!courseName || !rawDescription) {
        return new Response(JSON.stringify({ error: "courseName and rawDescription are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      }
      userMessage = [
        `Task: distill real information about "${courseName}" into a short "course vibe" phrase (8-15 words) capturing terrain, difficulty, prestige, or standout features — written in your voice as the Caddie, not encyclopedic.`,
        `Return ONLY the phrase itself. No quotes, no numbering, no extra commentary.`,
        ``,
        `Source info: ${rawDescription}`,
      ].join("\n");
    } else {
      const { courseName, location, status, addedBy, whyAdded, features } = body || {};
      if (!courseName || !status) {
        return new Response(JSON.stringify({ error: "courseName and status are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      }
      userMessage = [
        `Course name: ${courseName}`,
        location && `Location: ${location}`,
        `Status: ${status}`,
        addedBy && `Added by: ${addedBy}`,
        whyAdded && `Why they added it: ${whyAdded}`,
        features && `Course features: ${features}`,
      ]
        .filter(Boolean)
        .join("\n");
    }

    try {
      const resp = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: [
            { role: "system", content: buildSystemPrompt(body.context) },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return new Response(JSON.stringify({ error: `OpenAI error: ${errText}` }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
        });
      }

      const data = await resp.json();
      const text = extractOutputText(data);

      return new Response(JSON.stringify({ text }), {
        headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin, env.SITE_ORIGIN) },
      });
    }
  },
};
