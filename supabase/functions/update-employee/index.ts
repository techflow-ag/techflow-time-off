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
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, email, hireDate, monthlyAccrual, monthlyHolidayAccrual, action, tempPassword } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle reset password action — generate recovery link and send via Resend
    if (action === "resetPassword") {
      const { data: targetUser, error: userError } = await adminClient.auth.admin.getUserById(userId);
      if (userError || !targetUser?.user?.email) {
        return new Response(JSON.stringify({ error: userError?.message || "User not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const redirectTo = req.headers.get("x-redirect-to") || "https://techflow-time-off.lovable.app";

      // Generate a recovery link via Admin API (does not send an email)
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: targetUser.user.email,
        options: { redirectTo },
      });

      if (linkError || !linkData?.properties?.action_link) {
        return new Response(JSON.stringify({ error: linkError?.message || "Failed to generate recovery link" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send the recovery email via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        return new Response(JSON.stringify({ error: "Email service not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resend = new Resend(resendApiKey);
      const employeeName = targetUser.user.user_metadata?.first_name || targetUser.user.email;
      const recoveryLink = linkData.properties.action_link;

      const { error: emailError } = await resend.emails.send({
        from: "Techflow Leave Manager <onboarding@resend.dev>",
        to: [targetUser.user.email],
        subject: "Reset your password",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #1a1a2e; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Techflow Leave Manager</h1>
            </div>
            <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #6366f1; margin-top: 0;">Password Reset</h2>
              <p style="color: #374151;">Hi ${employeeName},</p>
              <p style="color: #374151;">An administrator has requested a password reset for your account. Click the button below to set a new password:</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${recoveryLink}" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Reset My Password</a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">If you didn't expect this email, you can safely ignore it. This link will expire in 24 hours.</p>
            </div>
          </div>
        `,
      });

      if (emailError) {
        return new Response(JSON.stringify({ error: `Failed to send email: ${emailError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle delete action
    if (action === "delete") {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .single();

      if (profile?.is_active) {
        return new Response(JSON.stringify({ error: "User must be deactivated before deletion" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("leave_requests").delete().eq("employee_id", userId);
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("id", userId);
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (authDeleteError) {
        return new Response(JSON.stringify({ error: authDeleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update email in auth if provided
    if (email) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
      });
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update profile
    const updates: Record<string, unknown> = {};
    if (email) updates.email = email;
    if (hireDate !== undefined) updates.hire_date = hireDate || null;
    if (monthlyAccrual !== undefined) updates.monthly_accrual = monthlyAccrual;
    if (monthlyHolidayAccrual !== undefined) updates.monthly_holiday_accrual = monthlyHolidayAccrual;

    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
