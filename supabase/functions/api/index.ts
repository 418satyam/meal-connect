import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Role = "restaurant" | "ngo" | "volunteer" | "admin";
type Handler = (req: Request, params: Record<string, string>) => Promise<Response> | Response;
interface Route { method: string; pattern: RegExp; keys: string[]; handler: Handler; }

const routes: Route[] = [];

function addRoute(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" + path.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$"
  );
  routes.push({ method, pattern, keys, handler });
}
const get = (p: string, h: Handler) => addRoute("GET", p, h);
const post = (p: string, h: Handler) => addRoute("POST", p, h);
const put = (p: string, h: Handler) => addRoute("PUT", p, h);

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function bodyOf(req: Request): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

interface AuthContext { userId: string; profile: any; }

async function authContext(req: Request): Promise<AuthContext> {
  const auth = req.headers.get("Authorization") || "";
  const supa = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Unauthorized");
  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile) throw new HttpError(404, "Profile not found");
  return { userId: data.user.id, profile };
}

async function requireRole(req: Request, ...roles: Role[]): Promise<AuthContext> {
  const ctx = await authContext(req);
  if (!roles.includes(ctx.profile.role)) throw new HttpError(403, "Forbidden");
  if (ctx.profile.status === "suspended") throw new HttpError(403, "Account suspended");
  return ctx;
}

function clientWithAuth(req: Request) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
}

// ---------------- AUTH ----------------
post("/api/auth/register", async (req) => {
  const b = await bodyOf(req);
  const { email, password, role, ...rest } = b;
  if (!email || !password || !role) return json({ error: "email, password, role are required" }, 400);
  if (!["restaurant", "ngo", "volunteer"].includes(role)) return json({ error: "Invalid role" }, 400);
  if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

  const admin = adminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) return json({ error: "Email already registered" }, 409);

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return json({ error: error.message }, 400);

  const profile: any = {
    id: data.user.id, email, role, status: "pending",
    name: rest.name || "", phone: rest.phone || "", address: rest.address || "",
  };
  if (role === "restaurant") {
    profile.owner_name = rest.owner_name || rest.name || "";
    profile.operating_hours = rest.operating_hours || "";
  } else if (role === "ngo") {
    profile.organization_name = rest.organization_name || rest.name || "";
    profile.registration_number = rest.registration_number || "";
    profile.contact_person = rest.contact_person || rest.name || "";
    profile.service_area = rest.service_area || "";
    profile.meal_capacity = rest.meal_capacity || null;
    profile.storage_capacity = rest.storage_capacity || "";
    profile.refrigeration_available = !!rest.refrigeration_available;
    profile.accepted_food_types = rest.accepted_food_types || [];
  } else if (role === "volunteer") {
    profile.vehicle_type = rest.vehicle_type || "";
    profile.availability = rest.availability || "";
  }
  const { error: perr } = await admin.from("profiles").insert(profile);
  if (perr) return json({ error: perr.message }, 400);
  return json({ id: data.user.id, email, role }, 201);
});

post("/api/auth/login", async (req) => {
  const b = await bodyOf(req);
  const { email, password } = b;
  if (!email || !password) return json({ error: "email and password required" }, 400);
  const supa = createClient(SUPABASE_URL, ANON_KEY);
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json({ error: "Invalid credentials" }, 401);
  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile) return json({ error: "Profile not found" }, 404);
  if (profile.status === "suspended") return json({ error: "Account suspended" }, 403);
  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: { id: data.user.id, email: data.user.email, profile },
  });
});

get("/api/auth/me", async (req) => {
  const ctx = await authContext(req);
  return json({ id: ctx.userId, email: ctx.profile.email, profile: ctx.profile });
});

