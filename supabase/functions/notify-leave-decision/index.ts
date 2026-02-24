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

    const { employeeId, employeeName, employeeEmail, status, startDate, endDate, numberOfDays, leaveType, adminComment } = await req.json();

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const isApproved = status === "approved";
    const title = isApproved ? "Leave Approved ✅" : "Leave Rejected ❌";
    const message = `Your ${leaveType.replace("_", " ")} request (${startDate} → ${endDate}, ${numberOfDays} days) has been ${status}.${adminComment ? ` Comment: ${adminComment}` : ""}`;

    // In-app notification
    await adminClient.from("notifications").insert({
      user_id: employeeId,
      title,
      message,
      link: "/my-leave",
    });

    // Email notification
    if (resendApiKey && employeeEmail) {
      const resend = new Resend(resendApiKey);
      try {
        await resend.emails.send({
          from: "Techflow Leave Manager <onboarding@resend.dev>",
          to: [employeeEmail],
          subject: `Leave Request ${isApproved ? "Approved" : "Rejected"}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #1a1a2e; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Techflow Leave Manager</h1>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <h2 style="color: ${isApproved ? "#059669" : "#dc2626"}; margin-top: 0;">Leave ${isApproved ? "Approved ✅" : "Rejected ❌"}</h2>
                <p style="color: #374151;">Hi ${employeeName},</p>
                <p style="color: #374151;">Your leave request has been <strong>${status}</strong>.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <tr><td style="padding: 8px 0; color: #6b7280;">Type</td><td style="padding: 8px 0; color: #111827; font-weight: 500;">${leaveType.replace("_", " ")}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Dates</td><td style="padding: 8px 0; color: #111827; font-weight: 500;">${startDate} → ${endDate}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;">Days</td><td style="padding: 8px 0; color: #111827; font-weight: 500;">${numberOfDays}</td></tr>
                  ${adminComment ? `<tr><td style="padding: 8px 0; color: #6b7280;">Comment</td><td style="padding: 8px 0; color: #111827;">${adminComment}</td></tr>` : ""}
                </table>
                <a href="https://techflow-time-off.lovable.app/my-leave" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 8px;">View My Leave</a>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error(`Failed to email ${employeeEmail}:`, emailErr);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in notify-leave-decision:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
