import { rm } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../../server/index.js";
import { appDataDir, createSampleBank } from "../../server/storage.js";

const workspacePath = path.resolve(".tmp/vitest-api-workspace");

beforeEach(async () => {
  await rm(appDataDir, { recursive: true, force: true });
  await rm(workspacePath, { recursive: true, force: true });
});

describe("API validation", () => {
  it("rejects foreign mutating origins", async () => {
    const app = createApiApp();
    const response = await request(app)
      .post("/api/tex-path")
      .set("Origin", "https://example.invalid")
      .send({ texPath: "" })
      .expect(403);
    expect(response.body.error).toContain("非本机来源");
  });

  it("validates workspace and bank request bodies", async () => {
    const app = createApiApp();
    await request(app).post("/api/workspaces/create-empty").send({}).expect(400);
    await request(app).post("/api/workspaces/create-empty").send({ workspacePath }).expect(200);
    await request(app).post("/api/workspaces/create-empty").send({ workspacePath }).expect(400);
    await request(app).put("/api/bank").send({ nope: true }).expect(400);
    const legacyResponse = await request(app).put("/api/bank").send(createLegacyBank()).expect(200);
    expect(legacyResponse.body.version).toBe(2);
    expect(legacyResponse.body.items[0].modules.question.tex).toBe("legacy question");
    await request(app).put("/api/bank").send(createSampleBank()).expect(200);
    const bankResponse = await request(app).get("/api/bank").expect(200);
    expect(bankResponse.body.items).toHaveLength(2);
  });

  it("validates move, compile, export, and upload inputs", async () => {
    const app = createApiApp();
    await request(app).post("/api/workspaces/create-empty").send({ workspacePath }).expect(200);
    await request(app)
      .put("/api/bank")
      .send({
        ...createSampleBank(),
        items: [{ ...createSampleBank().items[0], modules: { question: { tex: "missing peers" } } }]
      })
      .expect(400);
    await request(app)
      .put("/api/bank")
      .send({ ...createSampleBank(), items: [{ ...createSampleBank().items[0], star: 8 }] })
      .expect(400);
    await request(app).post("/api/workspaces/move").send({ workspacePath, direction: "sideways" }).expect(400);
    await request(app).post("/api/compile-item").send({ item: { id: "bad" }, settings: {} }).expect(400);
    await request(app).post("/api/export").send({ itemIds: [], fileName: "empty" }).expect(400);
    await request(app)
      .post("/api/assets")
      .attach("file", Buffer.from("not an image"), { filename: "note.txt", contentType: "text/plain" })
      .expect(400);
  });
});

function createLegacyBank() {
  return {
    version: 1,
    settings: createSampleBank().settings,
    items: [
      {
        id: "legacy",
        order: 1,
        sourceNumber: "legacy-1",
        chapter: "高等数学",
        tags: ["极限"],
        star: 3,
        questionTex: "legacy question",
        solutionTex: "legacy solution",
        noteTex: "legacy note",
        assets: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  };
}
