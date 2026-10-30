import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    let expiredCount = 0;
    let rescueCount = 0;
    let notifiedCount = 0;

    // 1. Mark expired donations
    const { data: expired, error: expErr } = await supabase
      .from('donations')
      .select('id, food_name, restaurant_id, ngo_id, volunteer_id, estimated_servings, expiry_time')
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .neq('status', 'expired')
      .lt('expiry_time', now.toISOString());

    if (expErr) throw expErr;

    for (const d of expired || []) {
      const { error: upErr } = await supabase
        .from('donations')
        .update({ status: 'expired', priority: 'normal', rescue_mode: false, updated_at: now.toISOString() })
        .eq('id', d.id);
      if (upErr) continue;

      await supabase.from('donations').update({ status: 'expired' }).eq('id', d.id);
      await supabase.from('deliveries').update({ status: 'cancelled', updated_at: now.toISOString() }).eq('donation_id', d.id);

      // Log event
      await supabase.from('donation_events').insert({
        donation_id: d.id,
        event_type: 'expired',
        previous_status: 'active',
        new_status: 'expired',
        reason: 'Food expired before delivery completed',
      });

      // Notify parties
      await supabase.from('notifications').insert([
        { user_id: d.restaurant_id, title: 'Donation Expired', message: `"${d.food_name}" (${d.estimated_servings} servings) has expired and could not be rescued.`, type: 'error' },
        ...(d.ngo_id ? [{ user_id: d.ngo_id, title: 'Donation Expired', message: `"${d.food_name}" has expired.`, type: 'warning' }] : []),
        ...(d.volunteer_id ? [{ user_id: d.volunteer_id, title: 'Donation Expired', message: `Delivery task for "${d.food_name}" was cancelled — food expired.`, type: 'warning' }] : []),
      ]);
      expiredCount++;
    }

    // 2. Auto-trigger rescue mode for donations under 10 minutes to expiry (that are still active)
    const rescueThreshold = new Date(now.getTime() + 10 * 60000);
    const { data: rescueCandidates, error: rescErr } = await supabase
      .from('donations')
      .select('id, food_name, estimated_servings, restaurant_id, ngo_id, rescue_mode, expiry_time')
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .neq('status', 'expired')
      .eq('rescue_mode', false)
      .lt('expiry_time', rescueThreshold.toISOString());

    if (rescErr) throw rescErr;

    for (const d of rescueCandidates || []) {
      const { error: upErr } = await supabase
        .from('donations')
        .update({ rescue_mode: true, priority: 'rescue', escalation_count: 1, updated_at: now.toISOString() })
        .eq('id', d.id);
      if (upErr) continue;

      await supabase.from('donation_events').insert({
        donation_id: d.id,
        event_type: 'rescue_started',
        previous_status: null,
        new_status: null,
        reason: 'Auto-rescue: less than 10 minutes to expiry',
      });

      // Notify restaurant
      await supabase.from('notifications').insert({
        user_id: d.restaurant_id,
        title: 'RESCUE MODE activated',
        message: `Your donation "${d.food_name}" has entered rescue mode. ${d.estimated_servings} meals are at risk. We are urgently finding help.`,
        type: 'warning',
      });
      notifiedCount++;
      rescueCount++;
    }

    // 3. Update priority for active donations based on time remaining
    const { data: active } = await supabase
      .from('donations')
      .select('id, expiry_time, status')
      .not('status', 'in', '("completed","cancelled","expired")');

    for (const d of active || []) {
      const minsLeft = (new Date(d.expiry_time).getTime() - now.getTime()) / 60000;
      let priority = 'normal';
      if (minsLeft <= 10) priority = 'rescue';
      else if (minsLeft <= 30) priority = 'critical';
      else if (minsLeft <= 60) priority = 'high';
      else if (minsLeft <= 120) priority = 'medium';

      await supabase.from('donations')
        .update({ priority })
        .eq('id', d.id)
        .neq('status', 'expired');
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired: expiredCount,
        rescue_triggered: rescueCount,
        notified: notifiedCount,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
