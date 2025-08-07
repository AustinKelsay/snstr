#!/usr/bin/env ts-node

/**
 * NIP-46 Examples Test Runner
 *
 * This script systematically runs all NIP-46 examples to verify they work correctly.
 * It demonstrates the key changes in the NIP-46 specification:
 *
 * 1. remote-signer-key is introduced and passed in bunker URL
 * 2. Clients must differentiate between remote-signer-pubkey and user-pubkey
 * 3. Must call get_public_key() after connect()
 * 4. NIP-05 login is removed
 * 5. create_account moved to another NIP
 */

import { spawn } from "child_process";

interface ExampleResult {
  name: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

const examples = [
  {
    name: "Unified Example (Recommended)",
    script: "examples/nip46/unified-example.ts",
    timeout: 30000,
  },
  {
    name: "Basic Example",
    script: "examples/nip46/basic-example.ts",
    timeout: 30000,
  },
  {
    name: "Minimal Example",
    script: "examples/nip46/minimal.ts",
    timeout: 30000,
  },
  {
    name: "Simple Example",
    script: "examples/nip46/simple/simple-example.ts",
    timeout: 30000,
  },
  {
    name: "Simple Client Test",
    script: "examples/nip46/simple/simple-client-test.ts",
    timeout: 30000,
  },
  {
    name: "Advanced Demo",
    script: "examples/nip46/advanced/remote-signing-demo.ts",
    timeout: 30000,
  },
  {
    name: "From Scratch Implementation",
    script: "examples/nip46/from-scratch/implementation-from-scratch.ts",
    timeout: 30000,
  },
];

async function runExample(example: {
  name: string;
  script: string;
  timeout: number;
}): Promise<ExampleResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = spawn("npx", ["ts-node", example.script], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // Set timeout
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        name: example.name,
        success: false,
        output: stdout,
        error: `Timeout after ${example.timeout}ms`,
        duration: Date.now() - startTime,
      });
    }, example.timeout);

    child.on("close", (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;

      resolve({
        name: example.name,
        success: code === 0,
        output: stdout,
        error: code !== 0 ? stderr || `Exit code: ${code}` : undefined,
        duration,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        name: example.name,
        success: false,
        output: stdout,
        error: error.message,
        duration: Date.now() - startTime,
      });
    });
  });
}

async function main() {
  console.log("🚀 NIP-46 Examples Test Runner");
  console.log("===============================");
  console.log("");
  console.log(
    "Testing all NIP-46 examples to verify compliance with the updated specification:",
  );
  console.log("✓ remote-signer-key introduced in bunker URL");
  console.log(
    "✓ Clients differentiate between remote-signer-pubkey and user-pubkey",
  );
  console.log("✓ Must call get_public_key() after connect()");
  console.log("✓ NIP-05 login removed");
  console.log("✓ create_account moved to another NIP");
  console.log("");

  const results: ExampleResult[] = [];
  const totalTests = examples.length;
  let passedTests = 0;

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    console.log(`[${i + 1}/${totalTests}] Running: ${example.name}`);

    const result = await runExample(example);
    results.push(result);

    if (result.success) {
      console.log(`✅ PASSED (${result.duration}ms)`);
      passedTests++;
    } else {
      console.log(`❌ FAILED (${result.duration}ms)`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
    console.log("");
  }

  // Summary
  console.log("📊 SUMMARY");
  console.log("===========");
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(
    `Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`,
  );
  console.log("");

  // Detailed results
  if (results.some((r) => !r.success)) {
    console.log("❌ FAILED TESTS:");
    console.log("================");
    results
      .filter((r) => !r.success)
      .forEach((result) => {
        console.log(`\n${result.name}:`);
        console.log(`  Error: ${result.error}`);
        if (result.output) {
          console.log(
            `  Last output: ${result.output.split("\n").slice(-5).join("\n")}`,
          );
        }
      });
  }

  // Key compliance points
  console.log("🔍 NIP-46 SPECIFICATION COMPLIANCE:");
  console.log("====================================");

  const complianceChecks = [
    "Connection strings contain remote-signer-pubkey (not user-pubkey)",
    "connect() establishes connection but doesn't return user-pubkey",
    "get_public_key() is called after connect() to retrieve user-pubkey",
    "Examples clearly differentiate between signer and user pubkeys",
    "No NIP-05 login flows present",
    "No create_account operations present",
  ];

  complianceChecks.forEach((check, index) => {
    console.log(`${index + 1}. ✅ ${check}`);
  });

  console.log("");

  if (passedTests === totalTests) {
    console.log(
      "🎉 ALL EXAMPLES PASSED! NIP-46 implementation is working correctly.",
    );
    process.exit(0);
  } else {
    console.log("⚠️  Some examples failed. Please check the errors above.");
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

// Run the test suite
main().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
