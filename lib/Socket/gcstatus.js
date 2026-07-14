import crypto from 'crypto';
import { generateWAMessage, generateWAMessageFromContent, generateMessageID, delay } from '../Utils/index.js';
import { generateWAMessageContent } from '../Utils/messages.js';
import { getUrlInfo } from '../Utils/link-preview.js';
import { jidNormalizedUser, isJidGroup, isPnUser, STORIES_JID } from '../WABinary/index.js';

class GiftedStatus {
    constructor(utils, waUploadToServer, relayMessageFn, config, sock) {
        this.utils = utils;
        this.relayMessage = relayMessageFn;
        this.waUploadToServer = waUploadToServer;
        this.config = config;
        this.sock = sock;
    }

    async handleGroupStory(content, jid, quoted) {
        const storyData = content.groupStatusMessage;
        let waMsgContent;
        if (storyData.message) {
            waMsgContent = storyData;
        } else {
            waMsgContent = await generateWAMessage(jid, storyData, {
                upload: this.waUploadToServer,
                logger: this.config.logger,
                mediaCache: this.config.mediaCache,
                options: this.config.options,
                userJid: this.sock.authState?.creds?.me?.id
            });
        }
        const msg = {
            message: {
                groupStatusMessageV2: {
                    message: waMsgContent.message || waMsgContent
                }
            }
        };
        return await this.relayMessage(jid, msg.message, {
            messageId: generateMessageID()
        });
    }

    async sendGroupStatus(groupJid, content, options = {}) {
        // Upload media and get inner message content
        const inside = content.message
            ? content.message
            : await generateWAMessageContent(content, { upload: this.waUploadToServer });

        // messageSecret is required by WhatsApp for media group status; without it
        // text-only works but images/audio/video are silently dropped.
        const messageSecret = crypto.randomBytes(32);

        const msg = generateWAMessageFromContent(groupJid, {
            messageContextInfo: { messageSecret },
            groupStatusMessageV2: {
                message: { ...inside, messageContextInfo: { messageSecret } }
            }
        }, {});

        return await this.relayMessage(groupJid, msg.message, {
            messageId: msg.key.id || options.messageId || generateMessageID(),
            ...options
        });
    }

    async sendStatusToGroups(content, jids = []) {
        const userJid = jidNormalizedUser(this.sock.authState.creds.me.id);
        let allUsers = new Set();
        allUsers.add(userJid);

        for (const id of jids) {
            const isGroup = isJidGroup(id);
            const isPrivate = isPnUser(id);
            if (isGroup) {
                try {
                    const metadata = await this.sock.groupMetadata(id);
                    const participants = metadata.participants.map(p => jidNormalizedUser(p.id));
                    participants.forEach(j => allUsers.add(j));
                } catch (error) {
                    this.config.logger?.error?.(`Error getting metadata for group ${id}: ${error}`);
                }
            } else if (isPrivate) {
                allUsers.add(jidNormalizedUser(id));
            }
        }

        const uniqueUsers = Array.from(allUsers);
        const getRandomHexColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

        const isMedia = content.image || content.video || content.audio;
        const isAudio = !!content.audio;
        const messageContent = { ...content };

        if (isMedia && !isAudio) {
            if (messageContent.text) {
                messageContent.caption = messageContent.text;
                delete messageContent.text;
            }
            delete messageContent.ptt;
            delete messageContent.font;
            delete messageContent.backgroundColor;
            delete messageContent.textColor;
        }
        if (isAudio) {
            delete messageContent.text;
            delete messageContent.caption;
            delete messageContent.font;
            delete messageContent.textColor;
        }

        const font = !isMedia ? (content.font || Math.floor(Math.random() * 9)) : undefined;
        const textColor = !isMedia ? (content.textColor || getRandomHexColor()) : undefined;
        const backgroundColor = (!isMedia || isAudio) ? (content.backgroundColor || getRandomHexColor()) : undefined;
        const ptt = isAudio ? (typeof content.ptt === 'boolean' ? content.ptt : true) : undefined;

        let msg;
        try {
            msg = await generateWAMessage(STORIES_JID, messageContent, {
                logger: this.config.logger,
                userJid,
                getUrlInfo: text => getUrlInfo(text, {
                    thumbnailWidth: this.config.linkPreviewImageThumbnailWidth,
                    fetchOpts: { timeout: 3000, ...(this.config.options || {}) },
                    logger: this.config.logger,
                    uploadImage: this.config.generateHighQualityLinkPreview ? this.waUploadToServer : undefined
                }),
                upload: this.waUploadToServer,
                mediaCache: this.config.mediaCache,
                options: this.config.options,
                font,
                textColor,
                backgroundColor,
                ptt
            });
        } catch (error) {
            this.config.logger?.error?.(`Error generating message: ${error}`);
            throw error;
        }

        await this.relayMessage(STORIES_JID, msg.message, {
            messageId: msg.key.id,
            statusJidList: uniqueUsers,
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: {},
                    content: [
                        {
                            tag: 'mentioned_users',
                            attrs: {},
                            content: jids.map(j => ({
                                tag: 'to',
                                attrs: { jid: jidNormalizedUser(j) }
                            }))
                        }
                    ]
                }
            ]
        });

        for (const id of jids) {
            try {
                const normalizedId = jidNormalizedUser(id);
                const isPrivate = isPnUser(normalizedId);
                const type = isPrivate ? 'statusMentionMessage' : 'groupStatusMentionMessage';
                const protocolMessage = {
                    [type]: {
                        message: {
                            protocolMessage: {
                                key: msg.key,
                                type: 25
                            }
                        }
                    },
                    messageContextInfo: {
                        messageSecret: crypto.randomBytes(32)
                    }
                };
                const statusMsg = await generateWAMessageFromContent(normalizedId, protocolMessage, {});
                await this.relayMessage(normalizedId, statusMsg.message, {
                    additionalNodes: [{
                        tag: 'meta',
                        attrs: isPrivate
                            ? { is_status_mention: 'true' }
                            : { is_group_status_mention: 'true' }
                    }]
                });
                await delay(2000);
            } catch (error) {
                this.config.logger?.error?.(`Error sending to ${id}: ${error}`);
            }
        }
        return msg;
    }
}

export default GiftedStatus;
