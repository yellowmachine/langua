FROM python:3.12-slim

RUN pip install --no-cache-dir "piper-tts[http]"

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME /data/voices
EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
