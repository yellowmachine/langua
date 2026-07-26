#!/bin/sh
# Pre-downloads one voice per supported language (src/lib/languages.ts) into
# the shared volume, then serves all of them from a single piper.http_server
# process — the `voice` field in each /synthesize request picks which one.
set -e

VOICES="${TTS_VOICES:-es_ES-davefx-medium en_US-lessac-medium fr_FR-siwis-medium de_DE-thorsten-medium it_IT-paola-medium pt_BR-faber-medium}"

for voice in $VOICES; do
	if [ ! -f "/data/voices/${voice}.onnx" ]; then
		echo "tts: downloading voice $voice"
		python3 -m piper.download_voices "$voice" --download-dir /data/voices
	fi
done

exec python3 -m piper.http_server \
	--host 0.0.0.0 \
	--port 5000 \
	--data-dir /data/voices \
	-m "${TTS_DEFAULT_VOICE:-en_US-lessac-medium}"
