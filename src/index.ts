import fs from "fs";
import os from "os";
import { v4 } from "uuid";
import process from "process";

import qrcode from "qrcode-terminal";
import { Client, Message, Events } from "whatsapp-web.js";
import { startsWithIgnoreCase, parseWhisperResult, execSync } from "./utils";

// Config & Constants
import config from "./config";
import constants from "./constants";

// ChatGPT & DALLE
import { handleMessageGPT } from "./handlers/gpt";
import { handleMessageDALLE } from "./handlers/dalle";

import * as cli from "./cli/ui";

// Whatsapp Client
const client = new Client({
	puppeteer: {
		args: ["--no-sandbox"]
	}
});

// Handles message
async function handleIncomingMessage(message: Message) {
	const messageString = message.body;

	if (!config.prefixEnabled) {
		// GPT (only <prompt>)
		await handleMessageGPT(message, messageString);
		return;
	}

	// GPT (!gpt <prompt>)
	if (startsWithIgnoreCase(messageString, config.gptPrefix)) {
		const prompt = messageString.substring(config.gptPrefix.length + 1);
		await handleMessageGPT(message, prompt);
		return;
	}

	// DALLE (!dalle <prompt>)
	if (startsWithIgnoreCase(messageString, config.dallePrefix)) {
		const prompt = messageString.substring(config.dallePrefix.length + 1);
		await handleMessageDALLE(message, prompt);
		return;
	}
}

async function handleIncomingVoiceMessage(message: Message) {
	const media = await message.downloadMedia();

	message.reply("Processing voice message...");

	// Media base64 data to buffer
	const buffer = Buffer.from(media.data, "base64");

	// Write the buffer into a temp file
	const tempFile = os.tmpdir() + "/" + v4() + ".ogg";
	fs.writeFileSync(tempFile, buffer);

	// Transcribe using the whisper command
	const whisperResult = await execSync(`whisper --task transcribe --fp16 False ${tempFile}`);

	// Delete the temp file
	fs.unlinkSync(tempFile);

	// Remove all .ogg.* files (whisper creates a bunch of temp files)
	try {
		const regex = /\.ogg\..*$/;
		const files = fs.readdirSync(process.cwd());

		for (const file of files) {
			if (regex.test(file)) {
				fs.unlinkSync(file);
			}
		}
	} catch (error) {
		console.error(error);
	}

	// Parse out the actual text and language
	const { language, text } = parseWhisperResult(whisperResult);

	// Reply with the text and language
	message.reply("You said: " + text + " (language: " + language + ")");

	// Send it to GPT
	await handleMessageGPT(message, text as string);
}

// Entrypoint
const start = async () => {
	cli.printIntro();

	// Whatsapp auth
	client.on(Events.QR_RECEIVED, (qr: string) => {
		qrcode.generate(qr, { small: true }, (qrcode: string) => {
			cli.printQRCode(qrcode);
		});
	});

	// Whatsapp loading
	client.on(Events.LOADING_SCREEN, (percent) => {
		if (percent == "0") {
			cli.printLoading();
		}
	});

	// Whatsapp ready
	client.on(Events.READY, () => {
		cli.printOutro();
	});

	// WhatsApp message
	client.on(Events.MESSAGE_RECEIVED, async (message: Message) => {
		// Ignore if message is from status broadcast
		if (message.from == constants.statusBroadcast) return;

		// Ignore if it's a quoted message, (e.g. GPT reply)
		if (message.hasQuotedMsg) return;

		if (message.hasMedia) {
			// Voice message
			await handleIncomingVoiceMessage(message);
		} else {
			// Text message
			await handleIncomingMessage(message);
		}
	});

	// Reply to own message
	client.on(Events.MESSAGE_CREATE, async (message: Message) => {
		// Ignore if message is from status broadcast
		if (message.from == constants.statusBroadcast) return;

		// Ignore if it's a quoted message, (e.g. GPT reply)
		if (message.hasQuotedMsg) return;

		// Ignore if it's not from me
		if (!message.fromMe) return;

		if (message.hasMedia) {
			// Voice message
			await handleIncomingVoiceMessage(message);
		} else {
			// Text message
			await handleIncomingMessage(message);
		}
	});

	// Whatsapp initialization
	client.initialize();
};

start();
