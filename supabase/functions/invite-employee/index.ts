import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Where the invite link drops the employee. Must also be listed in
// Supabase Auth → URL Configuration → Redirect URLs, otherwise GoTrue
// silently falls back to the Site URL.
const APP_URL = Deno.env.get("APP_URL") ?? "https://techflow-time-off.vercel.app";

// Resend refuses to deliver to third parties from the shared sandbox
// sender, so the invite needs a verified domain to reach employees.
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "Techflow Leave Manager <onboarding@resend.dev>";

const inviteEmailHtml = (firstName: string, actionLink: string) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1a1a2e; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Techflow Leave Manager</h1>
    </div>
    <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1a1a2e; margin-top: 0;">Bienvenue ${firstName} !</h2>
      <p style="color: #374151;">Un compte vient d'être créé pour vous sur Techflow Leave Manager, l'outil de gestion des congés de l'équipe.</p>
      <p style="color: #374151;">Cliquez ci-dessous pour définir votre mot de passe et accéder à votre espace :</p>
      <a href="${actionLink}" style="display: inline-block; background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 12px 0;">Définir mon mot de passe</a>
      <p style="color: #6b7280; font-size: 13px;">Ce lien expire dans 24 heures. Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br><span style="color: #6366f1; word-break: break-all;">${actionLink}</span></p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #6b7280; font-size: 13px; margin: 0;"><em>Welcome ${firstName}! An account was created for you on Techflow Leave Manager. Use the button above to set your password. The link expires in 24 hours.</em></p>
    </div>
  </div>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin using their JWT
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return json({ error: "Admin access required" }, 403);
    }

    const { email, firstName, lastName, hireDate, initialBalance } = await req.json();

    if (!email || !firstName || !lastName) {
      return json({ error: "Missing required fields" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const userMetadata = { first_name: firstName, last_name: lastName };

    let invitedUser;

    if (resendApiKey) {
      // Build the invite link ourselves and deliver it through Resend.
      // Supabase's built-in mailer is a testing service — it rate limits at
      // ~2 emails/hour and does not reliably deliver to addresses outside the
      // Supabase organisation, which silently dropped every employee invite.
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: { data: userMetadata, redirectTo: APP_URL },
      });

      if (linkError) {
        return json({ error: linkError.message }, 400);
      }

      invitedUser = linkData.user;
      const actionLink = linkData.properties?.action_link;

      if (!actionLink) {
        return json({ error: "Could not generate the invitation link" }, 500);
      }

      try {
        const resend = new Resend(resendApiKey);
        const { error: sendError } = await resend.emails.send({
          from: RESEND_FROM,
          to: [email],
          subject: "Votre accès à Techflow Leave Manager",
          html: inviteEmailHtml(firstName, actionLink),
        });
        if (sendError) throw new Error(sendError.message);
      } catch (emailErr) {
        // generateLink already created the auth user. Roll it back so the
        // admin can fix the mail problem and retry the same address instead
        // of hitting "user already registered".
        if (invitedUser) {
          await adminClient.auth.admin.deleteUser(invitedUser.id);
        }
        console.error(`Failed to email invite to ${email}:`, emailErr);
        return json({
          error: `L'employé n'a pas été créé : l'email d'invitation n'a pas pu être envoyé (${emailErr.message}).`,
        }, 502);
      }
    } else {
      // No Resend key configured — fall back to Supabase's own mailer, but at
      // least point the link at the production app.
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        { data: userMetadata, redirectTo: APP_URL },
      );

      if (inviteError) {
        return json({ error: inviteError.message }, 400);
      }

      invitedUser = inviteData.user;
    }

    // Update profile with hire date and initial balance
    if (invitedUser) {
      await adminClient
        .from("profiles")
        .update({
          hire_date: hireDate || null,
          leave_balance: initialBalance ?? 0,
          first_name: firstName,
          last_name: lastName,
        })
        .eq("id", invitedUser.id);
    }

    return json({ user: invitedUser }, 200);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
