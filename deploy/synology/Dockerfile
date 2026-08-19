FROM python:3.11-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pymongo certifi

# Bind-mounty na Synology su vlastnene inym UID nez proces v kontajneri, co git od verzie
# 2.35 odmieta ("detected dubious ownership"). Zapisujeme do SYSTEMOVEJ konfiguracie
# (/etc/gitconfig), ktora platí nezavisle od toho, ako je nastavene $HOME za behu —
# nastavenie cez `git config --global` pri niektorych kombinaciach HOME/prav nezaberie.
RUN git config --system --add safe.directory '*'

WORKDIR /work
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
