import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const joinFunction = readFileSync("supabase/functions/join/index.ts", "utf8");
const hardeningMigration = readFileSync(
  "supabase/migrations/20260704000000_harden_join_submission_constraints.sql",
  "utf8",
);

test("join RPC no longer exposes a student-number quota branch", () => {
  assert.equal(
    joinFunction.includes("student_rate_limited"),
    false,
    "public join function must not expose a distinct student-number quota state",
  );
  assert.equal(
    hardeningMigration.includes("student_rate_limited"),
    false,
    "database RPC must not return a student-number quota code",
  );
  assert.equal(
    hardeningMigration.includes("where student_number = p_student_number"),
    false,
    "database RPC must not key a public quota only by student number",
  );
});

test("join RPC keeps network throttling and drops the old overloaded signature", () => {
  assert.match(
    hardeningMigration,
    /drop function if exists public\.create_join_submission\([\s\S]*p_recent_student_limit|drop function if exists public\.create_join_submission\([\s\S]*integer,\s*integer[\s\S]*\);/,
    "migration must remove the old student-limit RPC signature",
  );
  assert.match(
    hardeningMigration,
    /where ip_hash = p_ip_hash\s+and created_at >= p_rate_window_start/,
    "IP throttling must remain enforced in the RPC",
  );
  assert.match(
    joinFunction,
    /p_recent_ip_limit:\s*recentIpLimit/,
    "Edge Function must still pass the network throttle limit",
  );
  assert.equal(
    joinFunction.includes("p_recent_student_limit"),
    false,
    "Edge Function must not pass the removed student quota parameter",
  );
});

test("join network throttle is safe for shared school Wi-Fi", () => {
  assert.match(
    joinFunction,
    /const defaultRecentIpLimit = 200;/,
    "default network throttle must allow normal school Wi-Fi signup volume",
  );
  assert.match(
    joinFunction,
    /JOIN_RECENT_IP_LIMIT/,
    "network throttle must be configurable without code changes",
  );
  assert.doesNotMatch(
    joinFunction,
    /const recentIpLimit = 6;/,
    "network throttle must not block legitimate shared school NAT traffic",
  );
});
