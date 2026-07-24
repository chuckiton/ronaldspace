# Ronaldverse Explorer deployment

This folder is a self-contained static deployment. A non-root NGINX container serves `www/` read-only over HTTP; Nginx Proxy Manager (NPM) should provide the public TLS endpoint.

## Prepare the static copy

The repository root is canonical; do not edit `www/` directly. From the
repository root, synchronize and verify the deployment copy:

```sh
./scripts/sync-deployment.sh
./scripts/check-deployment.sh
```

## Deploy

1. Copy this `ronald/` folder to `/mnt/docks/stacks/ronald` on the server.
2. Start the service:

   ```sh
   cd /mnt/docks/stacks/ronald
   docker compose up -d
   ```

3. In NPM, create a Proxy Host for your public domain with:

   - Scheme: `http`
   - Forward hostname/IP: the Docker host
   - Forward port: `8888`
   - Websockets: off

NPM should issue and renew the TLS certificate. Allow public TCP ports 80 and 443 to NPM only; port 8888 should be restricted to the reverse-proxy host/network by your firewall.

For a different upstream port:

```sh
HTTP_PORT=8081 docker compose up -d
```

The container has no TLS keys, runs as a non-root user, drops all Linux capabilities, and can write only to temporary in-memory directories.
