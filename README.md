# Beluga

Beluga is a small launcher for the open-source [Levanter WhatsApp bot](https://github.com/lyfe00011/levanter). The bot's AI character is **Geogia**, created by **Beluga**. On first start the launcher downloads Levanter, installs its dependencies, writes a private session configuration, copies the tracked plugin and media files into Levanter, and creates the local bridge.

## Put these files on your server

- package.json
- index.js
- the complete `plugins/` folder
- the complete `media/` folder

Start with npm start (or node index.js). The server needs Node.js 20 or newer, Git, Yarn 1.22.22, FFmpeg, network access, and persistent disk space for Levanter and its dependencies. The tracked `plugins/` folder contains Beluga's Levanter bridge plugin. The `media/` folder contains the menu banner, all 52 WebP stickers from the supplied pack, and their catalog. Each startup copies the plugin into `levanter/plugins/` and the media files without encoding into `levanter/beluga-media/`.

## Required private server settings

- BELUGA_SESSION_ID: your Levanter session string.
- GROQ_API_KEY: your Groq API key.

Keep these values in the server's private environment settings, never in the source files or a public repository. The launcher writes its Levanter session configuration with restrictive file permissions and does not print the secrets.

## Optional settings

- BELUGA_PERSONALITY: replace Geogia's starter prompt. Keep the JSON reply contract described in BELUGA_PROMPT.md.
- BELUGA_GROQ_MODEL: Groq model ID; defaults to openai/gpt-oss-20b.
- BELUGA_DEBOUNCE_MS: combine message fragments before answering; defaults to 4000 ms.
- BELUGA_COOLDOWN_MS: minimum spacing between AI replies in each chat; defaults to 15000 ms.
- BELUGA_DAILY_AI_LIMIT: app-level request cap; defaults to 150 per UTC day and is capped at 900.
- BELUGA_AUTO_REACT: set to `false` to turn off casual automatic group reactions; enabled by default.
- PREFIX, SUDO, BOT_LANG, LANGUAG, and other Levanter settings supported in index.js.

## How Geogia replies

In direct messages, Geogia answers normal text messages. In groups, she responds only when a message contains the name Geogia or the common spelling Georgia. She quotes that message and uses WhatsApp's mention metadata to tag the person who addressed her. The per-chat cooldown and message-fragment delay apply to groups too.

Geogia uses Nigerian English or Pidgin based on the other person's style. Her default prompt includes “hwfar boss”, “no vex na”, and “oya e don do” as occasional phrases, not lines to force into every reply. The app does not add fake mistakes to imitate a person.

Geogia can choose from all 52 stickers using their visual descriptions in `media/stickers/catalog.json`. Her favorites for harmless baiting include smug Pepe, Vegeta, Ronaldo, and playful reaction stickers; the glasses-wearing man is a favorite for mock-serious pauses. She rotates choices and usually sends no sticker. The final `.warn` uses a Pepe sticker before attempting removal. The pack images are regular files copied into `levanter/beluga-media/` at startup.

## Public commands and reactions

Beluga is public in WhatsApp groups, with a small command allowlist: `.menu` / `.help`, `.list`, `.ping`, `.alive`, `.geogia`, `.games`, `.react`, `.reaction`, `.warn`, `.geogiasimp`, and `.blanc`. The menu displays the supplied Geogia banner. The reaction commands apply an emoji to a message you reply to. All other Levanter built-in plugins and external plugins, including Levanter’s default menu and warning handler, are moved out of its active plugin folders on startup into `levanter/beluga-disabled-plugins`.

Geogia also makes occasional low-frequency group reactions: roughly one in ten ordinary text messages, with at least 45 seconds between reactions in the same group. Commands and messages that mention Geogia are skipped. Set `BELUGA_AUTO_REACT=false` to disable these automatic reactions while keeping `.react` and `.reaction` available.

The `.games` command is a placeholder for the games section; game commands are not implemented yet. The command menu separates AI, reactions, games, moderation, and basic status commands. The small public set is inspired by common utility commands in [Queen Anita V4](https://github.com/DavidCyrilTech/Anita-V4), which is MIT-licensed; Beluga’s handlers are written for Levanter. Levanter’s own `.react` plugin supplies quoted-message reactions.

### Special people and warnings

In a group, a group admin/mod or a phone number configured in `SUDO` can use `.geogiasimp add @member` to set extra warm, playful AI behavior for that member in that group. Add `blanc` to register Blanc’s debate-loving profile: `.geogiasimp add @Blanc blanc`. He can use `.blanc` for a dedicated debate-and-glaze line. Use `.geogiasimp remove @member` or `.geogiasimp list` to manage or review the list. These settings are saved in `beluga-data/special-people.json` on the server.

Only a group admin/mod or the configured `SUDO` owner can issue `.warn @member`; `.warn reset @member` clears their warning count. The number prefix is used as a rough language choice: `+234` numbers get the Nigerian Pidgin warning and final “toor dem warn u sha”; other prefixes get English and “byee gng”. A country prefix is only a heuristic and may not match a person’s preferred language. The warning limit defaults to `WARN_LIMIT` from Levanter settings (usually three); on the next warning, Beluga sends the final message and Pepe sticker `sticker-052`, then removes the member if Beluga is a group admin. Admin targets cannot be warned or kicked by this command.

When adding a game later, add its Levanter plugin filename to `ALLOWED_LEVANTER_PLUGINS` near the top of `index.js`; the launcher restores that plugin from its disabled folder on restart. External plugins remain disabled unless the launcher allowlist is deliberately changed.

## Memory and Groq data

Recent AI conversation context stays in server memory and is discarded when the process restarts. A temporary Levanter cache holds plain-text message contexts for up to 10 minutes (maximum 500) so Geogia can quote an incoming message and create a real mention. Group entries are limited to messages naming Geogia or Georgia. The cache is not written to disk. Beluga does not save chat transcripts. Saved notes are off by default in direct messages. A contact can use .beluga learn on to opt in, then .beluga remember <note> or say “remember that <note>”. Use .beluga learn off to stop using notes, .beluga forget to delete notes, or .beluga clear to delete notes and temporary context. These controls are for direct messages; groups do not save memory notes. App memory does not train the model.

Direct-message text and up to eight recent context messages are sent to Groq for AI replies. In a group, a message is sent to Groq only when it contains Geogia or Georgia; up to eight recent context messages from that group may also be included. Opted-in direct-message notes are sent only in that direct-message chat. The default model is openai/gpt-oss-20b. Groq says inference inputs and outputs are not retained by default, but may be temporarily logged for reliability or abuse investigations for up to 30 days; Zero Data Retention is available in Groq's data controls. See [Groq data handling](https://console.groq.com/docs/your-data).

Groq's published free-plan summary currently lists 1000 requests per day for openai/gpt-oss-20b. Account-specific limits and provider limits can differ or change; Beluga's default app cap is 150 per UTC day. See [Groq rate limits](https://console.groq.com/docs/rate-limits).

## Repository notes

The Levanter checkout, generated session configuration, saved notes, and installed dependencies are ignored by Git. This repository contains the Beluga launcher, not a copy of Levanter's source. BELUGA_PROMPT.md is a readable copy of the default AI prompt; it is not required on the server.
