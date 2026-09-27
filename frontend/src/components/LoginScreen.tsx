import { useState } from "react";
import { login } from "../api";
import type { Session } from "../types";
import { BrandMark } from "./BrandMark";
import loginBackground from "../assets/img/floods_012.jpg";

const DEMO_ACCESS = [
  {
    id: "ndrf",
    icon: "command",
    label: "NDRF / MHA Admin",
    hint: "Full national access",
    description: "Full access to all hazard layers, priority lists, and national reporting.",
    email: "admin@bhoomi.gov.in",
    password: "changeme-admin",
  },
  {
    id: "sdma",
    icon: "state",
    label: "State DM Official",
    hint: "State-scoped access",
    description: "Scoped access to habitation data, relocation priorities, and district-level analytics.",
    email: "sdma-uk@bhoomi.gov.in",
    password: "changeme-sdma",
  },
  {
    id: "public",
    icon: "public",
    label: "Public Viewer",
    hint: "Aggregated view only",
    description: "Red zone maps and district summaries without habitation-level records.",
    email: "viewer@bhoomi.gov.in",
    password: "changeme-viewer",
  },
];

function AccessIcon({ type }: { type: string }) {
  if (type === "state") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-5h6v5M8 10h.01M12 10h.01M16 10h.01" /></svg>;
  }
  if (type === "public") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
}

export function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await login(email, password);
      onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function loginWithDemo(id: string) {
    const user = DEMO_ACCESS.find((u) => u.id === id);
    if (!user) return;
    setLoading(true);
    setError(null);
    login(user.email, user.password).then((session) => {
      onLogin(session);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Login failed");
    }).finally(() => setLoading(false));
  }

  return (
    <div
      className="login-screen"
      style={{ backgroundImage: `linear-gradient(135deg, rgba(14, 41, 38, .84), rgba(14, 65, 59, .78)), url(${loginBackground})` }}
    >
      <div className="login-screen-inner">
        <div className="brand-lockup">
          <BrandMark size={44} />
          <div>
            <div className="brand-name">Bhoomi Suraksha</div>
            <div className="brand-tag">Smart India Hackathon 2026 · PS 26191</div>
          </div>
        </div>

        <div className="login-card">
          <h1>Sign in</h1>
          <p className="subtitle">Hazard Red-Zone & Relocation Decision Support</p>
          <form onSubmit={(e) => submit(e)}>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@bhoomi.gov.in" required />
            </label>
            <label>
              Password
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required />
            </label>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="divider">
            <span>Demo access</span>
          </div>

          <div className="demo-logins">
            {DEMO_ACCESS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`demo-access-card ${d.id}`}
                onClick={() => loginWithDemo(d.id)}
              >
                <span className={`access-icon ${d.id}`}><AccessIcon type={d.icon} /></span>
                <span className="access-copy">
                  <span className="access-label">{d.label}</span>
                  <span className="access-desc">{d.description}</span>
                </span>
                <span className="access-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>

          <div className="official-footnote">
            For authorized personnel of State Disaster Management Authorities
          </div>
        </div>
      </div>
    </div>
  );
}
