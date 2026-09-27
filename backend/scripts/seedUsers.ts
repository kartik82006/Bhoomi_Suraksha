import argon2 from "argon2";
import { prisma } from "../src/db.js";

const DEMO_USERS = [
  { email: "admin@bhoomi.gov.in", role: "admin" as const, stateCode: null, password: "changeme-admin" },
  { email: "sdma-uk@bhoomi.gov.in", role: "state_official" as const, stateCode: "Uttarakhand", password: "changeme-sdma" },
  { email: "viewer@bhoomi.gov.in", role: "public_viewer" as const, stateCode: null, password: "changeme-viewer" },
];

async function main() {
  for (const u of DEMO_USERS) {
    const passwordHash = await argon2.hash(u.password);
    await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, role: u.role, stateCode: u.stateCode, passwordHash },
      update: { passwordHash, role: u.role, stateCode: u.stateCode },
    });
    console.log(`[seed:users] upserted ${u.email} (${u.role})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
