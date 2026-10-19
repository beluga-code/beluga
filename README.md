# Beluga

Beluga is a small launcher for the open-source [Levanter WhatsApp bot](https://github.com/lyfe00011/levanter). The bot's AI character is **Geogia**, created by **Beluga**. On first start the launcher downloads Levanter, installs its dependencies, writes a private session configuration, and creates the local bridge and selected sticker files.

## Put these two files on your server

- package.json
- index.js

Start with npm start (or node index.js). The server needs Node.js 20 or newer, Git, Yarn 1.22.22, FFmpeg, network access, and persistent disk space for Levanter and its dependencies. The selected Pepe and suited-man stickers are embedded in index.js, so you do not need to upload a sticker folder.

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
- PREFIX, SUDO, BOT_LANG, LANGUAG, and other Levanter settings supported in index.js.

## How Geogia replies

In direct messages, Geogia answers normal text messages. In groups, she responds only when a message contains the name Geogia or the common spelling Georgia. She quotes that message and uses WhatsApp's mention metadata to tag the person who addressed her. The per-chat cooldown and message-fragment delay apply to groups too.

Geogia uses Nigerian English or Pidgin based on the other person's style. Her default prompt includes “hwfar boss”, “no vex na”, and “oya e don do” as occasional phrases, not lines to force into every reply. The app does not add fake mistakes to imitate a person.

The model may select one sticker when it suits the moment: a Pepe reaction for harmless playful bait or teasing, or the suited man with glasses for dry disbelief or a mock-serious pause. It chooses no sticker most of the time. Those two selected assets are embedded in index.js; the rest of the uploaded pack is not part of the runtime.

Game commands are not included yet. Levanter continues to handle its own prefixed commands.

## Memory and Groq data

Recent AI conversation context stays in server memory and is discarded when the process restarts. A temporary Levanter cache holds plain-text message contexts for up to 10 minutes (maximum 500) so Geogia can quote an incoming message and create a real mention. Group entries are limited to messages naming Geogia or Georgia. The cache is not written to disk. Beluga does not save chat transcripts. Saved notes are off by default in direct messages. A contact can use .beluga learn on to opt in, then .beluga remember <note> or say “remember that <note>”. Use .beluga learn off to stop using notes, .beluga forget to delete notes, or .beluga clear to delete notes and temporary context. These controls are for direct messages; groups do not save memory notes. App memory does not train the model.

Direct-message text and up to eight recent context messages are sent to Groq for AI replies. In a group, a message is sent to Groq only when it contains Geogia or Georgia; up to eight recent context messages from that group may also be included. Opted-in direct-message notes are sent only in that direct-message chat. The default model is openai/gpt-oss-20b. Groq says inference inputs and outputs are not retained by default, but may be temporarily logged for reliability or abuse investigations for up to 30 days; Zero Data Retention is available in Groq's data controls. See [Groq data handling](https://console.groq.com/docs/your-data).

Groq's published free-plan summary currently lists 1000 requests per day for openai/gpt-oss-20b. Account-specific limits and provider limits can differ or change; Beluga's default app cap is 150 per UTC day. See [Groq rate limits](https://console.groq.com/docs/rate-limits).

## Repository notes

The Levanter checkout, generated session configuration, saved notes, and installed dependencies are ignored by Git. This repository contains the Beluga launcher, not a copy of Levanter's source. BELUGA_PROMPT.md is a readable copy of the default AI prompt; it is not required on the server.
