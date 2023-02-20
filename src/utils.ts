import { exec } from "child_process";

const startsWithIgnoreCase = (str, prefix) => str.toLowerCase().startsWith(prefix.toLowerCase());

function parseWhisperResult(transcription) {
	const lines = transcription.split("\n");
	const languageLine = lines.find((line) => line.startsWith("Detected language"));
	const language = languageLine.split(": ")[1];
	const textLine = lines.find((line) => line.startsWith("["));
	const text = textLine.split("] ")[1];
	return { language, text };
}

// Function to execute a shell command synchronously
function execSync(command: string) {
	return new Promise((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				reject(error);
				return;
			}
			/*
			if (stderr) {
				reject(stderr);
				return;
			}
            */
			resolve(stdout.trim());
		});
	});
}

export { startsWithIgnoreCase, parseWhisperResult, execSync };
