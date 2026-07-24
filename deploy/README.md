# Ronald Explorer deployment

This directory contains the container configuration only. A non-root NGINX
container serves the canonical frontend after `scripts/deploy.sh` copies it to
the server's `www/` directory. Nginx Proxy Manager (NPM) should provide the
public TLS endpoint.

## Deploy

From the repository root:

```sh
./scripts/deploy.sh
```

This preserves the existing server structure:

```text
<RONALD_DEPLOY_ROOT>/
├── docker-compose.yaml
├── nginx.conf
└── www/
    ├── index.html
    ├── style.css
    ├── fonts/
    └── src/
```

The script requires local deployment settings. Configure them once in Fish:

```fish
set -Ux RONALD_DEPLOY_HOST user@server
set -Ux RONALD_DEPLOY_ROOT /path/to/ronald
```

Pass `--dry-run` to preview the transfer. The script resolves symbolic links,
so it can be exposed as `deploy-ronald` from a directory on your `PATH`.

Start or refresh the service on the server:

```sh
ssh $RONALD_DEPLOY_HOST \
  "cd $RONALD_DEPLOY_ROOT && docker compose up -d"
```

In NPM, create a Proxy Host for your public domain with:

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
