require("./integration-env.cjs").configure();
// Import app, not server: no backup, recurring jobs, migration or external sync.
const app = require("../backend/dist/app.js").default;
app.listen(3001, "127.0.0.1", () =>
  console.log("Isolated API ready on loopback:3001"),
);