// ---------------- DONATIONS ----------------
post("/api/donations", async (req) => {
  const ctx = await requireRole(req, "restaurant");
  const b = await bodyOf(req);
  const required = ["food_name","category","food_type","quantity","unit","estimated_servings",
    "preparation_time","expiry_time","pickup_address","pickup_date","pickup_start_time",
    "pickup_deadline","contact_person","contact_number"];
  for (const k of required) if (!b[k]) return json({ error: `Missing field: ${k}` }, 400);
  if (!b.safety_confirmed) return json({ error: "Food safety confirmation required" }, 400);
  const admin = adminClient();
  const { data, error } = await admin.from("donations").insert({
    restaurant_id: ctx.userId, food_name: b.food_name, category: b.category, food_type: b.food_type,
    description: b.description || null, quantity: b.quantity, unit: b.unit,
    estimated_servings: b.estimated_servings, preparation_time: b.preparation_time,
    expiry_time: b.expiry_time, packaging: b.packaging || null, allergens: b.allergens || null,
    storage_requirements: b.storage_requirements || null, food_condition: b.food_condition || null,
    image: b.image || null, pickup_address: b.pickup_address, pickup_date: b.pickup_date,
    pickup_start_time: b.pickup_start_time, pickup_deadline: b.pickup_deadline,
    contact_person: b.contact_person, contact_number: b.contact_number,
    pickup_instructions: b.pickup_instructions || null, safety_confirmed: true, status: "waiting_for_ngo",
  }).select().single();
  if (error) return json({ error: error.message }, 400);
  return json(data, 201);
});

