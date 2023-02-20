interface IConstants {
	// WhatsApp status broadcast
	statusBroadcast: string;

	// TODO: Use this :D
	// Voice message mime type
	voiceMessageMimeType: string;
}

const constants: IConstants = {
	statusBroadcast: "status@broadcast",
	voiceMessageMimeType: "audio/ogg"
};

export default constants;
