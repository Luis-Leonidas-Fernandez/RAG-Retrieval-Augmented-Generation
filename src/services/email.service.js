import 'dotenv/config';
import { Resend } from "resend";
import { renderEmailTemplate } from "../templates/email/index.js";

// Validar y configurar Resend
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  console.error("[Email] ERROR: RESEND_API_KEY no está configurada en .env");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Configuración del remitente con fallback
const getFromEmail = () => {
  // Opción 1: RESEND_FROM (formato completo: "Name <email@domain.com>")
  if (process.env.RESEND_FROM) {
    return process.env.RESEND_FROM;
  }
  
  // Opción 2: RESEND_FROM_EMAIL + RESEND_FROM_NAME (formato separado)
  if (process.env.RESEND_FROM_EMAIL) {
    const name = process.env.RESEND_FROM_NAME || "Inri Service";
    return `${name} <${process.env.RESEND_FROM_EMAIL}>`;
  }
  
  // Fallback (no debería llegar aquí en producción)
  console.warn("[Email] WARNING: No se configuró RESEND_FROM o RESEND_FROM_EMAIL");
  return "Inri Service <noreply@example.com>";
};

/**
 * Enviar email de verificación usando Resend
 */
export async function sendVerificationEmail(email, name, verificationToken) {
  // Validar que Resend esté configurado
  if (!resend) {
    const error = new Error("RESEND_API_KEY no está configurada. No se puede enviar emails.");
    console.error(`[Email] ${error.message}`);
    throw error;
  }

  const fromEmail = getFromEmail();
  
  // Validar que fromEmail esté configurado
  if (!fromEmail || fromEmail.includes('example.com')) {
    const error = new Error("RESEND_FROM o RESEND_FROM_EMAIL no está configurada correctamente");
    console.error(`[Email] ${error.message}`);
    throw error;
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const verificationUrl = `${frontendUrl}/login.html?token=${verificationToken}`;

  console.log(`[Email] Intentando enviar email a ${email} desde ${fromEmail}`);

  try {
    // Cargar y renderizar template
    const { html, text } = await renderEmailTemplate('verification-email', {
      name,
      verificationUrl,
      year: new Date().getFullYear().toString(),
    });

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: "Verifica tu cuenta - Vector RAG",
      html,
      text,
    });

    if (error) {
      console.error(`[Email] Error al enviar email a ${email}:`, error);
      throw error;
    }

    console.log(`[Email] ✅ Email de verificación enviado a ${email}:`, data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error(`[Email] ❌ Error al enviar email a ${email}:`, error.message);
    if (error.stack) {
      console.error(`[Email] Stack trace:`, error.stack);
    }
    throw error;
  }
}

/**
 * Reenviar email de verificación
 */
export async function resendVerificationEmail(email, name, verificationToken) {
  return await sendVerificationEmail(email, name, verificationToken);
}
