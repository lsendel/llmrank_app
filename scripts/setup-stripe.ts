/**
 * Setup script to automatically create Stripe Products and Prices for LLM Rank.
 * 
 * Usage:
 * 1. Create a new Stripe Account for LLM Rank.
 * 2. Get the new Secret Key (sk_test_...) and put it in your .env file
 * 3. Run this script: npx tsx scripts/setup-stripe.ts
 */

import * as fs from "fs";
import * as path from "path";

// 1. Get the secret key from the environment
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
    console.error("❌ STRIPE_SECRET_KEY is not set in your environment.");
    console.error("Please load your .env file or export the variable before running this script.");
    console.error("Example: STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/setup-stripe.ts");
    process.exit(1);
}

const PLANS = [
    {
        name: "LLM Rank Starter",
        code: "starter",
        price: 7900, // $79.00
        description: "Perfect for indie hackers and small projects.",
    },
    {
        name: "LLM Rank Pro",
        code: "pro",
        price: 14900, // $149.00
        description: "For growing apps needing more analysis power.",
    },
    {
        name: "LLM Rank Agency",
        code: "agency",
        price: 29900, // $299.00
        description: "For agencies and high-volume rank tracking.",
    },
];

function encodeFormData(params: Record<string, string>): string {
    return Object.entries(params)
        .map(([k, v]) => \`\${encodeURIComponent(k)}=\${encodeURIComponent(v)}\`)
    .join("&");
}

async function stripeRequest<T>(method: string, endpoint: string, body?: Record<string, string>): Promise<T> {
  const url = \`https://api.stripe.com/v1\${endpoint}\`;
  const headers: Record<string, string> = {
    Authorization: \`Bearer \${secretKey}\`,
  };

  const init: RequestInit = { method, headers };

  if (body && (method === "POST" || method === "PATCH")) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = encodeFormData(body);
  }

  const res = await fetch(url, init);
  const json = await res.json();

  if (!res.ok) {
    const errMsg = (json as any).error?.message ?? \`Stripe API error \${res.status}\`;
    throw new Error(errMsg);
  }

  return json as T;
}

async function setup() {
  console.log("🚀 Starting Stripe product setup for LLM Rank...");

  const planMap: Record<string, string> = {};

  for (const plan of PLANS) {
    console.log(\`\\n📦 Creating Product: \${plan.name}...\`);
    
    // Create the Product
    const product = await stripeRequest<any>("POST", "/products", {
      name: plan.name,
      description: plan.description,
      "metadata[plan_code]": plan.code,
    });
    
    console.log(\`✅ Product created: \${product.id}\`);

    // Create the Price
    const price = await stripeRequest<any>("POST", "/prices", {
      product: product.id,
      unit_amount: plan.price.toString(),
      currency: "usd",
      "recurring[interval]": "month",
      "metadata[plan_code]": plan.code,
    });

    console.log(\`✅ Price created: \${price.id} ($\${plan.price / 100}/mo)\`);

    // Store the mapping
    planMap[price.id] = plan.code;
  }

  // Generate the new plan-map.ts content
  console.log("\\n📝 Generating new packages/billing/src/plan-map.ts...");

  let planMapFileContent = \`export const STRIPE_PLAN_MAP: Record<string, string> = {\\n\`;
  for (const [priceId, code] of Object.entries(planMap)) {
    const plan = PLANS.find(p => p.code === code);
    planMapFileContent += \`  // \${plan?.name}: $\${(plan?.price || 0) / 100}/mo\\n\`;
    planMapFileContent += \`  "\${priceId}": "\${code}",\\n\`;
  }
  planMapFileContent += \`};\n\n\`;
  planMapFileContent += \`export const PLAN_TO_PRICE: Record<string, string> = Object.fromEntries(
  Object.entries(STRIPE_PLAN_MAP).map(([priceId, planCode]) => [
    planCode,
    priceId,
  ]),
);

export function planCodeFromPriceId(priceId: string): string | undefined {
  return STRIPE_PLAN_MAP[priceId];
}

export function priceIdFromPlanCode(planCode: string): string | undefined {
  return PLAN_TO_PRICE[planCode];
}
\`;

  const mapFilePath = path.join(__dirname, "../packages/billing/src/plan-map.ts");
  
  if (fs.existsSync(mapFilePath)) {
    fs.writeFileSync(mapFilePath, planMapFileContent, "utf-8");
    console.log(\`✅ Updated \${mapFilePath} successfully!\`);
  } else {
    console.error(\`❌ Could not find plan-map.ts at \${mapFilePath}. Please update it manually with the following:\`);
    console.log(planMapFileContent);
  }

  console.log("\\n🎉 Stripe setup complete!");
  console.log("\\nNext Steps:");
  console.log("1. Ensure your STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in .env are using the new LLM Rank account keys.");
  console.log("2. Restart your Next.js dev server.");
}

setup().catch(console.error);
