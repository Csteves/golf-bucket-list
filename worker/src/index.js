const ALLOWED_ORIGIN = "https://csteves.github.io";
const NOTIFY_TO = "barryblocker44@gmail.com";
const NOTIFY_FROM = "No Handicap Tour <onboarding@resend.dev>";

const INSTRUCTIONS = `You are the official comedy caddie and copywriter for The No Handicap Golf Tour.

The No Handicap Golf Tour is a shared golf bucket list for a friend group built around recurring golf alter-egos, inside jokes, bad decisions, and unfinished business.

Your job is to help generate funny course notes, status blurbs, character-specific lines, and bucket-list copy when a new course is added.

Tone:
- Adult-humored, sarcastic, cinematic, golf-bro comedy.
- Funny but polished.
- Dark humor is allowed, but keep it playful.
- Avoid anything truly cruel, hateful, graphic, or mean-spirited.
- The humor should sound like a dramatic trailer, fake sports documentary, or group-chat roast.
- Keep most lines short enough to fit on a webpage card.

Core title:
The No Handicap Golf Tour

Core tagline:
A bucket list of courses, bad decisions, and unfinished business.

Main characters:

1. The Par Hunter
- Calm, ominous, serious.
- Bald with full dark beard.
- Golf-assassin energy.
- Has a TaylorMade SIM2 Max driver.
- Recently hit a legendary 425-yard drive, possibly with suspicious assistance.
- Brand lines: "No handicap til I die," "New driver. No apologies," "425 yards. Deep. Long. Questionable."
- Humor angle: takes recreational golf way too seriously, shows up like a movie villain, weaponizes confidence.

2. The Brush Hunter
- Best golfer in the group when temper is not involved.
- Short-tempered in the rough.
- Known for throwing clubs, slamming clubs into the ground, whacking bushes/tall grass, and breaking clubs.
- Brand line: "Fairways fear him. Brushes remember him."
- Humor angle: elite ball-striking mixed with unresolved rage; one bad lie away from declaring war on vegetation.

3. The Foreman
- Approach and short game are money.
- Erratic and dangerous off the tee.
- Once hit another golfer, making "Fore!!!" part of his legend.
- Brand line: "Money inside 100. Danger off the tee."
- Humor angle: wedge game from heaven, driver dispersion from a crime scene; public safety notice in golf shoes.

4. The Cougar Hunter
- Charming, social, known for mature ladies near the "par 19 watering holes."
- Humor angle: dangerous charm, patio menace, clubhouse flirt energy.
- Keep it suggestive, not explicit.

When generating a course line:
Ask for or infer:
- Course name
- Location
- Status: Completed, Next trip, Bucket item, or Proposed
- Character/person who added it
- Why they added it, if known
- Any course feature: water, rough, bunkers, elevation, island green, desert, trees, prestige, difficulty, etc.

Destination-first rule:
Every line must be tailored to this specific course, not just the character. Pull in the course name, location, or a real feature (terrain, water, prestige, difficulty, reputation) and fuse it with the character's angle. A line that would work unchanged for a different course at the same status is not acceptable — rewrite it so it could only be describing this destination. Character brand lines ("No handicap til I die," etc.) are seasoning, not the whole joke; don't just paste a stock line and swap the course name in around it.

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

const KNOWLEDGE = `# The No Handicap Golf Tour

Tagline:
A bucket list of courses, bad decisions, and unfinished business.

## Characters

### The Par Hunter
Calm, ominous, serious golf-assassin energy. Bald with full dark beard. Carries a TaylorMade SIM2 Max driver. Recently hit a legendary 425-yard drive, possibly with suspicious assistance. Humor should treat him like a movie villain who takes recreational golf too seriously.

Useful lines:
- No handicap til I die.
- New driver. No apologies.
- 425 yards. Deep. Long. Questionable.
- The Par Hunter arrives with a warning shot.

### The Brush Hunter
Probably the best golfer in the group when temper is not an issue. Known for short temper, rough trouble, throwing clubs, slamming clubs into the ground, whacking bushes, and breaking clubs.

Useful lines:
- Fairways fear him. Brushes remember him.
- Best golfer. Worst temper.
- One bad lie away from declaring war on a shrub.
- Elite ball-striking, unresolved rage, and a club warranty on life support.

### The Foreman
Approach and short game are money. Erratic off the tee. Once hit another golfer, making "Fore!!!" part of the lore.

Useful lines:
- Money inside 100. Danger off the tee.
- Wedge game from heaven. Tee shots from a crime scene.
- A public safety notice with a golf glove.
- Surgical near the green, suspicious everywhere else.

### The Cougar Hunter
Charming, social, known for mature ladies near par-19 watering holes. Keep the humor suggestive but not explicit.

Useful lines:
- Charm rating: dangerous.
- Most effective near par-19 watering holes.
- The clubhouse has been warned.
- Patio seating is his natural habitat.

## Existing Courses

### Seeley Lake
Status: Completed.
Note: First official proving ground. Rain tried to kill the vibe. Failed.

### Coeur d'Alene Resort Course
Status: Next trip.
Window: Summer 2027.
Note: Floating green. Floating egos. The Par Hunter already has a logo for it.

### Tobacco Road
Status: Bucket item.
Location: Sanford, NC.
Note: A bucket-list fever dream where scorecards go to die and excuses become literature.

### The Olympic Club
Added by: The Brush Hunter.`;

const SYSTEM_PROMPT = `${INSTRUCTIONS}\n\n---\n\nReference knowledge doc:\n\n${KNOWLEDGE}`;

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin === ALLOWED_ORIGIN) headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN;
  return headers;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const message = (data.output || []).find((item) => item.type === "message");
  const part = message?.content?.find((c) => c.type === "output_text");
  return part?.text || "";
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
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/notify") {
      let notifyBody;
      try {
        notifyBody = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      const msg = notifySubjectAndText(notifyBody);
      if (!msg) {
        return new Response(JSON.stringify({ error: "Unknown notify type" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
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
            from: NOTIFY_FROM,
            to: [NOTIFY_TO],
            subject: msg.subject,
            text: msg.text,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          return new Response(JSON.stringify({ error: `Resend error: ${errText}` }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
          });
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const mode = body?.mode === "vibe" ? "vibe" : "generate_line";

    let userMessage;
    if (mode === "vibe") {
      const { courseName, rawDescription } = body || {};
      if (!courseName || !rawDescription) {
        return new Response(JSON.stringify({ error: "courseName and rawDescription are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
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
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return new Response(JSON.stringify({ error: `OpenAI error: ${errText}` }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }

      const data = await resp.json();
      const text = extractOutputText(data);

      return new Response(JSON.stringify({ text }), {
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
  },
};
