import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const PASSWORD = "foodbridge123";

interface SeedUser {
  email: string;
  role: string;
  profile: Record<string, any>;
}

const users: SeedUser[] = [
  {
    email: "admin@foodbridge.com",
    role: "admin",
    profile: { name: "System Admin", phone: "9000000000", address: "FoodBridge HQ, Bengaluru", status: "verified" },
  },
  {
    email: "restaurant@foodbridge.com",
    role: "restaurant",
    profile: {
      name: "Spice Garden Restaurant", phone: "9876543210", address: "12 MG Road, Bengaluru, KA 560001",
      owner_name: "Rajesh Sharma", operating_hours: "11:00 AM - 11:00 PM", status: "verified",
    },
  },
  {
    email: "restaurant2@foodbridge.com",
    role: "restaurant",
    profile: {
      name: "Annapurna Kitchen", phone: "9876543211", address: "45 Brigade Road, Bengaluru, KA 560025",
      owner_name: "Priya Iyer", operating_hours: "9:00 AM - 10:00 PM", status: "verified",
    },
  },
  {
    email: "restaurant3@foodbridge.com",
    role: "restaurant",
    profile: {
      name: "Punjab Grill House", phone: "9876543212", address: "78 Indiranagar, Bengaluru, KA 560038",
      owner_name: "Harpreet Singh", operating_hours: "12:00 PM - 12:00 AM", status: "verified",
    },
  },
  {
    email: "ngo@foodbridge.com",
    role: "ngo",
    profile: {
      name: "Hope Foundation", organization_name: "Hope Foundation",
      registration_number: "NGO/BLR/2018/0042", contact_person: "Anita Rao",
      phone: "9123456780", address: "23 Koramangala, Bengaluru, KA 560034",
      service_area: "Koramangala, Indiranagar, MG Road", meal_capacity: 200,
      storage_capacity: "Medium", refrigeration_available: true,
      accepted_food_types: ["Vegetarian", "Non-Vegetarian"], status: "verified",
    },
  },
  {
    email: "ngo2@foodbridge.com",
    role: "ngo",
    profile: {
      name: "Smile Trust", organization_name: "Smile Trust",
      registration_number: "NGO/BLR/2019/0117", contact_person: "David Thomas",
      phone: "9123456781", address: "9 Jayanagar, Bengaluru, KA 560011",
      service_area: "Jayanagar, JP Nagar", meal_capacity: 150,
      storage_capacity: "Small", refrigeration_available: false,
      accepted_food_types: ["Vegetarian"], status: "verified",
    },
  },
  {
    email: "ngo3@foodbridge.com",
    role: "ngo",
    profile: {
      name: "Ashraya Foundation", organization_name: "Ashraya Foundation",
      registration_number: "NGO/BLR/2020/0331", contact_person: "Lakshmi Nair",
      phone: "9123456782", address: "56 Whitefield, Bengaluru, KA 560066",
      service_area: "Whitefield, Marathahalli", meal_capacity: 300,
      storage_capacity: "Large", refrigeration_available: true,
      accepted_food_types: ["Vegetarian", "Non-Vegetarian", "Vegan"], status: "verified",
    },
  },
  {
    email: "volunteer@foodbridge.com",
    role: "volunteer",
    profile: {
      name: "Arjun Kumar", phone: "9988776655", address: "18 HSR Layout, Bengaluru, KA 560102",
      vehicle_type: "Two-wheeler", availability: "Weekdays evening, Weekends full day", status: "verified",
    },
  },
  {
    email: "volunteer2@foodbridge.com",
    role: "volunteer",
    profile: {
      name: "Sneha Reddy", phone: "9988776656", address: "34 BTM Layout, Bengaluru, KA 560076",
      vehicle_type: "Car", availability: "All days", status: "verified",
    },
  },
  {
    email: "volunteer3@foodbridge.com",
    role: "volunteer",
    profile: {
      name: "Mohammed Khan", phone: "9988776657", address: "67 Electronic City, Bengaluru, KA 560100",
      vehicle_type: "Bicycle", availability: "Weekends", status: "verified",
    },
  },
];

async function ensureUser(u: SeedUser): Promise<string> {
  const { data: existing } = await admin.from("profiles").select("id").eq("email", u.email).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email, password: PASSWORD, email_confirm: true,
  });
  if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
  const { error: perr } = await admin.from("profiles").insert({
    id: data.user.id, email: u.email, role: u.role, ...u.profile,
  });
  if (perr) throw new Error(`profile ${u.email}: ${perr.message}`);
  return data.user.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const ids: Record<string, string> = {};
    for (const u of users) ids[u.email] = await ensureUser(u);

    // Sample donation from restaurant@foodbridge.com
    const restId = ids["restaurant@foodbridge.com"];
    const { data: d0 } = await admin.from("donations").select("id").eq("restaurant_id", restId).limit(1).maybeSingle();
    if (!d0) {
      const now = new Date();
      const prep = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const exp = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
      await admin.from("donations").insert({
        restaurant_id: restId,
        food_name: "Veg Biryani with Raita",
        category: "Cooked Meals",
        food_type: "Vegetarian",
        description: "Freshly prepared vegetable biryani with cucumber raita. Sealed in food-grade containers.",
        quantity: 40, unit: "servings", estimated_servings: 40,
        preparation_time: prep, expiry_time: exp,
        packaging: "Food-grade sealed containers", allergens: "Dairy (raita)",
        storage_requirements: "Consume within 6 hours", food_condition: "Fresh",
        pickup_address: "12 MG Road, Bengaluru, KA 560001",
        pickup_date: now.toISOString().slice(0, 10),
        pickup_start_time: "13:00", pickup_deadline: "15:00",
        contact_person: "Rajesh Sharma", contact_number: "9876543210",
        pickup_instructions: "Ask for manager at front desk", safety_confirmed: true,
        status: "waiting_for_ngo",
      });
    }
    return new Response(JSON.stringify({ ok: true, users: ids }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
