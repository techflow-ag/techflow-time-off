import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Verify caller
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { employeeName, leaveType, startDate, endDate, numberOfDays, reason } = await req.json();

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get all admin user IDs
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = (adminRoles || []).map((r) => r.user_id);

    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No admins to notify" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create in-app notifications for each admin
    const notifications = adminIds.map((adminId) => ({
      user_id: adminId,
      title: "New Leave Request",
      message: `${employeeName} requested ${numberOfDays} day(s) of ${leaveType.replace("_", " ")} from ${startDate} to ${endDate}.${reason ? ` Reason: ${reason}` : ""}`,
      link: "/dashboard",
    }));

    const { error: notifError } = await adminClient
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      console.error("Failed to insert notifications:", notifError);
    }

    // 2. Send email notifications if Resend is configured
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      // Get admin emails
      const { data: adminProfiles } = await adminClient
        .from("profiles")
        .select("email, first_name")
        .in("id", adminIds);

      for (const admin of adminProfiles || []) {
        if (!admin.email) continue;
        try {
          await resend.emails.send({
            from: "Techflow Leave Manager <onboarding@resend.dev>",
            to: [admin.email],
            subject: `New Leave Request from ${employeeName}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #1a1a2e; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Techflow Leave Manager</h1>
                </div>
                <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <h2 style="color: #1a1a2e; margin-top: 0;">New Leave Request</h2>
                  <p style="color: #374151;">Hi ${admin.first_name || "Admin"},</p>
                  <p style="color: #374151;"><strong>${employeeName}</strong> has submitted a leave request:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px 0; color: #6b7280;">Type</td><td style="padding: 8px 0; color: #111827; font-weight: 500;">${leaveType.replace("_", " ")}</td></tr>
                    <tr><td style="padding: 8px 0; color: #6b7280;">Dates</td><td style="padding: 8px 0; color: #111827; font-weight: 500;">${startDate} → ${endDate}</td></tr>
                    <tr><td style="padding: 8px 0; color: #6b7280;">Days</td><td style="padding: 8px 0; color: #111827; font-weight: 500;">${numberOfDays}</td></tr>
                    ${reason ? `<tr><td style="padding: 8px 0; color: #6b7280;">Reason</td><td style="padding: 8px 0; color: #111827;">${reason}</td></tr>` : ""}
                  </table>
                  <a href="https://techflow-time-off.lovable.app/dashboard" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 8px;">Review Request</a>
                </div>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error(`Failed to email ${admin.email}:`, emailErr);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in notify-leave-request:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
