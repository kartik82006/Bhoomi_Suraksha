import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";

describe("POST /api/auth/login", () => {
  it("issues tokens for valid demo admin credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@bhoomi.gov.in", password: "changeme-admin" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.role).toBe("admin");
  });

  it("rejects a wrong password with a generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@bhoomi.gov.in", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("rejects an unknown email with the same generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@bhoomi.gov.in", password: "whatever" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
  });

  it("400s when email or password is missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "admin@bhoomi.gov.in" });
    expect(res.status).toBe(400);
  });
});

describe("refresh token rotation", () => {
  it("rotates on refresh and rejects reuse of the old token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@bhoomi.gov.in", password: "changeme-admin" });
    const oldRefresh = login.body.refreshToken;

    const refreshed = await request(app).post("/api/auth/refresh").send({ refreshToken: oldRefresh });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).not.toBe(oldRefresh);

    const reused = await request(app).post("/api/auth/refresh").send({ refreshToken: oldRefresh });
    expect(reused.status).toBe(401);
  });

  it("revokes a token on logout so it can no longer be refreshed", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@bhoomi.gov.in", password: "changeme-admin" });
    const refreshToken = login.body.refreshToken;

    const logout = await request(app).post("/api/auth/logout").send({ refreshToken });
    expect(logout.status).toBe(204);

    const afterLogout = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });
});

describe("POST /api/auth/register", () => {
  it("lets an admin create a new user", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@bhoomi.gov.in", password: "changeme-admin" });

    const email = `test-${Date.now()}@bhoomi.gov.in`;
    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ email, password: "somepassword", role: "state_official", stateCode: "Kerala" });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email);

    await prisma.user.delete({ where: { email } });
  });

  it("rejects registration from a non-admin role", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@bhoomi.gov.in", password: "changeme-viewer" });

    const res = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ email: "x@x.com", password: "p", role: "admin" });

    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated registration attempt", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "x@x.com", password: "p", role: "admin" });
    expect(res.status).toBe(401);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
