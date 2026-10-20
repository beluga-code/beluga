'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { bot, setWarn, jidToNum, isAdmin, deleteWarn } = require('../lib')

const bridgePort = Number(process.env.BELUGA_BRIDGE_PORT)
const bridgeToken = process.env.BELUGA_BRIDGE_TOKEN || ''
const mediaDirectory = path.join(__dirname, '..', 'beluga-media')
const menuBannerPath = path.join(mediaDirectory, 'menu-banner.jpg')
const specialPeoplePath = path.join(__dirname, '..', '..', 'beluga-data', 'special-people.json')
const recentMessages = new Map()
const MAX_MESSAGES = 500
const MESSAGE_TTL_MS = 10 * 60 * 1000
const AUTO_REACT_ENABLED = process.env.BELUGA_AUTO_REACT !== 'false'
const AUTO_REACT_CHANCE = 0.1
const AUTO_REACT_COOLDOWN_MS = 45 * 1000
const autoReactAt = new Map()
const AUTO_REACTIONS = ['😂', '😭', '👀', '🤝', '❤️']

function rememberMessage(message) {
  const id = typeof message.id === 'string' ? message.id : ''
  const jid = typeof message.jid === 'string' ? message.jid : ''
  if (!id || !jid || typeof message.text !== 'string') return
  const isGroup = message.isGroup === true || jid.endsWith('@g.us')
  const text = message.text.trim()
  if (isGroup && !/\b(?:geogia|georgia)\b/i.test(text)) return
  if (!isGroup && (/^[.,!]/.test(text) || /^remember that\s/i.test(text))) return

  const now = Date.now()
  for (const [key, item] of recentMessages) {
    if (item.expiresAt <= now) recentMessages.delete(key)
  }
  if (recentMessages.size >= MAX_MESSAGES) {
    recentMessages.delete(recentMessages.keys().next().value)
  }
  const sender = message.sender || message.data?.key?.participant || jid
  recentMessages.set(id, {
    message,
    sender,
    isGroup,
    expiresAt: now + MESSAGE_TTL_MS,
  })
}

// Levanter exposes its normal incoming text event to plugins. The short-lived
// cache lets the launcher reply with Levanter's native quote, mention, and sticker APIs.
bot({ on: 'text', fromMe: false, type: 'filterOrLydia' }, rememberMessage)

async function maybeReactToGroupMessage(message) {
  if (!AUTO_REACT_ENABLED) return
  const jid = typeof message.jid === 'string' ? message.jid : ''
  const text = typeof message.text === 'string' ? message.text.trim() : ''
  if (!jid.endsWith('@g.us') || !text || /^[.,!]/.test(text)) return
  if (/\b(?:geogia|georgia)\b/i.test(text) || Math.random() >= AUTO_REACT_CHANCE) return

  const now = Date.now()
  if (now - (autoReactAt.get(jid) || 0) < AUTO_REACT_COOLDOWN_MS) return
  const key = message.data?.key
  if (!key) return

  autoReactAt.set(jid, now)
  try {
    const reaction = AUTO_REACTIONS[Math.floor(Math.random() * AUTO_REACTIONS.length)]
    await message.send({ text: reaction, key }, {}, 'react')
  } catch (error) {
    console.error('[Beluga] Could not add a casual group reaction (' + error.message + ').')
  }
}

bot({ on: 'text', fromMe: false, type: 'belugaAutoReact' }, maybeReactToGroupMessage)

bot(
  { pattern: 'geogia ?(.*)', desc: 'Show Geogia AI details and help', type: 'ai' },
  async (message) => {
    return message.send(
      '🐋 *Geogia AI*\n' +
      'I’m the female-presenting AI created by Beluga and running through the Beluga bot. ' +
      'In groups, mention Geogia when you want me to join. Use .menu to see the available commands.'
    )
  }
)

bot(
  { pattern: 'alive ?(.*)', desc: 'Check whether Beluga is online', type: 'misc' },
  async (message) => message.send('🐋 Geogia is here, boss. Beluga bot is online and listening.')
)

bot(
  { pattern: 'games ?(.*)', desc: 'Show the games section', type: 'games' },
  async (message) =>
    message.send('🎮 *Beluga Games*\nThe games section is ready, but game commands are still being built. Check back later.')
)

