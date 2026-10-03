// Depois do build: garante as rotas do SPA no Netlify (arrastar a pasta dist ignora o netlify.toml)
import { copyFileSync, writeFileSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
writeFileSync("dist/_redirects", "/*  /index.html  200\n");
writeFileSync("dist/robots.txt", "User-agent: *\nDisallow: /painel\nDisallow: /master\n");
console.log("postbuild: 404.html, _redirects e robots.txt gerados em dist/");
