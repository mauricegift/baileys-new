# baileys-new

> A fork of [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) v7.0.0-rc13 with extra features backported from [gifted-baileys](https://github.com/mauricegift/gifted-baileys).

  <p>A WebSocket-based JavaScript library for interacting with the WhatsApp Web API</p>
  
  [![npm version](https://img.shields.io/npm/v/gifted-baileys.svg)](https://www.npmjs.com/package/gifted-baileys)
  [![npm downloads](https://img.shields.io/npm/dm/gifted-baileys.svg)](https://www.npmjs.com/package/gifted-baileys)
  [![License](https://img.shields.io/npm/l/gifted-baileys.svg)](https://github.com/mauricegift/gifted-baileys/blob/main/LICENSE)
</div>

## Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or affiliates. Use at your own discretion. Do not spam people with this. We discourage any stalkerware, bulk or automated messaging usage.


> **Note:** For sending buttons, please use the [gifted-btns](https://npmjs.com/package/gifted-btns) package.

## Documentation

Full documentation is available at [baileys.giftedtech.co.ke](https://baileys.gifted.co.ke)


## Added Features

### 1. Newsletter (Channel) Functions
Full newsletter/channel support including:
- `newsletterCreate(name, description)` — create a channel
- `newsletterFollow(jid)` — follow a channel (fixed URL, last commit from gifted-baileys)
- `newsletterUnfollow(jid)` — unfollow
- `newsletterMute(jid)` / `newsletterUnmute(jid)` — mute/unmute
- `newsletterMetadata(type, key)` — fetch channel metadata
- `newsletterSubscribers(jid)` — get subscriber list
- `newsletterReactMessage(jid, serverId, reaction)` — react to newsletter post
- `newsletterFetchMessages(jid, count, since, after)` — fetch messages
- `subscribeNewsletterUpdates(jid)` — subscribe to live updates
- `newsletterUpdate(jid, updates)` — update channel info
- `newsletterUpdateName` / `newsletterUpdateDescription` / `newsletterUpdatePicture` / `newsletterRemovePicture`
- `newsletterAdminCount` / `newsletterChangeOwner` / `newsletterDemote` / `newsletterDelete`

### 2. Group Status Features
Post statuses/stories to group chats:
```js
// Post a story visible to a specific group's members
await sock.sendMessage(groupJid, {
  groupStatusMessage: {
    text: 'Hello from group status!'
  }
});

// Or use giftedStatus directly
await sock.giftedStatus.sendGroupStatus(groupJid, { image: { url: '...' }, caption: 'Hi' });
await sock.giftedStatus.sendStatusToGroups({ text: 'Hi all!' }, [groupJid1, groupJid2]);
```

### 3. Carousel Messages
Send interactive carousel messages (multi-card with media + buttons):
```js
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

const cards = await Promise.all(items.map(async (item) => ({
  header: {
    title: item.title,
    hasMediaAttachment: true,
    imageMessage: (
      await generateWAMessageContent(
        { image: { url: item.imageUrl } },
        { upload: sock.waUploadToServer }
      )
    ).imageMessage,
  },
  body: { text: item.description },
  footer: { text: 'Powered by baileys-new' },
  nativeFlowMessage: {
    buttons: [
      {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({ display_text: 'Open', url: item.url }),
      },
    ],
  },
})));

const message = generateWAMessageFromContent(
  chatJid,
  {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: {
          body: { text: 'Results' },
          footer: { text: 'Showing results' },
          carouselMessage: { cards },
        },
      },
    },
  },
  { userJid: sock.user.id }
);

await sock.relayMessage(chatJid, message.message, { messageId: message.key.id });
```

### 4. Internal Log Suppression
No more cryptic Signal/libsignal noise in your console. Call once at startup:

```js
// ESM
import { suppressBaileysLogs } from '@whiskeysockets/baileys';
suppressBaileysLogs();

// CommonJS
const { suppressBaileysLogs } = require('@whiskeysockets/baileys');
suppressBaileysLogs();

// Or import the module directly
import suppressBaileysLogs from '@whiskeysockets/baileys/suppress-logs';
suppressBaileysLogs();
```

Suppresses: `Closing session`, `Bad MAC`, `SessionEntry`, `libsignal`, `decryptWithSessions`, `Interactive send:`, `List send:`, and more.

### 5. ESM + CommonJS Dual Support
The package ships with both ESM (`lib/index.js`) and CommonJS (`lib/index-cjs.cjs`) entry points.

```js
// ESM
import makeWASocket from '@whiskeysockets/baileys';

// CommonJS
const { default: makeWASocket } = require('@whiskeysockets/baileys');
// or
const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.makeWASocket || baileys.default;
```

## Usage

```bash
npm install github:mauricegift/baileys-new
# or
yarn add github:mauricegift/baileys-new
```

## Original Package

Based on [@whiskeysockets/baileys](https://www.npmjs.com/package/@whiskeysockets/baileys) v7.0.0-rc13.
Licensed under MIT.
