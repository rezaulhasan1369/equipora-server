import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("Windows private helper categorizes failures without disclosing inputs or changing saved providers", { skip: process.platform !== "win32" }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "equipora-provider-test-"));
  const helper = path.resolve("scripts/local-providers.ps1").replaceAll("'", "''");
  const config = path.join(directory, "Equipora/providers.xml");
  function invoke(provider: string, values: string[], action = "Set") {
    // Synthetic fixtures only. Override the masked prompt in this child process;
    // never read the owner's provider file or CLI credentials.
    const encoded = Buffer.from(JSON.stringify(values)).toString("base64");
    const command = `$ErrorActionPreference='Stop';$global:entries=ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')));$global:index=0;function global:Read-Host {param($Prompt,[switch]$AsSecureString);if($global:index -ge $global:entries.Count){throw 'Unexpected prompt'};$v=$global:entries[$global:index];$global:index++;ConvertTo-SecureString -String $v -AsPlainText -Force};& '${helper}' -Action ${action} -Provider ${provider}`;
    const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
      env: { ...process.env, LOCALAPPDATA: directory }, encoding: "utf8", timeout: 15000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.stderr, "");
    for (const value of values) if(value.length > 8) assert.ok(!result.stdout.includes(value));
    return { code: result.status, data: JSON.parse(result.stdout.trim()) };
  }
  try {
    const google = invoke("Google", ["fixture.apps.googleusercontent.com", "synthetic-google-secret"]);
    assert.equal(google.code, 0, JSON.stringify(google.data));
    assert.equal(invoke("Imgbb", ["synthetic-imgbb-secret"]).code, 0);
    const original = readFileSync(config);
    const cases = [
      ["rk_test_synthetic-canary", "stripe_restricted_test_key_unsupported"],
      ["sk_live_synthetic-canary", "stripe_live_key_forbidden"],
      ["rk_live_synthetic-canary", "stripe_live_key_forbidden"],
      ["pk_test_synthetic-canary", "stripe_publishable_key_not_secret"],
      ["not-a-key-synthetic-canary", "stripe_test_secret_format_required"],
      ["rkcs_live_syntheticCanary", "stripe_test_secret_format_required"],
      ["rkcs_test_", "stripe_test_secret_format_required"],
      ["rkcs_test_invalid-canary", "stripe_test_secret_format_required"],
      ["RKCS_test_syntheticCanary", "stripe_test_secret_format_required"],
      [" sk_test_synthetic-canary", "credential_surrounding_whitespace"],
      ["sk_test_synthetic\ncanary", "credential_control_character"],
      [" ", "credential_empty"],
      ["x".repeat(4097), "credential_too_long"],
    ];
    for (const [value, category] of cases) {
      const result = invoke("Stripe", [value]);
      assert.equal(result.code, 1);
      assert.equal(result.data.category, category);
      assert.equal(result.data.stage, "validate_stripe_secret_key");
      assert.equal(result.data.valuesSuppressed, true);
      assert.deepEqual(readFileSync(config), original);
    }
    const badWebhook = invoke("Stripe", ["sk_test_syntheticCanary", "bad-webhook-canary"]);
    assert.equal(badWebhook.data.category, "stripe_webhook_secret_format_required");
    assert.deepEqual(readFileSync(config), original);
    assert.equal(invoke("Stripe", ["sk_test_syntheticCanary", "whsec_synthetic-canary"]).code, 0);
    assert.equal(invoke("Stripe", ["rkcs_test_syntheticCanary", "whsec_synthetic-canary"]).code, 0);
    assert.deepEqual(invoke("Stripe", [], "Status").data, {
      encryptedFilePresent: true, googleConfigured: true, stripeTestConfigured: true,
      imgbbConfigured: true, valuesPrinted: false,
    });
    // Verify exact preservation inside DPAPI, returning only a boolean.
    const verification = spawnSync("powershell.exe", ["-NoProfile", "-Command", "$s=Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'Equipora/providers.xml');$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{$v=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)|ConvertFrom-Json;($v.GOOGLE_CLIENT_SECRET -ceq 'synthetic-google-secret' -and $v.IMGBB_API_KEY -ceq 'synthetic-imgbb-secret')}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}"], { env: {...process.env, LOCALAPPDATA: directory}, encoding: "utf8", timeout:15000 });
    assert.equal(verification.status, 0);
    assert.equal(verification.stdout.trim(), "True");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
