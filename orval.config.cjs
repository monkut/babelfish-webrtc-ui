module.exports = {
  "openapi-file": {
    input: "./docs/openapi.yaml",
    output: {
      mode: "tags-split",
      target: "app/lib/api/generated/client.ts",
      schemas: "app/lib/api/generated/models",
      client: "fetch",
      override: {
        mutator: {
          path: "app/lib/api/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
  },
};