get("/api/donations", async (req) => {
  const ctx = await authContext(req);
  const url = new URL(req.url);
  const admin = adminClient();
  let q = admin.from("donations").select("*, restaurant:profiles!donations_restaurant_id_fkey(*), ngo:profiles!donations_ngo_id_fkey(*), volunteer:profiles!donations_volunteer_id_fkey(*)").order("created_at", { ascending: false });
  if (ctx.profile.role === "restaurant") q = q.eq("restaurant_id", ctx.userId);
  else if (ctx.profile.role === "ngo") {
    const mine = url.searchParams.get("mine");
    if (mine === "1") q = q.eq("ngo_id", ctx.userId);
    else q = q.or(`ngo_id.eq.${ctx.userId},status.eq.waiting_for_ngo`);
  } else if (ctx.profile.role === "volunteer") {
    q = q.or(`volunteer_id.eq.${ctx.userId},status.eq.ngo_accepted`);
  }
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

get("/api/donations/:id", async (req, { id }) => {
  await authContext(req);
  const admin = adminClient();
  const { data, error } = await admin.from("donations")
    .select("*, restaurant:profiles!donations_restaurant_id_fkey(*), ngo:profiles!donations_ngo_id_fkey(*), volunteer:profiles!donations_volunteer_id_fkey(*)")
    .eq("id", id).maybeSingle();
  if (error || !data) return json({ error: "Not found" }, 404);
  return json(data);
});

post("/api/donations/:id/accept", async (req, { id }) => {
  const ctx = await requireRole(req, "ngo");
  const admin = adminClient();
  const { data, error } = await admin.rpc("transition_donation", { p_donation_id: id, p_action: "accept_ngo", p_actor_id: ctx.userId, p_extra: {} });
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

post("/api/donations/:id/cancel", async (req, { id }) => {
  const ctx = await authContext(req);
  const admin = adminClient();
  const { data, error } = await admin.rpc("transition_donation", { p_donation_id: id, p_action: "cancel", p_actor_id: ctx.userId, p_extra: {} });
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

// ---------------- DELIVERIES ----------------
get("/api/deliveries", async (req) => {
  const ctx = await authContext(req);
  const admin = adminClient();
  let q = admin.from("deliveries").select("*, donation:donations(*), restaurant:profiles!deliveries_restaurant_id_fkey(*), ngo:profiles!deliveries_ngo_id_fkey(*), volunteer:profiles!deliveries_volunteer_id_fkey(*)").order("created_at", { ascending: false });
  if (ctx.profile.role === "restaurant") q = q.eq("restaurant_id", ctx.userId);
  else if (ctx.profile.role === "ngo") q = q.eq("ngo_id", ctx.userId);
  else if (ctx.profile.role === "volunteer") {
    const mine = new URL(req.url).searchParams.get("mine");
    if (mine === "1") q = q.eq("volunteer_id", ctx.userId);
    else q = q.or(`volunteer_id.eq.${ctx.userId},status.eq.assigned`);
  }
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

get("/api/deliveries/:id", async (req, { id }) => {
  await authContext(req);
  const admin = adminClient();
  const { data, error } = await admin.from("deliveries")
    .select("*, donation:donations(*), restaurant:profiles!deliveries_restaurant_id_fkey(*), ngo:profiles!deliveries_ngo_id_fkey(*), volunteer:profiles!deliveries_volunteer_id_fkey(*)")
    .eq("id", id).maybeSingle();
  if (error || !data) return json({ error: "Not found" }, 404);
  return json(data);
});

async function getDonationIdFromDelivery(id: string): Promise<string | null> {
  const admin = adminClient();
  const { data } = await admin.from("deliveries").select("donation_id").eq("id", id).maybeSingle();
  return data?.donation_id || null;
}

async function transitionForDelivery(id: string, action: string, ctx: AuthContext, extra: any = {}) {
  const donationId = await getDonationIdFromDelivery(id);
  if (!donationId) return json({ error: "Delivery not found" }, 404);
  const admin = adminClient();
  const { data, error } = await admin.rpc("transition_donation", { p_donation_id: donationId, p_action: action, p_actor_id: ctx.userId, p_extra: extra });
  if (error) return json({ error: error.message }, 400);
  return json(data);
}

post("/api/deliveries/:id/accept", async (req, { id }) => {
  const ctx = await requireRole(req, "volunteer");
  return transitionForDelivery(id, "assign_volunteer", ctx);
});
post("/api/deliveries/:id/arrive", async (req, { id }) => {
  const ctx = await requireRole(req, "volunteer");
  return transitionForDelivery(id, "arrive_restaurant", ctx);
});
post("/api/deliveries/:id/verify-pickup", async (req, { id }) => {
  const ctx = await requireRole(req, "volunteer");
  const b = await bodyOf(req);
  if (!b.qr_token) return json({ error: "qr_token required" }, 400);
  return transitionForDelivery(id, "verify_pickup", ctx, { qr_token: b.qr_token });
});
post("/api/deliveries/:id/start", async (req, { id }) => {
  const ctx = await requireRole(req, "volunteer");
  return transitionForDelivery(id, "start_delivery", ctx);
});
post("/api/deliveries/:id/arrive-ngo", async (req, { id }) => {
  const ctx = await requireRole(req, "volunteer");
  return transitionForDelivery(id, "arrive_ngo", ctx);
});
post("/api/deliveries/:id/complete", async (req, { id }) => {
  const ctx = await requireRole(req, "ngo");
  const b = await bodyOf(req);
  return transitionForDelivery(id, "confirm_receipt", ctx, { received_quantity: b.received_quantity || "", notes: b.notes || "" });
});

// ---------------- NOTIFICATIONS ----------------
get("/api/notifications", async (req) => {
  const ctx = await authContext(req);
  const supa = clientWithAuth(req);
  const { data, error } = await supa.from("notifications").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

put("/api/notifications/:id/read", async (req, { id }) => {
  const ctx = await authContext(req);
  const supa = clientWithAuth(req);
  const { data, error } = await supa.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", ctx.userId).select().single();
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

put("/api/notifications/read-all", async (req) => {
  const ctx = await authContext(req);
  const supa = clientWithAuth(req);
  const { error } = await supa.from("notifications").update({ is_read: true }).eq("user_id", ctx.userId).eq("is_read", false);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
});

// ---------------- PROFILE ----------------
get("/api/profile", async (req) => {
  const ctx = await authContext(req);
  return json(ctx.profile);
});

put("/api/profile", async (req) => {
  const ctx = await authContext(req);
  const b = await bodyOf(req);
  const allowed: any = {};
  const fields = ["name","phone","address","owner_name","operating_hours","organization_name",
    "registration_number","contact_person","service_area","meal_capacity","storage_capacity",
    "refrigeration_available","accepted_food_types","vehicle_type","availability"];
  for (const f of fields) if (f in b) allowed[f] = b[f];
  const supa = clientWithAuth(req);
  const { data, error } = await supa.from("profiles").update(allowed).eq("id", ctx.userId).select().single();
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

// ---------------- ADMIN ----------------
get("/api/admin/dashboard", async (req) => {
  const ctx = await requireRole(req, "admin");
  const admin = adminClient();
  const [users, donations, deliveries] = await Promise.all([
    admin.from("profiles").select("role,status"),
    admin.from("donations").select("status,quantity,estimated_servings"),
    admin.from("deliveries").select("status"),
  ]);
  const completed = (donations.data || []).filter((d: any) => d.status === "completed");
  return json({
    total_users: users.data?.length || 0,
    restaurants: users.data?.filter((u: any) => u.role === "restaurant").length || 0,
    ngos: users.data?.filter((u: any) => u.role === "ngo").length || 0,
    volunteers: users.data?.filter((u: any) => u.role === "volunteer").length || 0,
    total_donations: donations.data?.length || 0,
    active_donations: donations.data?.filter((d: any) => !["completed","cancelled","expired"].includes(d.status)).length || 0,
    completed_donations: completed.length,
    active_deliveries: deliveries.data?.filter((d: any) => !["completed","cancelled"].includes(d.status)).length || 0,
    food_rescued: completed.reduce((s: number, d: any) => s + Number(d.quantity), 0),
    meals_distributed: completed.reduce((s: number, d: any) => s + (d.estimated_servings || 0), 0),
  });
});

get("/api/admin/users", async (req) => {
  const ctx = await requireRole(req, "admin");
  const admin = adminClient();
  const role = new URL(req.url).searchParams.get("role");
  let q = admin.from("profiles").select("*").order("created_at", { ascending: false });
  if (role) q = q.eq("role", role);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

put("/api/admin/users/:id/status", async (req, { id }) => {
  const ctx = await requireRole(req, "admin");
  const b = await bodyOf(req);
  const status = b.status;
  if (!["pending","verified","rejected","suspended"].includes(status)) return json({ error: "Invalid status" }, 400);
  const admin = adminClient();
  const { data, error } = await admin.rpc("admin_set_user_status", { p_target: id, p_status: status });
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

get("/api/admin/donations", async (req) => {
  const ctx = await requireRole(req, "admin");
  const admin = adminClient();
  const { data, error } = await admin.from("donations")
    .select("*, restaurant:profiles!donations_restaurant_id_fkey(*), ngo:profiles!donations_ngo_id_fkey(*), volunteer:profiles!donations_volunteer_id_fkey(*)")
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

get("/api/admin/deliveries", async (req) => {
  const ctx = await requireRole(req, "admin");
  const admin = adminClient();
  const { data, error } = await admin.from("deliveries")
    .select("*, donation:donations(*), restaurant:profiles!deliveries_restaurant_id_fkey(*), ngo:profiles!deliveries_ngo_id_fkey(*), volunteer:profiles!deliveries_volunteer_id_fkey(*)")
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 400);
  return json(data);
});

// ---------------- SERVER ----------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let path = url.pathname;
    // Strip any mount prefix; keep the /api/... route portion.
    const apiIdx = path.indexOf("/api/");
    if (apiIdx > 0) path = path.slice(apiIdx);
    if (!path.startsWith("/")) path = "/" + path;
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.pattern.exec(path);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return await r.handler(req, params);
    }
    return json({ error: "Not found", path }, 404);
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || "Server error" }, status);
  }
});
