"use strict";
const { extractDockerfile } = require("./extract");

const format = {
  id: "dockerfile",
  patterns: ["**/{Dockerfile,Dockerfile.*,*.Dockerfile,*.dockerfile,Containerfile,Containerfile.*,*.Containerfile}"],
  order: 3,
  rules: {
    PM003: Object.freeze({
    name: "docker-source-not-found",
    description: "Dockerfile COPY / ADD source not found",
    category: "docker",
    tags: Object.freeze(["dockerfile","copy","add"]),
    severity: "warning",
    fixable: true,
  }),
    PM011: Object.freeze({
    name: "outside-docker-context",
    description: "COPY / ADD source outside the Docker build context",
    category: "docker",
    tags: Object.freeze(["dockerfile","build","security"]),
    severity: "warning",
    fixable: false,
  }),
  },
  match({ base, parent, grand, parts }) { if (!/\.dockerignore$/i.test(base) && (/^(Dockerfile|Containerfile)(\.[\w.-]+)?$/.test(base) || /\.(Dockerfile|dockerfile|Containerfile)$/.test(base))) return "dockerfile"; return null; },
  
  extract(document, context, settings) { return extractDockerfile(document, context); },
};

module.exports = { format };