bot(
  { pattern: 'reaction ?(.*)', desc: 'React to a quoted message', type: 'reactions' },
  async (message, match) => {
    const emoji = typeof match === 'string' ? match.trim() : ''
    if (!message.reply_message?.key) {
      return message.send('Reply to a message with an emoji, then use .reaction 😂')
    }
    if (!emoji || emoji.length > 16) return message.send('Add one emoji, for example: .reaction 😂')
    return message.send({ text: emoji, key: message.reply_message.key }, {}, 'react')
  }
)

const MENU_CAPTION =
  '🐋 *BELUGA BOT — GEOGIA AI*\n' +
  'Created by Beluga • powered by Levanter\n\n' +
  '🤖 *AI*\n' +
  '• Mention *Geogia* in a group to chat\n' +
  '• .geogia — about Geogia\n' +
  '• .beluga help — AI, cooldown and memory controls (DM)\n\n' +
  '✨ *CHAT & REACTIONS*\n' +
  '• .reaction 😂 — reply to a message first\n' +
  '• .react — Levanter reaction command\n\n' +
  '🛡️ *GROUP MODERATION*\n' +
  '• .warn @member — admin/mod warning; repeated warnings can remove them\n' +
  '• .warn reset @member — clear that member’s warning count\n' +
  '• .geogiasimp add @member [blanc] — designate a special person (admin/mod)\n' +
  '• .geogiasimp remove @member — remove the designation\n' +
  '• .geogiasimp list — list designated people\n' +
  '• .blanc — Blanc’s debate-flavoured glaze command\n\n' +
  '🎮 .games — games are coming later\n' +
  'Use .help or .list to see this menu.'

async function sendMenu(message) {
  try {
    const banner = fs.readFileSync(menuBannerPath)
    return await message.send(banner, { caption: MENU_CAPTION, mimetype: 'image/jpeg' }, 'image')
  } catch (error) {
    console.error('[Beluga] Could not send the menu banner (' + error.message + ').')
    return message.send(MENU_CAPTION)
  }
}

bot({ pattern: 'menu ?(.*)', desc: 'Show the Beluga menu with its banner', type: 'misc' }, sendMenu)
bot({ pattern: 'help ?(.*)', desc: 'Show Beluga command help', type: 'misc' }, sendMenu)
bot({ pattern: 'list ?(.*)', desc: 'List available Beluga commands', type: 'misc' }, sendMenu)

function phoneDigits(jid) {
  try {
    return String(jidToNum(jid) || '').replace(/\D/g, '')
  } catch {
    return ''
  }
}

function isConfiguredOwner(jid) {
  const number = phoneDigits(jid)
  if (!number) return false
  const owners = String(process.env.SUDO || '')
    .split(/[\s,;]+/)
    .map((item) => item.replace(/\D/g, ''))
    .filter(Boolean)
  return owners.includes(number)
}

function senderJid(message) {
  return message.sender || message.data?.key?.participant || ''
}

async function groupParticipants(message) {
  return message.groupMetadata(message.jid)
}

async function isGroupManager(message, participants) {
  const sender = senderJid(message)
  if (!sender) return false
  if (isConfiguredOwner(sender)) return true
  const members = participants || await groupParticipants(message)
  return isAdmin(members, sender)
}

function readSpecialPeople() {
  try {
    const data = JSON.parse(fs.readFileSync(specialPeoplePath, 'utf8'))
    return data && data.groups && typeof data.groups === 'object' && !Array.isArray(data.groups)
      ? data
      : { groups: {} }
  } catch {
    return { groups: {} }
  }
}

function saveSpecialPeople(data) {
  fs.mkdirSync(path.dirname(specialPeoplePath), { recursive: true })
  const temporaryPath = specialPeoplePath + '.' + process.pid + '.tmp'
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), { mode: 0o600 })
  try {
    fs.chmodSync(temporaryPath, 0o600)
  } catch {}
  fs.renameSync(temporaryPath, specialPeoplePath)
}

function designatedPerson(groupId, userJid) {
  if (!groupId || !userJid) return null
  const members = readSpecialPeople().groups[groupId]
  if (!members || typeof members !== 'object') return null
  const profile = members[userJid]
  return profile && typeof profile === 'object' ? profile : null
}

