#!/bin/sh
# Start local mongod (run in a separate terminal, leave it running, then: npm run dev)
# If your data lives somewhere else, set MONGOD_DBPATH, e.g. MONGOD_DBPATH=~/old-data sh mongod-local.sh
set -e
MONGOD_BIN="${MONGOD_BIN:-"$HOME/mongodb/bin/mongod"}"
if [ ! -x "$MONGOD_BIN" ]; then
  MONGOD_BIN="$(command -v mongod 2>/dev/null)" || {
    echo "mongod not found. Install MongoDB or set MONGOD_BIN to the mongod path." >&2
    exit 1
  }
fi
DBPATH="${MONGOD_DBPATH:-$HOME/mongodb-data}"
mkdir -p "$DBPATH"
exec "$MONGOD_BIN" --dbpath "$DBPATH" --bind_ip 127.0.0.1 --port 27017
