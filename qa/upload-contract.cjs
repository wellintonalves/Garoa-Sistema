require("./integration-env.cjs").configure();
const fs = require("fs"),
  assert = require("node:assert/strict"),
  { PrismaClient } = require("@prisma/client");
const fixture = JSON.parse(
  fs.readFileSync(".tmp/integration-fixtures.json", "utf8"),
);
const {
  SupabaseService,
} = require("../backend/dist/services/supabase.service.js");
const db = new PrismaClient(),
  calls = [];
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7s8AAAAASUVORK5CYII=",
  "base64",
);
const photo = "data:image/png;base64," + image.toString("base64");
// Contract test only: storage boundary is replaced; no cloud is contacted.
SupabaseService.uploadImage = async (bucket, path, bytes, mime) => {
  calls.push({ bucket, path, bytes, mime });
  return photo;
};
const app = require("../backend/dist/app.js").default;
const server = app.listen(3002, "127.0.0.1", async () => {
  try {
    const login = await fetch("http://127.0.0.1:3002/barbeiro/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fixture.main.email,
        senha: fixture.password,
      }),
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    const form = new FormData();
    form.append(
      "file",
      new Blob([image], { type: "image/png" }),
      "portrait.png",
    );
    const r = await fetch("http://127.0.0.1:3002/barbeiro/foto", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).url, photo);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].bucket, "barbeiros");
    assert(calls[0].path.startsWith("barbeiro-" + fixture.main.id + "-"));
    assert.equal(calls[0].mime, "image/png");
    assert.deepEqual(calls[0].bytes, image);
    assert.equal(
      (await db.barbeiro.findUniqueOrThrow({ where: { id: fixture.main.id } }))
        .foto,
      photo,
    );
    await db.barbeiro.update({
      where: { id: fixture.main.id },
      data: { foto: null },
    });
    fs.writeFileSync(
      "qa/evidence/upload-contract.json",
      JSON.stringify(
        {
          status: "passed",
          realHttp: true,
          realAuthentication: true,
          realPostgres: true,
          storage: "local adapter, no cloud calls",
          checked: [
            "multipart field file",
            "PNG bytes and MIME",
            "barbeiros bucket contract",
            "200 response URL",
            "profile persistence",
          ],
          remoteUploadTested: false,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS multipart/auth/controller/profile persistence; storage adapter only, no remote upload.",
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    server.close();
    await db.$disconnect();
  }
});