bot(
  {
    pattern: 'geogiasimp ?(.*)',
    desc: 'Admin/mod command to add or remove Geogia’s special people',
    type: 'admin',
    onlyGroup: true,
  },
  async (message, match) => {
    const action = String(match || '').trim().split(/\s+/)[0].toLowerCase()
    const participants = await groupParticipants(message)
    if (!await isGroupManager(message, participants)) {
      return message.send('Only a group admin/mod or Beluga’s configured owner can change Geogia’s special people.')
    }
    const data = readSpecialPeople()
    if (!data.groups[message.jid] || typeof data.groups[message.jid] !== 'object') data.groups[message.jid] = {}
    const members = data.groups[message.jid]
    if (action === 'list') {
      const entries = Object.entries(members)
      if (!entries.length) return message.send('No special people are set in this group yet.')
      return message.send('Geogia’s special people here:\n' + entries.map(([jid, profile]) =>
        '• ' + (profile.name || 'Special person') + ' (@' + phoneDigits(jid) + ')'
      ).join('\n'))
    }
    const target = message.mention?.[0] || message.reply_message?.jid
    if (!target || !String(target).includes('@')) {
      return message.send('Reply to a member or mention them. Use .geogiasimp add @member blanc, .geogiasimp remove @member, or .geogiasimp list.')
    }
    if (action === 'remove') {
      if (!members[target]) return message.send('That member is not on Geogia’s special list.')
      delete members[target]
      if (!Object.keys(members).length) delete data.groups[message.jid]
      saveSpecialPeople(data)
      return message.send('Done. Geogia’s special-person treatment is off for that member.')
    }
    if (action !== 'add') {
      return message.send('Use .geogiasimp add @member [blanc], .geogiasimp remove @member, or .geogiasimp list.')
    }
    if (Object.keys(members).length >= 50 && !members[target]) {
      return message.send('This group has reached the 50-person designation limit.')
    }
    const profile = /\bblanc\b/i.test(String(match || ''))
      ? { name: 'Blanc', profile: 'blanc' }
      : { name: 'Special person', profile: 'special' }
    members[target] = { jid: target, name: profile.name, profile: profile.profile }
    saveSpecialPeople(data)
    return message.send(
      profile.profile === 'blanc'
        ? 'Done. Blanc is registered here; Geogia can now bring the debate banter and light, respectful glaze when he addresses her.'
        : 'Done. Geogia can now give this member extra warm, playful attention when they address her.'
    )
  }
)

bot(
  { pattern: 'blanc ?(.*)', desc: 'Blanc’s special debate-and-glaze command', type: 'special', onlyGroup: true },
  async (message) => {
    const sender = senderJid(message)
    const profile = designatedPerson(message.jid, sender)
    if (!profile || profile.profile !== 'blanc') {
      return message.send('This one is Blanc’s command. A group admin can register him with .geogiasimp add @Blanc blanc.')
    }
    const mention = '@' + phoneDigits(sender)
    return message.send(
      mention + ' Blanc chan, your debate game too peak joor. You bring one hot take and suddenly I’m ready to defend my whole thesis 😌 You’re the best.',
      { contextInfo: { mentionedJid: [sender] } }
    )
  }
)

function warningText(user, count, limit) {
  const number = phoneDigits(user)
  const mention = '@' + number
  const isNigerianNumber = number.startsWith('234')
  if (count > limit) {
    return {
      message: isNigerianNumber ? mention + ' toor dem warn u sha' : mention + ' byee gng',
      pidgin: isNigerianNumber,
    }
  }
  return {
    message: isNigerianNumber
      ? mention + ' awfar u dey mad? The admins don warn u, no vex. Warning ' + count + '/' + limit + '.'
      : mention + ' Bro, stop or else your ahh gonna get kicked. Pity yourself, vro. Warning ' + count + '/' + limit + '.',
    pidgin: isNigerianNumber,
  }
}

