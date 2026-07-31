#!/usr/bin/env bash
# Adds a secondary IP address to this server's primary network interface so
# this app can run on its own dedicated address, separate from anything
# else already running here.
#
# Only touches LIVE kernel networking (`ip addr add`) — never edits netplan
# files automatically, since guessing wrong about unknown existing config
# could cut off SSH access. Persisting the address across reboots is a
# deliberate manual step this script prints instructions for at the end.
#
# Usage: BIND_IP=192.168.86.229 ./scripts/setup-dedicated-ip.sh
set -euo pipefail

BIND_IP="${BIND_IP:?Set BIND_IP first, e.g. BIND_IP=192.168.86.229 $0}"
PREFIX="${BIND_PREFIX:-24}"

echo "==> Detecting primary network interface"
IFACE="${IFACE:-$(ip -4 route show default | awk '{for (i=1;i<=NF;i++) if ($i=="dev") print $(i+1)}' | head -n1)}"
if [ -z "$IFACE" ]; then
  echo "Could not auto-detect the primary interface. Run 'ip addr' yourself and re-run with:" >&2
  echo "  IFACE=<name> BIND_IP=$BIND_IP $0" >&2
  exit 1
fi
echo "Interface: $IFACE"

CURRENT_IP="$(ip -4 addr show dev "$IFACE" | awk '/inet /{print $2}' | head -n1)"
echo "Existing address on $IFACE: ${CURRENT_IP:-none found}"

echo "==> Checking whether $BIND_IP is already assigned here"
if ip -4 addr show | grep -q "inet ${BIND_IP}/"; then
  echo "$BIND_IP is already assigned on this machine — nothing to add."
else
  echo "==> Checking whether $BIND_IP is in use elsewhere on the network"
  if ping -c 1 -W 2 "$BIND_IP" >/dev/null 2>&1; then
    echo "ERROR: $BIND_IP replied to a ping — something else on the network is already" >&2
    echo "using it. Pick a different IP and re-run: BIND_IP=<other-ip> $0" >&2
    exit 1
  fi

  echo "==> Adding $BIND_IP/$PREFIX to $IFACE (live, effective immediately)"
  sudo ip addr add "${BIND_IP}/${PREFIX}" dev "$IFACE"
  echo "Added. Verifying:"
  ip -4 addr show dev "$IFACE" | grep "$BIND_IP"
fi

cat <<EOF

==> IMPORTANT: this is a LIVE change only — it will NOT survive a reboot yet.

To make it permanent, add it to netplan yourself (this script deliberately
does not do this part automatically — guessing wrong about your existing
config could break your primary IP or SSH access):

  1. cat /etc/netplan/*.yaml       # find the file that configures $IFACE
  2. Add "${BIND_IP}/${PREFIX}" to that interface's existing "addresses:"
     list, alongside (never replacing) what's already there, e.g.:

       network:
         ethernets:
           ${IFACE}:
             addresses:
               - ${CURRENT_IP:-<existing-address>}   # keep this line
               - ${BIND_IP}/${PREFIX}                # add this line

  3. sudo netplan try               # auto-reverts in 120s if it breaks anything
  4. From a SECOND terminal/session, confirm you can still SSH in, then
     press Enter within the 120s window in the first terminal to keep it.

Until you do that, re-add this IP after every reboot with:
  sudo ip addr add ${BIND_IP}/${PREFIX} dev ${IFACE}

EOF
