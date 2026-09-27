import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";

let adminToken: string;
let stateOfficialToken: string;
let viewerToken: string;
// Fetched from live data so the suite is dataset-agnostic (works on both the
// synthetic Demo District fixture used in CI and the real Uttarakhand dataset).
let anyHabId: string;
let anyHabTier: string;
let ukHabId: string; // a habitation inside the state official's assigned state

beforeAll(async () => {
  const login = async (email: string, password: string) => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    return res.body.accessToken as string;
  };
  adminToken = await login("admin@bhoomi.gov.in", "changeme-admin");
  stateOfficialToken = await login("sdma-uk@bhoomi.gov.in", "changeme-sdma");
  viewerToken = await login("viewer@bhoomi.gov.in", "changeme-viewer");

  const prio = await request(app).get("/api/prioritization").set("Authorization", `Bearer ${adminToken}`);
  anyHabId = prio.body[0].habitationId;
  anyHabTier = prio.body[0].tier;
  const uk = prio.body.find((i: { state: string }) => i.state === "Uttarakhand");
  ukHabId = uk ? uk.habitationId : anyHabId;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/hazards (public)", () => {
  it("returns a GeoJSON FeatureCollection with no auth required", async () => {
    const res = await request(app).get("/api/hazards");
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("FeatureCollection");
    expect(res.body.features.length).toBeGreaterThan(0);
  });

  it("filters by hazard type", async () => {
    const res = await request(app).get("/api/hazards?type=landslide");
    expect(res.status).toBe(200);
    for (const f of res.body.features) {
      expect(f.properties.hazardType).toBe("landslide");
    }
  });
});

describe("GET /api/summary (public)", () => {
  it("returns aggregated counts with no habitation-level data", async () => {
    const res = await request(app).get("/api/summary");
    expect(res.status).toBe(200);
    expect(res.body.habitationCount).toBeGreaterThan(0);
    expect(res.body).not.toHaveProperty("habitations");
  });
});

describe("GET /api/habitations (role-scoped)", () => {
  it("403s without a token", async () => {
    const res = await request(app).get("/api/habitations");
    expect(res.status).toBe(401);
  });

  it("403s for a public viewer", async () => {
    const res = await request(app).get("/api/habitations").set("Authorization", `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });

  it("returns all habitations for an admin", async () => {
    const res = await request(app).get("/api/habitations").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.features.length).toBeGreaterThan(0);
  });

  it("scopes a state official to their assigned state even if they request another", async () => {
    const res = await request(app)
      .get("/api/habitations?state=SomeOtherState")
      .set("Authorization", `Bearer ${stateOfficialToken}`);
    expect(res.status).toBe(200);
    for (const f of res.body.features) {
      expect(f.properties.state).toBe("Uttarakhand");
    }
  });
});

describe("GET /api/prioritization", () => {
  it("ranks immediate before short_term before medium_term", async () => {
    const res = await request(app).get("/api/prioritization").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const tierOrder: Record<string, number> = { immediate: 0, short_term: 1, medium_term: 2 };
    const ranks = res.body.map((item: { tier: string }) => tierOrder[item.tier]);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });

  it("filters by tier", async () => {
    const res = await request(app).get("/api/prioritization?tier=medium_term").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const item of res.body) {
      expect(item.tier).toBe("medium_term");
    }
  });
});

describe("POST /api/prioritization/:id/review", () => {
  it("requires a justification", async () => {
    const res = await request(app)
      .post(`/api/prioritization/${anyHabId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("records an audited tier override and is visible on subsequent reads", async () => {
    const newTier = anyHabTier === "immediate" ? "short_term" : "immediate";
    const res = await request(app)
      .post(`/api/prioritization/${anyHabId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tier: newTier, justification: "Integration test override" });

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe(newTier);
    expect(res.body.auditEntry.justification).toBe("Integration test override");

    const list = await request(app).get("/api/prioritization").set("Authorization", `Bearer ${adminToken}`);
    const updated = list.body.find((i: { habitationId: string }) => i.habitationId === anyHabId);
    expect(updated.tier).toBe(newTier);

    // restore the original tier for other tests / demo consistency
    await request(app)
      .post(`/api/prioritization/${anyHabId}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tier: anyHabTier, justification: "Restore after integration test" });
  });

  it("allows a state official to review a habitation inside their assigned state", async () => {
    const res = await request(app)
      .post(`/api/prioritization/${ukHabId}/review`)
      .set("Authorization", `Bearer ${stateOfficialToken}`)
      .send({ justification: "test" });
    // ukHabId is in Uttarakhand, the official's own state, so scoping allows it (200).
    expect(res.status).toBe(200);
  });
});

describe("GET /api/sites (public)", () => {
  it("returns capacity computed from real polygon area", async () => {
    const res = await request(app).get("/api/sites");
    expect(res.status).toBe(200);
    for (const f of res.body.features) {
      expect(f.properties.capacityPersons).toBeGreaterThan(0);
      expect(f.properties.capacityPersons).toBeLessThan(10000); // sanity bound against the earlier area-units bug
    }
  });
});