bot(
  { pattern: 'warn ?(.*)', desc: 'Warn or remove a member after repeated warnings', type: 'admin', onlyGroup: true },
  async (message, match, ctx) => {
    const participants = await groupParticipants(message)
    if (!await isGroupManager(message, participants)) {
      return message.send('Only a group admin/mod or Beluga’s configured owner can issue warnings.')
    }
    const args = String(match || '').trim()
    const reset = /^reset\b/i.test(args)
    const user = message.mention?.[0] || message.reply_message?.jid
    if (!user || !String(user).includes('@')) {
      return message.send('Reply to a member or mention them. Use .warn @member; admins can use .warn reset @member.')
    }
    if (await isAdmin(participants, user)) {
      return message.send('I can’t warn or kick a group admin.')
    }
    const limit = Math.max(1, Number.parseInt(ctx?.WARN_LIMIT, 10) || 3)
    if (reset) {
      const resetCount = Number(await setWarn(user, message.jid, message.id, limit, -1))
      const remaining = Math.max(0, limit - resetCount)
      return message.send(
        'Warnings reset for @' + phoneDigits(user) + '. They now have ' + remaining + '/' + limit + ' warnings before removal.',
        { contextInfo: { mentionedJid: [user] } }
      )
    }

    const count = Number(await setWarn(user, message.jid, message.id, limit))
    const warning = warningText(user, count, limit)
    if (count > limit) {
      const botJid = message.client?.user?.jid
      if (!botJid || !await isAdmin(participants, botJid)) {
        return message.send('The final warning is recorded, but Beluga needs group admin access before I can remove anyone.')
      }
      await message.send(warning.message, { contextInfo: { mentionedJid: [user] } })
      try {
        const stickerData = fs.readFileSync(path.join(mediaDirectory, 'stickers', 'sticker-052.webp'))
        await message.send(stickerData, { isAnimated: true }, 'sticker')
      } catch (error) {
        console.error('[Beluga] Could not send the warning Pepe sticker (' + error.message + ').')
      }
      try {
        await message.Kick(user)
        await deleteWarn(user, message.jid, message.id)
      } catch (error) {
        console.error('[Beluga] Could not remove a member after the final warning (' + error.message + ').')
        return message.send('I sent the final warning, but could not remove the member. Check Beluga’s group admin access.')
      }
      return
    }
    return message.send(warning.message, { contextInfo: { mentionedJid: [user] } })
  }
)

function safeTokenEqual(candidate) {
  if (typeof candidate !== 'string' || !bridgeToken) return false
  const left = Buffer.from(candidate)
  const right = Buffer.from(bridgeToken)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 32_000) throw new Error('request too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function respond(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/reply') {
    return respond(response, 404, { error: 'not found' })
  }
  if (!safeTokenEqual(request.headers['x-beluga-bridge-token'])) {
    return respond(response, 401, { error: 'unauthorized' })
  }

  let payload
  try {
    payload = await readJson(request)
  } catch {
    return respond(response, 400, { error: 'invalid request' })
  }
  if (
    typeof payload.messageId !== 'string' ||
    typeof payload.reply !== 'string' ||
    payload.reply.length > 3500 ||
    !(payload.sticker === 'none' || (typeof payload.sticker === 'string' && /^sticker-\d{3}$/.test(payload.sticker))) ||
    typeof payload.stickerAnimated !== 'boolean'
  ) {
    return respond(response, 400, { error: 'invalid reply' })
  }

  const saved = recentMessages.get(payload.messageId)
  if (!saved || saved.expiresAt <= Date.now()) {
    recentMessages.delete(payload.messageId)
    return respond(response, 404, { error: 'message context expired' })
  }

  const options = saved.message.data ? { quoted: saved.message.data } : {}
  let reply = payload.reply.trim()
  if (saved.isGroup && typeof saved.sender === 'string' && saved.sender.includes('@')) {
    const jid = saved.sender
    options.contextInfo = { mentionedJid: [jid] }
    reply = '@' + jid.split('@')[0] + ' ' + reply
  }

  try {
    await saved.message.send(reply, options)
  } catch {
    return respond(response, 502, { error: 'text send failed' })
  }

  let stickerSent = false
  if (payload.sticker !== 'none') {
    try {
      const stickerPath = path.join(mediaDirectory, 'stickers', payload.sticker + '.webp')
      const stickerData = fs.readFileSync(stickerPath)
      await saved.message.send(
        stickerData,
        { ...(saved.message.data ? { quoted: saved.message.data } : {}), isAnimated: payload.stickerAnimated },
        'sticker'
      )
      stickerSent = true
    } catch (error) {
      console.error('[Beluga] Could not send the selected sticker (' + error.message + ').')
    }
  }

  recentMessages.delete(payload.messageId)
  return respond(response, 200, { sent: true, stickerSent })
})

if (!Number.isInteger(bridgePort) || bridgePort < 1 || bridgePort > 65535 || !bridgeToken) {
  throw new Error('Beluga bridge configuration is missing.')
}
server.listen(bridgePort, '127.0.0.1', () => {
  console.log('[Beluga] Local reply bridge is ready.')
})
server.on('error', (error) => {
  console.error('[Beluga] Local reply bridge failed (' + error.message + ').')
})
